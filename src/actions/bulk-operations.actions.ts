'use server'

import { createClient } from '@/lib/supabase/server'
import { applyDiscount, selectFeeConfigurationByGender } from '@/lib/invoice'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

export type BulkStudent = {
  id: string
  admission_number: string
  first_name: string
  last_name: string
  gender: string | null
  status: string          // Active | Alumni | Dropout
  enrollment_id: string | null
  class_id: string | null
  grade_level: string | null
  section: string | null
  academic_year_name: string | null
  discount_type: string
  discount_mode: string
  discount_value: number
  existing_invoice: { id: string; title: string; status: string; total_amount: number } | null
  pocket_money_balance: number
  fee_config_base_amount: number | null   // pre-discount base
  fee_config_amount: number | null        // post-discount (using current enrollment discount)
}

export type BulkFilters = {
  academic_year_id?: string
  class_id?: string
  gender?: string
  status?: string
  query?: string
}

async function getStaffFromUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { staff: null, error: 'Not authenticated.' }
  const { data: staff } = await supabase.from('staff').select('id, role').eq('auth_id', user.id).single()
  if (!staff || !['Admin', 'Accountant'].includes(staff.role)) {
    return { staff: null, error: 'Permission denied. Admin or Accountant role required.' }
  }
  return { staff, error: null }
}

export async function getBulkStudentsAction(filters: BulkFilters = {}) {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const yearId = filters.academic_year_id || cookieStore.get('academic_year_id')?.value

  if (!yearId) return { error: 'No Academic Year selected.', students: [], yearId: null }

  const { staff, error: authError } = await getStaffFromUser(supabase)
  if (authError || !staff) return { error: authError, students: [], yearId }

  let dbQuery = supabase
    .from('students')
    .select(`
      id, admission_number, first_name, last_name, gender, status,
      student_enrollments!inner (
        id, class_id, discount_type, discount_mode, discount_value,
        classes (grade_level, section),
        academic_years (name)
      ),
      pocket_money_transactions (transaction_type, amount)
    `)
    .eq('student_enrollments.academic_year_id', yearId)

  const filterStatus = filters.status && filters.status !== 'All' ? filters.status : 'Active'
  dbQuery = dbQuery.eq('status', filterStatus)

  if (filters.class_id && filters.class_id !== 'All') {
    dbQuery = dbQuery.eq('student_enrollments.class_id', filters.class_id)
  }
  if (filters.gender && filters.gender !== 'All') {
    dbQuery = dbQuery.eq('gender', filters.gender)
  }
  if (filters.query) {
    dbQuery = dbQuery.or(
      `first_name.ilike.%${filters.query}%,last_name.ilike.%${filters.query}%,admission_number.ilike.%${filters.query}%`
    )
  }

  const { data, error: dbError } = await dbQuery.order('first_name').limit(500)
  if (dbError) return { error: dbError.message, students: [], yearId }

  const students = data || []
  if (students.length === 0) return { students: [], yearId, error: null }

  const enrollmentIds = students
    .map((s: any) => s.student_enrollments?.[0]?.id)
    .filter(Boolean) as string[]
  const studentIds = students.map((s: any) => s.id) as string[]
  const classIds = [
    ...new Set(students.map((s: any) => s.student_enrollments?.[0]?.class_id).filter(Boolean))
  ] as string[]

  if (enrollmentIds.length === 0) {
    return { students: [], yearId, error: null }
  }

  // Tuition fee invoice detection: only invoices whose title starts with "Tuition Fee |"
  // This is the canonical format: "Tuition Fee | Grade10-A | AY 2025-26"
  // Manually-issued invoices (field trips, etc.) must NOT block auto-pending generation.
  const { data: invoices } = await supabase
    .from('fee_invoices')
    .select('id, enrollment_id, invoice_title, status, total_amount')
    .in('enrollment_id', enrollmentIds)
    .neq('status', 'Cancelled')
    .like('invoice_title', 'Tuition Fee |%')

  const invoiceByEnrollment: Record<string, any> = {}
  for (const inv of (invoices || []) as any[]) {
    if (inv.enrollment_id && !invoiceByEnrollment[inv.enrollment_id]) {
      invoiceByEnrollment[inv.enrollment_id] = inv
    }
  }

  // Fee configs for all relevant classes in this year
  const { data: feeConfigs } = classIds.length > 0
    ? await supabase
        .from('fee_configurations')
        .select('class_id, gender, base_fee_amount')
        .eq('academic_year_id', yearId)
        .in('class_id', classIds)
        .eq('course_stream', 'General')
    : { data: [] }

  const result: BulkStudent[] = students.map((s: any) => {
    const enrollment = s.student_enrollments?.[0]
    const classData = Array.isArray(enrollment?.classes) ? enrollment.classes[0] : enrollment?.classes
    const yearData = Array.isArray(enrollment?.academic_years) ? enrollment.academic_years[0] : enrollment?.academic_years

    const balance = ((s.pocket_money_transactions || []) as any[]).reduce(
      (acc: number, tx: any) => acc + (tx.transaction_type === 'CREDIT' ? Number(tx.amount) : -Number(tx.amount)),
      0
    )

    const existingInvoice = enrollment ? (invoiceByEnrollment[enrollment.id] || null) : null

    let feeConfigBaseAmount: number | null = null
    let feeConfigAmount: number | null = null

    if (enrollment && feeConfigs && feeConfigs.length > 0) {
      const matching = (feeConfigs as any[]).filter(fc => fc.class_id === enrollment.class_id)
      const config = selectFeeConfigurationByGender(matching, s.gender)
      if (config) {
        feeConfigBaseAmount = Number(config.base_fee_amount)
        feeConfigAmount = applyDiscount(
          feeConfigBaseAmount,
          enrollment.discount_mode,
          Number(enrollment.discount_value || 0)
        )
      }
    }

    return {
      id: s.id,
      admission_number: s.admission_number,
      first_name: s.first_name,
      last_name: s.last_name,
      gender: s.gender,
      status: s.status,
      enrollment_id: enrollment?.id || null,
      class_id: enrollment?.class_id || null,
      grade_level: classData?.grade_level || null,
      section: classData?.section || null,
      academic_year_name: yearData?.name || null,
      discount_type: enrollment?.discount_type || 'None',
      discount_mode: enrollment?.discount_mode || 'Percentage',
      discount_value: Number(enrollment?.discount_value || 0),
      existing_invoice: existingInvoice
        ? {
            id: existingInvoice.id,
            title: existingInvoice.invoice_title || 'Fee Invoice',
            status: existingInvoice.status,
            total_amount: Number(existingInvoice.total_amount)
          }
        : null,
      pocket_money_balance: balance,
      fee_config_base_amount: feeConfigBaseAmount,
      fee_config_amount: feeConfigAmount,
    }
  })

  return { students: result, yearId, error: null }
}

export async function updateEnrollmentDiscountsAction(
  updates: { enrollment_id: string; discount_type: string; discount_mode: string; discount_value: number }[]
) {
  if (!updates.length) return { error: null }
  const supabase = await createClient()
  const { staff, error: authError } = await getStaffFromUser(supabase)
  if (authError || !staff) return { error: authError }

  // Execute updates sequentially — Supabase JS doesn't support multi-row UPDATE with varied values
  for (const u of updates) {
    const { error } = await supabase
      .from('student_enrollments')
      .update({
        discount_type: u.discount_type,
        discount_mode: u.discount_mode,
        discount_value: u.discount_value,
      })
      .eq('id', u.enrollment_id)
    if (error) return { error: error.message }
  }

  revalidatePath('/students')
  return { error: null }
}

export async function bulkGenerateInvoicesAction(
  items: {
    student_id: string
    enrollment_id: string | null
    invoice_title: string
    total_amount: number
    due_date: string
  }[]
) {
  if (!items.length) return { error: 'No items to process.', successCount: 0 }

  const supabase = await createClient()
  const { staff, error: authError } = await getStaffFromUser(supabase)
  if (authError || !staff) return { error: authError, successCount: 0 }

  const inserts = items.map(item => ({
    enrollment_id: item.enrollment_id || null,
    student_id: item.student_id,
    invoice_title: item.invoice_title,
    total_amount: item.total_amount,
    due_date: item.due_date,
    status: 'Unpaid' as const,
    created_by: staff.id,
  }))

  const { data, error } = await supabase.from('fee_invoices').insert(inserts).select('id')
  if (error) return { error: error.message, successCount: 0 }

  revalidatePath('/students')
  revalidatePath('/finance/bulk-operations')

  return { successCount: data?.length || items.length, error: null }
}

export async function bulkPocketMoneyAction(
  items: {
    student_id: string
    amount: number
    description: string
    type: 'CREDIT' | 'DEBIT'
    payment_mode: 'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque' | 'Internal Adjustment'
    transaction_reference?: string
  }[]
) {
  if (!items.length) return { error: 'No items to process.', successCount: 0 }

  const supabase = await createClient()
  const { staff, error: authError } = await getStaffFromUser(supabase)
  if (authError || !staff) return { error: authError, successCount: 0 }

  for (const item of items) {
    if (item.type === 'CREDIT' && item.payment_mode !== 'Cash' && !item.transaction_reference?.trim()) {
      return { error: 'Transaction reference is required for non-cash pocket money credits.', successCount: 0 }
    }
  }

  const inserts = items.map(item => ({
    student_id: item.student_id,
    transaction_type: item.type,
    amount: item.amount,
    description: item.description,
    payment_mode: item.payment_mode,
    transaction_reference: item.transaction_reference?.trim() || null,
    logged_by: staff.id,
  }))

  const { error } = await supabase.from('pocket_money_transactions').insert(inserts)
  if (error) return { error: error.message, successCount: 0 }

  revalidatePath('/students')
  return { successCount: items.length, error: null }
}
