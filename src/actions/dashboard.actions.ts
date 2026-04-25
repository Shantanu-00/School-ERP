'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

async function getAuthStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', staff: null, supabase: null }
  const { data: staff } = await supabase.from('staff').select('id, role, name').eq('auth_id', user.id).maybeSingle()
  if (!staff) return { error: 'Staff not found', staff: null, supabase: null }
  return { error: null, staff, supabase }
}

type PocketMoneySnapshot = {
  totalEscrow: number
  negativeCount: number
  lowBalanceCount: number
  alumniPayable: number
  healthDistribution: { healthy: number; low: number; negative: number; total: number }
  topDefaulters: { id: string; name: string; balance: number }[]
}

async function getGlobalPocketMoneySnapshot(supabase: any): Promise<PocketMoneySnapshot> {
  const { data: txRows } = await supabase
    .from('pocket_money_transactions')
    .select('student_id, transaction_type, amount, students(first_name, last_name, status)')

  const balances = new Map<string, { balance: number; name: string; status: string | null }>()

  for (const row of (txRows || []) as any[]) {
    const studentId = row.student_id as string | undefined
    if (!studentId) continue

    const stu = Array.isArray(row.students) ? row.students[0] : row.students
    const existing = balances.get(studentId) || {
      balance: 0,
      name: stu ? `${stu.first_name} ${stu.last_name}`.trim() : 'Unknown',
      status: stu?.status || null,
    }

    existing.balance += row.transaction_type === 'CREDIT' ? Number(row.amount) : -Number(row.amount)

    if (stu) {
      const fullName = `${stu.first_name} ${stu.last_name}`.trim()
      if (fullName) existing.name = fullName
      existing.status = stu.status || existing.status
    }

    balances.set(studentId, existing)
  }

  let totalEscrow = 0
  let negativeCount = 0
  let lowBalanceCount = 0
  let alumniPayable = 0
  let healthyCount = 0

  const defaulters: { id: string; name: string; balance: number }[] = []

  for (const [studentId, entry] of balances.entries()) {
    const bal = entry.balance

    if (bal > 0) totalEscrow += bal
    if (bal < 0) {
      negativeCount++
      defaulters.push({ id: studentId, name: entry.name, balance: bal })
    } else if (bal < 500) {
      lowBalanceCount++
    } else {
      healthyCount++
    }

    if ((entry.status === 'Alumni' || entry.status === 'Dropout') && bal > 0) {
      alumniPayable += bal
    }
  }

  defaulters.sort((a, b) => a.balance - b.balance)

  return {
    totalEscrow,
    negativeCount,
    lowBalanceCount,
    alumniPayable,
    healthDistribution: {
      healthy: healthyCount,
      low: lowBalanceCount,
      negative: negativeCount,
      total: healthyCount + lowBalanceCount + negativeCount,
    },
    topDefaulters: defaulters.slice(0, 10),
  }
}

export async function resolveAcademicYear() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const cookieYearId = cookieStore.get('academic_year_id')?.value
  const { data: years } = await supabase.from('academic_years').select('id, name, start_date, end_date, is_active').order('start_date', { ascending: false })
  const allYears = years || []
  const activeYear = allYears.find(y => y.is_active)
  const resolvedId = cookieYearId || activeYear?.id || allYears[0]?.id || ''
  const current = allYears.find(y => y.id === resolvedId)
  return { resolvedId, current, allYears }
}

// ─── Active Students (year-scoped) ──────────────────────────────────────────

export async function getDashboardStudentData(academicYearId: string) {
  const { error, supabase } = await getAuthStaff()
  if (error || !supabase) return { error, data: null }

  const { data: yearData } = await supabase
    .from('academic_years')
    .select('id, name, start_date, end_date')
    .eq('id', academicYearId)
    .single()
  if (!yearData) return { error: 'Academic year not found', data: null }

  const pocketMoney = await getGlobalPocketMoneySnapshot(supabase)

  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select(`id, student_id, class_id, classes(id, grade_level, section), students(id, first_name, last_name, status, date_of_admission, admission_number)`)
    .eq('academic_year_id', academicYearId)

  const allEnrollments = (enrollments || []).filter(e => {
    const s = Array.isArray(e.students) ? e.students[0] : e.students
    return !!s
  })
  const currentEnrollmentIds = new Set(allEnrollments.map(e => e.id))
  const get = (e: any, k: string) => Array.isArray((e as any)[k]) ? (e as any)[k][0] : (e as any)[k]

  const activeEnrollments = allEnrollments.filter(e => get(e, 'students')?.status === 'Active')
  const totalActiveStudents = activeEnrollments.length
  const activeStudentIds = new Set(activeEnrollments.map(e => e.student_id))

  const newAdmissions = allEnrollments.filter(e => {
    const s = get(e, 'students')
    return s?.date_of_admission && s.date_of_admission >= yearData.start_date && s.date_of_admission <= yearData.end_date
  }).length

  const enrolledStudentIds = [...new Set(allEnrollments.map(e => e.student_id))]

  const empty = {
    data: {
      totalActiveStudents: 0, newAdmissions: 0,
      totalFeesToCollect: 0, totalFeesCollected: 0, totalCurrentOutstanding: 0,
      activeStudentsPastArrears: 0,
      classBreakdown: [] as any[],
      pocketMoney,
    }
  }
  if (enrolledStudentIds.length === 0) return empty

  // Get ALL enrollment IDs for these students across ALL years (needed for past arrears)
  const { data: allStudentEnrollments } = await supabase
    .from('student_enrollments')
    .select('id, student_id')
    .in('student_id', enrolledStudentIds)

  const allEnrollmentIdsForStudents = (allStudentEnrollments || []).map(e => e.id)
  const enrollmentToStudent = new Map((allStudentEnrollments || []).map(e => [e.id, e.student_id]))

  // Fetch invoices by enrollment_id OR student_id (student_id is nullable on older invoices)
  const orParts: string[] = []
  if (allEnrollmentIdsForStudents.length > 0) orParts.push(`enrollment_id.in.(${allEnrollmentIdsForStudents.join(',')})`)
  if (enrolledStudentIds.length > 0) orParts.push(`student_id.in.(${enrolledStudentIds.join(',')})`)

  const { data: allInvoices } = await supabase
    .from('fee_invoices')
    .select('id, student_id, enrollment_id, total_amount, status, fee_payments(amount_paid)')
    .or(orParts.join(','))

  let totalFeesToCollect = 0, totalFeesCollected = 0, totalCurrentOutstanding = 0, activeStudentsPastArrears = 0
  const seen = new Set<string>()

  for (const inv of (allInvoices || [])) {
    if (seen.has(inv.id)) continue
    seen.add(inv.id)

    const sid = (inv.student_id as string) || enrollmentToStudent.get(inv.enrollment_id) || null
    if (!sid) continue

    const paid = ((inv.fee_payments || []) as any[]).reduce((s: number, p: any) => s + Number(p.amount_paid), 0)
    const pending = Math.max(0, Number(inv.total_amount) - paid)

    const isCurrentYear = currentEnrollmentIds.has(inv.enrollment_id) ||
        (!inv.enrollment_id && activeStudentIds.has(sid))

    if (isCurrentYear) {
      totalFeesToCollect += Number(inv.total_amount)
      totalFeesCollected += paid
      totalCurrentOutstanding += pending
    } else if (activeStudentIds.has(sid)) {
      activeStudentsPastArrears += pending
    }
  }

  // Class breakdown
  const classMap: Record<string, { classId: string; gradeLevel: string; section: string; activeCount: number; formerCount: number; newAdmissions: number; feesToCollect: number; feesPending: number }> = {}

  for (const e of allEnrollments) {
    const cls = get(e, 'classes'), s = get(e, 'students')
    if (!cls || !s) continue
    if (!classMap[cls.id]) classMap[cls.id] = { classId: cls.id, gradeLevel: cls.grade_level, section: cls.section, activeCount: 0, formerCount: 0, newAdmissions: 0, feesToCollect: 0, feesPending: 0 }
    if (s.status === 'Active') classMap[cls.id].activeCount++
    else if (s.status === 'Alumni' || s.status === 'Dropout') classMap[cls.id].formerCount++
    if (s.date_of_admission && s.date_of_admission >= yearData.start_date && s.date_of_admission <= yearData.end_date) classMap[cls.id].newAdmissions++
  }

  const seenClass = new Set<string>()
  for (const inv of (allInvoices || [])) {
    if (seenClass.has(inv.id)) continue
    seenClass.add(inv.id)

    const sid = (inv.student_id as string) || enrollmentToStudent.get(inv.enrollment_id) || null

    let enr = inv.enrollment_id ? allEnrollments.find(e => e.id === inv.enrollment_id) : null
    if (!enr && sid) enr = allEnrollments.find(e => e.student_id === sid)
    if (!enr) continue

    const isCurrentYear = currentEnrollmentIds.has(inv.enrollment_id) ||
        (!inv.enrollment_id && sid && activeStudentIds.has(sid))
    if (!isCurrentYear) continue

    const cls = get(enr, 'classes')
    if (!cls || !classMap[cls.id]) continue
    const paid = ((inv.fee_payments || []) as any[]).reduce((s: number, p: any) => s + Number(p.amount_paid), 0)
    classMap[cls.id].feesToCollect += Number(inv.total_amount)
    classMap[cls.id].feesPending += Math.max(0, Number(inv.total_amount) - paid)
  }

  const classBreakdown = Object.values(classMap)
    .map(c => ({ ...c, label: `${c.gradeLevel} - ${c.section}`, feesCollected: c.feesToCollect - c.feesPending }))
    .sort((a, b) => a.gradeLevel.localeCompare(b.gradeLevel) || a.section.localeCompare(b.section))

  return {
    data: {
      totalActiveStudents, newAdmissions,
      totalFeesToCollect, totalFeesCollected, totalCurrentOutstanding, activeStudentsPastArrears,
      classBreakdown,
      pocketMoney,
    }
  }
}

// ─── All Former Students (year-independent) ─────────────────────────────────

export async function getAllFormerStudentsData() {
  const { error, supabase } = await getAuthStaff()
  if (error || !supabase) return { error, data: null }

  const { data: students } = await supabase.from('students').select('id, first_name, last_name, admission_number, status').in('status', ['Alumni', 'Dropout']).order('first_name')
  if (!students || students.length === 0) return { data: { totalFormer: 0, alumniCount: 0, dropoutCount: 0, withPendingCount: 0, clearedCount: 0, totalPendingAmount: 0, totalCollectedAmount: 0, students: [] } }

  const ids = students.map(s => s.id)
  const { data: enrollments } = await supabase.from('student_enrollments').select('student_id, classes(grade_level, section), academic_years(name, start_date)').in('student_id', ids)

  const lastClassMap = new Map<string, string>(), lastYearMap = new Map<string, string>()
  const byStudent: Record<string, any[]> = {}
  for (const e of (enrollments || [])) { if (!byStudent[e.student_id]) byStudent[e.student_id] = []; byStudent[e.student_id].push(e) }
  for (const [sid, enrs] of Object.entries(byStudent)) {
    const sorted = enrs.sort((a: any, b: any) => { const ayA = Array.isArray(a.academic_years) ? a.academic_years[0] : a.academic_years; const ayB = Array.isArray(b.academic_years) ? b.academic_years[0] : b.academic_years; return (ayB?.start_date || '').localeCompare(ayA?.start_date || '') })
    const l = sorted[0]; const cls = Array.isArray(l?.classes) ? l.classes[0] : l?.classes; const ay = Array.isArray(l?.academic_years) ? l.academic_years[0] : l?.academic_years
    if (cls) lastClassMap.set(sid, `${cls.grade_level} - ${cls.section}`); if (ay) lastYearMap.set(sid, ay.name)
  }

  const { data: invoices } = await supabase.from('fee_invoices').select('id, student_id, total_amount, fee_payments(amount_paid)').in('student_id', ids)
  const dues: Record<string, { totalOwed: number; totalPaid: number; pending: number }> = {}
  for (const inv of (invoices || [])) {
    const sid = inv.student_id as string; if (!sid) continue
    if (!dues[sid]) dues[sid] = { totalOwed: 0, totalPaid: 0, pending: 0 }
    const paid = ((inv.fee_payments || []) as any[]).reduce((s: number, p: any) => s + Number(p.amount_paid), 0)
    dues[sid].totalOwed += Number(inv.total_amount); dues[sid].totalPaid += paid; dues[sid].pending += Math.max(0, Number(inv.total_amount) - paid)
  }

  const list = students.map(s => {
    const d = dues[s.id] || { totalOwed: 0, totalPaid: 0, pending: 0 }
    return { id: s.id, name: `${s.first_name} ${s.last_name}`, admissionNumber: s.admission_number || '', status: s.status, lastClass: lastClassMap.get(s.id) || '', lastYear: lastYearMap.get(s.id) || '', totalOwed: d.totalOwed, totalPaid: d.totalPaid, totalPending: d.pending }
  }).sort((a, b) => b.totalPending - a.totalPending)

  const withPending = list.filter(s => s.totalPending > 0)
  return {
    data: {
      totalFormer: students.length, alumniCount: students.filter(s => s.status === 'Alumni').length, dropoutCount: students.filter(s => s.status === 'Dropout').length,
      withPendingCount: withPending.length, clearedCount: students.length - withPending.length,
      totalPendingAmount: withPending.reduce((s, f) => s + f.totalPending, 0), totalCollectedAmount: list.reduce((s, f) => s + f.totalPaid, 0),
      students: list,
    }
  }
}

// ─── Staff & Payroll ────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthYearStr(d: Date) { return `${MONTHS[d.getMonth()]}-${d.getFullYear()}` }

function getMonthRange(range: string): string[] {
  const now = new Date()
  let count = 1
  if (range === '3m') count = 3
  else if (range === '6m') count = 6
  else if (range === '12m') count = 12

  const months: string[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(monthYearStr(d))
  }
  return months
}

export async function getDashboardStaffData(range: string = 'current') {
  const { error, supabase } = await getAuthStaff()
  if (error || !supabase) return { error, data: null }

  // All teachers
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, first_name, last_name, base_salary, status, hire_date, designation')
    .order('first_name')

  const all = teachers || []
  const active = all.filter(t => t.status === 'Active')
  const inactive = all.filter(t => t.status === 'Resigned' || t.status === 'Terminated')

  const totalBaseSalary = active.reduce((s, t) => s + Number(t.base_salary), 0)

  // Payroll records for the selected month range
  const monthKeys = getMonthRange(range)
  const currentMonthKey = monthYearStr(new Date())

  const { data: payroll } = await supabase
    .from('teacher_payroll')
    .select('id, teacher_id, month_year, base_amount, bonus_amount, deduction_amount, arrears_brought_forward, net_payable, amount_paid, balance_carried_forward, payment_date, status, payment_mode, remarks')
    .in('month_year', monthKeys)

  const allPayroll = payroll || []

  // Canonical accessors — handle old rows (pre-arrears migration) gracefully.
  // amount_paid  = actual cash that left the school for this row (may be partial)
  // net_payable  = total owed this month incl. arrears (obligation, not disbursement)
  // balance_carried_forward = net_payable - amount_paid, rolls to next month
  const rowAmountPaid   = (r: any): number => Number(r.amount_paid   ?? r.net_payable ?? 0)
  const rowNetPayable   = (r: any): number => Number(r.net_payable   ?? r.amount_paid ?? 0)
  const rowArrears      = (r: any): number => Number(r.arrears_brought_forward ?? 0)
  const rowCarryFwd     = (r: any): number => Number(r.balance_carried_forward ?? 0)

  // Current month stats
  const currentMonthRecords = allPayroll.filter(r => r.month_year === currentMonthKey)
  const paidRows    = currentMonthRecords.filter(r => r.status === 'Paid')
  const pendingRows = currentMonthRecords.filter(r => r.status === 'Pending Approval')
  const draftRows   = currentMonthRecords.filter(r => r.status === 'Draft')

  // "Paid amount" = cash actually disbursed to staff whose status is Paid.
  // "Pending/Draft amount" = the full obligation (net_payable) for those rows —
  //   not "amount_paid" because they haven't been paid yet.
  const paidAmount    = paidRows   .reduce((s, r) => s + rowAmountPaid(r), 0)
  const pendingAmount = pendingRows.reduce((s, r) => s + rowNetPayable(r), 0)
  const draftAmount   = draftRows  .reduce((s, r) => s + rowNetPayable(r), 0)

  // Balance carry-forwards from Paid rows that were partially settled this month.
  const totalCarriedForwardThisMonth = paidRows.reduce((s, r) => s + rowCarryFwd(r), 0)
  // Total arrears absorbed this month across all rows.
  const totalArrearsThisMonth = currentMonthRecords.reduce((s, r) => s + rowArrears(r), 0)

  // Month-by-month breakdown for the range
  const monthlyBreakdown = monthKeys.map(mk => {
    const recs    = allPayroll.filter(r => r.month_year === mk)
    const paid    = recs.filter(r => r.status === 'Paid')
    const pending = recs.filter(r => r.status === 'Pending Approval')
    const draft   = recs.filter(r => r.status === 'Draft')
    return {
      month:      mk,
      totalStaff: active.length,
      paidCount:    paid.length,
      pendingCount: pending.length,
      draftCount:   draft.length,
      unprocCount:  active.length - recs.length,
      // "Paid Amt" = cash that actually went out for Paid rows
      paidAmount:   paid.reduce((s, r) => s + rowAmountPaid(r), 0),
      // "Total Payable" = full obligation for all rows (useful for budget planning)
      totalPayable: recs.reduce((s, r) => s + rowNetPayable(r), 0),
      totalBonus:       recs.reduce((s, r) => s + Number(r.bonus_amount), 0),
      totalDeductions:  recs.reduce((s, r) => s + Number(r.deduction_amount), 0),
      totalArrears:     recs.reduce((s, r) => s + rowArrears(r),  0),
      totalCarriedFwd:  paid.reduce((s, r) => s + rowCarryFwd(r), 0),
    }
  })

  // Per-staff current month detail — carry all 4 new ledger fields
  const staffDetail = active.map(t => {
    const rec = currentMonthRecords.find(r => r.teacher_id === t.id)
    return {
      id:          t.id,
      name:        `${t.first_name} ${t.last_name}`,
      designation: t.designation || '',
      baseSalary:  Number(t.base_salary),
      status:      rec?.status || 'Not Processed',
      // amountPaid — what was actually paid (0 if not yet processed)
      amountPaid:  rec ? rowAmountPaid(rec)  : 0,
      // netPayable — total obligation this month incl. arrears
      netPayable:  rec ? rowNetPayable(rec)  : 0,
      arrears:     rec ? rowArrears(rec)     : 0,
      carryFwd:    rec ? rowCarryFwd(rec)    : 0,
      bonus:       rec ? Number(rec.bonus_amount)     : 0,
      deduction:   rec ? Number(rec.deduction_amount) : 0,
      paymentMode: rec?.payment_mode || null,
      remarks:     rec?.remarks      || null,
      // Keep netPaid as alias so callers using the old field name still work
      netPaid:     rec ? rowAmountPaid(rec)  : 0,
    }
  })

  return {
    data: {
      currentMonth:    currentMonthKey,
      activeCount:     active.length,
      inactiveCount:   inactive.length,
      resignedCount:   inactive.filter(t => t.status === 'Resigned').length,
      terminatedCount: inactive.filter(t => t.status === 'Terminated').length,
      totalBaseSalary,
      thisMonth: {
        paidCount:    paidRows.length,
        pendingCount: pendingRows.length,
        draftCount:   draftRows.length,
        unprocCount:  active.length - currentMonthRecords.length,
        // Financial dimensions kept semantically correct
        paidAmount,           // cash actually out the door
        pendingAmount,        // obligation for rows awaiting approval
        draftAmount,          // obligation for draft rows
        totalCarriedFwd:      totalCarriedForwardThisMonth, // arrears rolling to next month
        totalArrears:         totalArrearsThisMonth,        // arrears absorbed this month
        // totalProcessed = all obligations entered this month (for progress bar)
        totalProcessed: paidAmount + pendingAmount + draftAmount,
      },
      monthlyBreakdown,
      staffDetail,
    }
  }
}

// ─── Expenses & Other Income (year-scoped) ──────────────────────────────────

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export async function getDashboardExpenseData(academicYearId: string) {
  const { error, supabase } = await getAuthStaff()
  if (error || !supabase) return { error, data: null }

  // Expenses
  const { data: expenses } = await supabase
    .from('general_expenses')
    .select('id, category, amount, date_incurred, cost_center, payee_name, payment_mode, voucher_number, description, transaction_reference, logged_by_staff:staff!logged_by(name)')
    .eq('academic_year_id', academicYearId)
    .order('date_incurred', { ascending: false })

  const allExp = expenses || []
  const totalExpenses = allExp.reduce((s, e) => s + Number(e.amount), 0)
  const expenseCount = allExp.length
  const largeCount = allExp.filter(e => Number(e.amount) >= 50000).length

  // Contextual time windows
  const d1 = daysAgo(1), d2 = daysAgo(2), d7 = daysAgo(7), d30 = daysAgo(30)
  const sumExpAfter = (cutoff: string) => allExp.filter(e => e.date_incurred >= cutoff).reduce((s, e) => s + Number(e.amount), 0)
  const countExpAfter = (cutoff: string) => allExp.filter(e => e.date_incurred >= cutoff).length

  const context = {
    last24h: { amount: sumExpAfter(d1), count: countExpAfter(d1) },
    last48h: { amount: sumExpAfter(d2), count: countExpAfter(d2) },
    last7d:  { amount: sumExpAfter(d7), count: countExpAfter(d7) },
    last30d: { amount: sumExpAfter(d30), count: countExpAfter(d30) },
    yearTotal: { amount: totalExpenses, count: expenseCount },
  }

  // Category/Cost center/Mode breakdowns
  const catMap: Record<string, number> = {}, ccMap: Record<string, number> = {}, modeMap: Record<string, number> = {}
  for (const e of allExp) {
    catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount)
    ccMap[e.cost_center || 'Main School'] = (ccMap[e.cost_center || 'Main School'] || 0) + Number(e.amount)
    modeMap[e.payment_mode || 'Unknown'] = (modeMap[e.payment_mode || 'Unknown'] || 0) + Number(e.amount)
  }
  const toList = (m: Record<string, number>) => Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  // All expenses mapped for table
  const allExpenseRows = allExp.map((e: any) => ({
    id: e.id, date: e.date_incurred, category: e.category, amount: Number(e.amount),
    costCenter: e.cost_center || 'Main School', payee: e.payee_name || '',
    voucher: e.voucher_number || '', mode: e.payment_mode || '',
    description: e.description || '', reference: e.transaction_reference || '',
    loggedBy: e.logged_by_staff?.name || null,
  }))

  // Other Income
  const { data: income } = await supabase
    .from('other_income')
    .select('id, income_category, amount, date_received, description, staff:logged_by(name)')
    .eq('academic_year_id', academicYearId)
    .order('date_received', { ascending: false })

  const allIncome = income || []
  const totalOtherIncome = allIncome.reduce((s, i) => s + Number(i.amount), 0)
  const incomeCount = allIncome.length

  const incomeCatMap: Record<string, number> = {}
  for (const i of allIncome) incomeCatMap[i.income_category] = (incomeCatMap[i.income_category] || 0) + Number(i.amount)

  const allIncomeRows = allIncome.map((i: any) => ({
    id: i.id, date: i.date_received, category: i.income_category,
    amount: Number(i.amount), description: i.description || '',
    loggedBy: (Array.isArray(i.staff) ? i.staff[0] : i.staff)?.name || null,
  }))

  // Audit logs
  const { data: auditLogs } = await supabase
    .from('expense_audit_logs')
    .select('id, voucher_number, changed_at, old_amount, new_amount, old_category, new_category, old_description, new_description, staff:changed_by(name)')
    .eq('academic_year_id', academicYearId)
    .order('changed_at', { ascending: false })

  const allAudits = (auditLogs || []).map((a: any) => ({
    id: a.id, date: a.changed_at?.split('T')[0] || '', voucher: a.voucher_number || '',
    oldAmount: Number(a.old_amount), newAmount: Number(a.new_amount),
    oldCategory: a.old_category, newCategory: a.new_category,
    oldDescription: a.old_description || '', newDescription: a.new_description || '',
    changedBy: (Array.isArray(a.staff) ? a.staff[0] : a.staff)?.name || null,
  }))

  // Unique editors count
  const uniqueEditors = new Set(allAudits.map(a => a.changedBy).filter(Boolean)).size

  return {
    data: {
      totalExpenses, expenseCount, largeCount, totalOtherIncome, incomeCount,
      netOutflow: totalExpenses - totalOtherIncome,
      context,
      byCategory: toList(catMap), byCostCenter: toList(ccMap), byPaymentMode: toList(modeMap),
      incomeByCategory: toList(incomeCatMap),
      allExpenses: allExpenseRows, allIncome: allIncomeRows,
      allAudits, auditCount: allAudits.length, uniqueEditors,
    }
  }
}

// ─── Fee Logs ───────────────────────────────────────────────────────────────

export async function getFeeLogs(dateFrom: string, dateTo: string, offset = 0, limit = 10) {
  const { error, supabase } = await getAuthStaff()
  if (error || !supabase) return { error, data: [], hasMore: false }

  const { data: payments, error: e } = await supabase.from('fee_payments')
    .select(`id, amount_paid, payment_date, payment_method, transaction_reference, logged_by_staff:staff!logged_by(name), invoice:fee_invoices(invoice_title, student:students(first_name, last_name, admission_number), enrollment:student_enrollments(classes(grade_level, section)))`)
    .gte('payment_date', dateFrom).lte('payment_date', dateTo).order('payment_date', { ascending: false }).range(offset, offset + limit - 1)
  if (e) return { error: e.message, data: [], hasMore: false }

  const all = payments || []
  return {
    data: all.map((p: any) => {
      const inv = Array.isArray(p.invoice) ? p.invoice[0] : p.invoice
      const stu = inv?.student ? (Array.isArray(inv.student) ? inv.student[0] : inv.student) : null
      const enr = inv?.enrollment ? (Array.isArray(inv.enrollment) ? inv.enrollment[0] : inv.enrollment) : null
      const cls = enr?.classes ? (Array.isArray(enr.classes) ? enr.classes[0] : enr.classes) : null
      const staff = Array.isArray(p.logged_by_staff) ? p.logged_by_staff[0] : p.logged_by_staff
      return { id: p.id, date: p.payment_date, studentName: stu ? `${stu.first_name} ${stu.last_name}` : 'Unknown', admissionNumber: stu?.admission_number || '', className: cls ? `${cls.grade_level} - ${cls.section}` : '', invoiceTitle: inv?.invoice_title || 'Fee Payment', amount: Number(p.amount_paid), method: p.payment_method, reference: p.transaction_reference, loggedBy: staff?.name || null }
    }),
    hasMore: all.length === limit,
  }
}

// ─── Pocket Money Logs ──────────────────────────────────────────────────────

export async function getPocketMoneyLogs(dateFrom: string, dateTo: string, offset = 0, limit = 10) {
  const { error, supabase } = await getAuthStaff()
  if (error || !supabase) return { error, data: [], hasMore: false }

  const { data: tx, error: e } = await supabase.from('pocket_money_transactions')
    .select('id, student_id, transaction_type, amount, description, payment_mode, transaction_reference, created_at, students(first_name, last_name, admission_number), staff:logged_by(name)')
    .gte('created_at', `${dateFrom}T00:00:00`).lte('created_at', `${dateTo}T23:59:59`).order('created_at', { ascending: false }).range(offset, offset + limit - 1)
  if (e) return { error: e.message, data: [], hasMore: false }

  const all = tx || []
  return {
    data: all.map((t: any) => {
      const stu = Array.isArray(t.students) ? t.students[0] : t.students
      const staff = Array.isArray(t.staff) ? t.staff[0] : t.staff
      return { id: t.id, date: t.created_at.split('T')[0], studentName: stu ? `${stu.first_name} ${stu.last_name}` : 'Unknown', admissionNumber: stu?.admission_number || '', type: t.transaction_type as 'CREDIT' | 'DEBIT', amount: Number(t.amount), description: t.description, method: t.payment_mode, reference: t.transaction_reference, loggedBy: staff?.name || null }
    }),
    hasMore: all.length === limit,
  }
}

// ─── Cashflow Overview ─────────────────────────────────────────────────────

export async function getCashflowData(dateFrom: string, dateTo: string, txOffset = 0, txLimit = 20) {
  const { error, supabase } = await getAuthStaff()
  if (error || !supabase) return { error, data: null }

  const [feeRes, incomeRes, pmRes, payrollRes, expenseRes, invoiceRes, cumFeeRes, cumIncomeRes, cumPmRes, cumPayrollRes, cumExpenseRes, cumInvoiceRes] = await Promise.all([
    supabase.from('fee_payments')
      .select('id, amount_paid, payment_date, payment_method, transaction_reference, logged_by_staff:staff!logged_by(name), invoice:fee_invoices(invoice_title, student:students(first_name, last_name, admission_number))')
      .gte('payment_date', dateFrom).lte('payment_date', dateTo),
    supabase.from('other_income')
      .select('id, amount, date_received, income_category, description, staff:logged_by(name)')
      .gte('date_received', dateFrom).lte('date_received', dateTo),
    supabase.from('pocket_money_transactions')
      .select('id, transaction_type, amount, description, created_at, payment_mode, transaction_reference, students(first_name, last_name, admission_number), staff:logged_by(name)')
      .gte('created_at', `${dateFrom}T00:00:00`).lte('created_at', `${dateTo}T23:59:59`),
    supabase.from('teacher_payroll')
      .select('id, amount_paid, net_payable, payment_date, payment_mode, remarks, teachers(first_name, last_name), logged_by_staff:staff!logged_by(name)')
      .gte('payment_date', dateFrom).lte('payment_date', dateTo).eq('status', 'Paid'),
    supabase.from('general_expenses')
      .select('id, amount, date_incurred, category, description, payment_mode, payee_name, voucher_number, logged_by_staff:staff!logged_by(name)')
      .gte('date_incurred', dateFrom).lte('date_incurred', dateTo),
    supabase.from('fee_invoices')
      .select('id, total_amount, due_date, status, invoice_title, created_at, student:students(first_name, last_name, admission_number), created_by_staff:staff!created_by(name), fee_payments(amount_paid)')
      .gte('created_at', `${dateFrom}T00:00:00`).lte('created_at', `${dateTo}T23:59:59`)
      .in('status', ['Unpaid', 'Partial']),
    supabase.from('fee_payments').select('amount_paid'),
    supabase.from('other_income').select('amount'),
    supabase.from('pocket_money_transactions').select('student_id, transaction_type, amount'),
    supabase.from('teacher_payroll').select('amount_paid, net_payable').eq('status', 'Paid'),
    supabase.from('general_expenses').select('amount'),
    supabase.from('fee_invoices').select('id, total_amount, status, fee_payments(amount_paid)').in('status', ['Unpaid', 'Partial']),
  ])

  const fees = feeRes.data || []
  const incomeRows = incomeRes.data || []
  const pm = pmRes.data || []
  const payrollRows = payrollRes.data || []
  const expenseRows = expenseRes.data || []
  const invoiceRows = invoiceRes.data || []

  const pmCredits = pm.filter((t: any) => t.transaction_type === 'CREDIT')
  const pmDebits = pm.filter((t: any) => t.transaction_type === 'DEBIT')

  const feeTotal = fees.reduce((s, f: any) => s + Number(f.amount_paid), 0)
  const incomeTotal = incomeRows.reduce((s, i: any) => s + Number(i.amount), 0)
  const pmCreditTotal = pmCredits.reduce((s, t: any) => s + Number(t.amount), 0)
  const payrollTotal = payrollRows.reduce((s, p: any) => s + Number(p.amount_paid ?? p.net_payable ?? 0), 0)
  const expenseTotal = expenseRows.reduce((s, e: any) => s + Number(e.amount), 0)
  const pmDebitTotal = pmDebits.reduce((s, t: any) => s + Number(t.amount), 0)

  // Pending dues from invoices in this period
  let pendingDuesTotal = 0, pendingDuesCount = 0
  for (const inv of invoiceRows) {
    const paid = ((inv.fee_payments || []) as any[]).reduce((s: number, p: any) => s + Number(p.amount_paid), 0)
    const pending = Math.max(0, Number(inv.total_amount) - paid)
    if (pending > 0) { pendingDuesTotal += pending; pendingDuesCount++ }
  }

  // All-time pending dues
  let cumPendingDuesTotal = 0, cumPendingDuesCount = 0
  for (const inv of (cumInvoiceRes.data || [])) {
    const paid = ((inv.fee_payments || []) as any[]).reduce((s: number, p: any) => s + Number(p.amount_paid), 0)
    const pending = Math.max(0, Number(inv.total_amount) - paid)
    if (pending > 0) { cumPendingDuesTotal += pending; cumPendingDuesCount++ }
  }

  const moneyIn = feeTotal + incomeTotal + pmCreditTotal
  const moneyOut = payrollTotal + expenseTotal + pmDebitTotal

  const inSources = [
    { label: 'Fee Received', amount: feeTotal, count: fees.length },
    { label: 'Other Income', amount: incomeTotal, count: incomeRows.length },
    { label: 'Pocket Money Received', amount: pmCreditTotal, count: pmCredits.length },
  ]
  const outSources = [
    { label: 'Salary Paid', amount: payrollTotal, count: payrollRows.length },
    { label: 'School Expenses', amount: expenseTotal, count: expenseRows.length },
    { label: 'Pocket Money Spent', amount: pmDebitTotal, count: pmDebits.length },
  ]

  const cumFeeTotal = (cumFeeRes.data || []).reduce((s, f: any) => s + Number(f.amount_paid), 0)
  const cumIncomeTotal = (cumIncomeRes.data || []).reduce((s, i: any) => s + Number(i.amount), 0)
  const cumPm = cumPmRes.data || []
  const cumPmCr = cumPm.filter((t: any) => t.transaction_type === 'CREDIT').reduce((s, t: any) => s + Number(t.amount), 0)
  const cumPmDr = cumPm.filter((t: any) => t.transaction_type === 'DEBIT').reduce((s, t: any) => s + Number(t.amount), 0)
  const cumPayrollTotal = (cumPayrollRes.data || []).reduce((s, p: any) => s + Number(p.amount_paid ?? p.net_payable ?? 0), 0)
  const cumExpenseTotal = (cumExpenseRes.data || []).reduce((s, e: any) => s + Number(e.amount), 0)

  // Per-student pocket money balances
  const pmStudentBal: Record<string, number> = {}
  for (const t of cumPm) {
    const sid = (t as any).student_id
    if (!sid) continue
    pmStudentBal[sid] = (pmStudentBal[sid] || 0) + ((t as any).transaction_type === 'CREDIT' ? Number((t as any).amount) : -Number((t as any).amount))
  }
  let pmHeld = 0, pmToCollect = 0
  for (const bal of Object.values(pmStudentBal)) {
    if (bal > 0) pmHeld += bal
    else if (bal < 0) pmToCollect += Math.abs(bal)
  }

  const totalFunds = (cumFeeTotal + cumIncomeTotal + cumPmCr) - (cumPayrollTotal + cumExpenseTotal + cumPmDr)
  const usableFunds = totalFunds - pmHeld

  type CfTx = { id: string; date: string; source: string; description: string; amount: number; direction: 'in' | 'out'; method: string | null; loggedBy: string | null }
  const allTx: CfTx[] = []

  for (const f of fees) {
    const inv = Array.isArray((f as any).invoice) ? (f as any).invoice[0] : (f as any).invoice
    const stu = inv?.student ? (Array.isArray(inv.student) ? inv.student[0] : inv.student) : null
    const stf = Array.isArray((f as any).logged_by_staff) ? (f as any).logged_by_staff[0] : (f as any).logged_by_staff
    allTx.push({ id: f.id, date: (f as any).payment_date, source: 'Fee Payment', description: stu ? `${stu.first_name} ${stu.last_name} — ${inv?.invoice_title || 'Fee'}` : inv?.invoice_title || 'Fee Payment', amount: Number((f as any).amount_paid), direction: 'in', method: (f as any).payment_method, loggedBy: stf?.name || null })
  }
  for (const i of incomeRows) {
    const stf = Array.isArray((i as any).staff) ? (i as any).staff[0] : (i as any).staff
    allTx.push({ id: i.id, date: (i as any).date_received, source: 'Other Income', description: `${(i as any).income_category}${(i as any).description ? ` — ${(i as any).description}` : ''}`, amount: Number((i as any).amount), direction: 'in', method: null, loggedBy: stf?.name || null })
  }
  for (const t of pmCredits) {
    const stu = Array.isArray((t as any).students) ? (t as any).students[0] : (t as any).students
    const stf = Array.isArray((t as any).staff) ? (t as any).staff[0] : (t as any).staff
    allTx.push({ id: t.id, date: (t as any).created_at.split('T')[0], source: 'PM Deposit', description: stu ? `${stu.first_name} ${stu.last_name} — ${(t as any).description}` : (t as any).description, amount: Number((t as any).amount), direction: 'in', method: (t as any).payment_mode, loggedBy: stf?.name || null })
  }
  for (const p of payrollRows) {
    const teacher = Array.isArray((p as any).teachers) ? (p as any).teachers[0] : (p as any).teachers
    const stf = Array.isArray((p as any).logged_by_staff) ? (p as any).logged_by_staff[0] : (p as any).logged_by_staff
    allTx.push({ id: p.id, date: (p as any).payment_date, source: 'Payroll', description: teacher ? `${teacher.first_name} ${teacher.last_name}${(p as any).remarks ? ` — ${(p as any).remarks}` : ''}` : 'Payroll', amount: Number((p as any).amount_paid ?? (p as any).net_payable ?? 0), direction: 'out', method: (p as any).payment_mode, loggedBy: stf?.name || null })
  }
  for (const e of expenseRows) {
    const stf = Array.isArray((e as any).logged_by_staff) ? (e as any).logged_by_staff[0] : (e as any).logged_by_staff
    allTx.push({ id: e.id, date: (e as any).date_incurred, source: 'Expense', description: `${(e as any).category}${(e as any).payee_name ? ` — ${(e as any).payee_name}` : ''}`, amount: Number((e as any).amount), direction: 'out', method: (e as any).payment_mode, loggedBy: stf?.name || null })
  }
  for (const t of pmDebits) {
    const stu = Array.isArray((t as any).students) ? (t as any).students[0] : (t as any).students
    const stf = Array.isArray((t as any).staff) ? (t as any).staff[0] : (t as any).staff
    allTx.push({ id: t.id, date: (t as any).created_at.split('T')[0], source: 'PM Spend', description: stu ? `${stu.first_name} ${stu.last_name} — ${(t as any).description}` : (t as any).description, amount: Number((t as any).amount), direction: 'out', method: (t as any).payment_mode, loggedBy: stf?.name || null })
  }
  for (const inv of invoiceRows) {
    const paid = ((inv.fee_payments || []) as any[]).reduce((s: number, p: any) => s + Number(p.amount_paid), 0)
    const pending = Math.max(0, Number(inv.total_amount) - paid)
    if (pending <= 0) continue
    const stu = (inv as any).student ? (Array.isArray((inv as any).student) ? (inv as any).student[0] : (inv as any).student) : null
    const stf = (inv as any).created_by_staff ? (Array.isArray((inv as any).created_by_staff) ? (inv as any).created_by_staff[0] : (inv as any).created_by_staff) : null
    allTx.push({ id: `pending-${inv.id}`, date: (inv as any).created_at?.split('T')[0] || (inv as any).due_date, source: 'Pending Fee', description: stu ? `${stu.first_name} ${stu.last_name} — ${(inv as any).invoice_title || 'Fee'}` : (inv as any).invoice_title || 'Fee Due', amount: pending, direction: 'pending' as any, method: null, loggedBy: stf?.name || null })
  }

  allTx.sort((a, b) => b.date.localeCompare(a.date))
  const paginated = allTx.slice(txOffset, txOffset + txLimit)

  return {
    data: {
      period: { moneyIn, moneyOut, net: moneyIn - moneyOut, pendingDues: pendingDuesTotal, pendingDuesCount, inSources, outSources, txCount: allTx.length },
      cumulative: { totalFunds, pmHeld, pmToCollect, usableFunds, pendingDues: cumPendingDuesTotal, pendingDuesCount: cumPendingDuesCount },
      transactions: paginated,
      totalTransactions: allTx.length,
      hasMore: txOffset + txLimit < allTx.length,
    }
  }
}
