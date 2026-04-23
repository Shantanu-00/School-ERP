'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getAuthStaff(allowedRoles: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', staff: null, supabase: null }

  const { data: staff } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!staff || !allowedRoles.includes(staff.role)) {
    return { error: 'Unauthorized', staff: null, supabase: null }
  }

  return { error: null, staff, supabase }
}

const TEACHER_FIELDS = `
  id, first_name, last_name, base_salary, status, hire_date,
  phone_number, email, designation,
  pan_card_number, aadhaar_number,
  bank_account_name, bank_account_number, bank_ifsc_code, bank_name,
  profile_picture_url
`

export async function getPayrollForMonth(monthYear: string) {
  const { error, supabase } = await getAuthStaff(['Admin', 'Accountant'])
  if (error || !supabase) return { error, teachers: [], payrollRecords: [] }

  // Fetch ALL active teachers + any payroll records for that month
  const [teachersRes, payrollRes] = await Promise.all([
    supabase
      .from('teachers')
      .select(TEACHER_FIELDS)
      .eq('status', 'Active')
      .order('first_name'),
    supabase
      .from('teacher_payroll')
      .select('id, teacher_id, month_year, base_amount, bonus_amount, deduction_amount, net_paid, payment_date, remarks, status, payment_mode, transaction_reference')
      .eq('month_year', monthYear)
  ])

  if (teachersRes.error) return { error: teachersRes.error.message, teachers: [], payrollRecords: [] }
  if (payrollRes.error) return { error: payrollRes.error.message, teachers: [], payrollRecords: [] }

  return { error: null, teachers: teachersRes.data || [], payrollRecords: payrollRes.data || [] }
}

export async function getAllTeachers() {
  const { error, supabase } = await getAuthStaff(['Admin', 'Accountant'])
  if (error || !supabase) return { error, teachers: [] }

  const { data, error: fetchErr } = await supabase
    .from('teachers')
    .select(TEACHER_FIELDS)
    .order('first_name')

  if (fetchErr) return { error: fetchErr.message, teachers: [] }
  return { error: null, teachers: data || [] }
}

export async function getStaffProfile(teacherId: string) {
  const { error, supabase } = await getAuthStaff(['Admin', 'Accountant'])
  if (error || !supabase) return { error, teacher: null, payrollHistory: [] }

  const [teacherRes, historyRes] = await Promise.all([
    supabase
      .from('teachers')
      .select(TEACHER_FIELDS)
      .eq('id', teacherId)
      .single(),
    supabase
      .from('teacher_payroll')
      .select('id, month_year, base_amount, bonus_amount, deduction_amount, net_paid, payment_date, remarks, status, payment_mode, transaction_reference')
      .eq('teacher_id', teacherId)
      .order('payment_date', { ascending: false })
  ])

  if (teacherRes.error) return { error: teacherRes.error.message, teacher: null, payrollHistory: [] }

  return {
    error: null,
    teacher: teacherRes.data,
    payrollHistory: historyRes.data || []
  }
}

export async function savePayrollDrafts(
  rows: Array<{
    teacherId: string
    monthYear: string
    baseAmount: number
    bonusAmount: number
    deductionAmount: number
    netPaid: number
    remarks: string
    status: string
    dbRowId?: string
  }>
) {
  const { error, staff, supabase } = await getAuthStaff(['Admin', 'Accountant'])
  if (error || !supabase || !staff) return { error: error || 'Unauthorized', insertedRows: [] }

  const toInsert = rows.filter(r => !r.dbRowId)
  const toUpdate = rows.filter(r => !!r.dbRowId)

  let insertedRows: Array<{ teacherId: string; dbRowId: string }> = []

  if (toInsert.length > 0) {
    const { data, error: insertErr } = await supabase
      .from('teacher_payroll')
      .insert(
        toInsert.map(r => ({
          teacher_id: r.teacherId,
          month_year: r.monthYear,
          base_amount: r.baseAmount,
          bonus_amount: r.bonusAmount,
          deduction_amount: r.deductionAmount,
          net_paid: r.netPaid,
          payment_date: new Date().toISOString().split('T')[0],
          remarks: r.remarks || null,
          status: r.status,
          logged_by: staff.id,
        }))
      )
      .select('id, teacher_id')

    if (insertErr) return { error: insertErr.message, insertedRows: [] }
    insertedRows = (data || []).map((d: any) => ({ teacherId: d.teacher_id, dbRowId: d.id }))
  }

  for (const row of toUpdate) {
    const { error: updateErr } = await supabase
      .from('teacher_payroll')
      .update({
        base_amount: row.baseAmount,
        bonus_amount: row.bonusAmount,
        deduction_amount: row.deductionAmount,
        net_paid: row.netPaid,
        remarks: row.remarks || null,
        status: row.status,
        logged_by: staff.id,
      })
      .eq('id', row.dbRowId)
      .neq('status', 'Paid') // Never overwrite a Paid row

    if (updateErr) return { error: updateErr.message, insertedRows: [] }
  }

  revalidatePath('/staff/payroll')
  return { error: null, insertedRows }
}

export async function markPayrollAsPaid(params: {
  dbRowId?: string
  teacherId: string
  monthYear: string
  baseAmount: number
  bonusAmount: number
  deductionAmount: number
  netPaid: number
  remarks: string
  paymentDate: string
  paymentMode: string
  transactionReference: string
}) {
  const { error, staff, supabase } = await getAuthStaff(['Admin', 'Accountant'])
  if (error || !supabase || !staff) return { error: error || 'Unauthorized' }

  if (params.dbRowId) {
    const { error: updateErr } = await supabase
      .from('teacher_payroll')
      .update({
        base_amount: params.baseAmount,
        bonus_amount: params.bonusAmount,
        deduction_amount: params.deductionAmount,
        net_paid: params.netPaid,
        payment_date: params.paymentDate,
        remarks: params.remarks || null,
        status: 'Paid',
        payment_mode: params.paymentMode,
        transaction_reference: params.transactionReference || null,
        logged_by: staff.id,
      })
      .eq('id', params.dbRowId)

    if (updateErr) return { error: updateErr.message }
  } else {
    const { error: insertErr } = await supabase
      .from('teacher_payroll')
      .insert({
        teacher_id: params.teacherId,
        month_year: params.monthYear,
        base_amount: params.baseAmount,
        bonus_amount: params.bonusAmount,
        deduction_amount: params.deductionAmount,
        net_paid: params.netPaid,
        payment_date: params.paymentDate,
        remarks: params.remarks || null,
        status: 'Paid',
        payment_mode: params.paymentMode,
        transaction_reference: params.transactionReference || null,
        logged_by: staff.id,
      })

    if (insertErr) return { error: insertErr.message }
  }

  revalidatePath('/staff/payroll')
  return { error: null }
}

function normalizeOptional(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export async function addStaffMember(formData: FormData) {
  const { error, supabase } = await getAuthStaff(['Admin'])
  if (error || !supabase) return { error: error || 'Unauthorized' }

  const first_name = normalizeOptional(formData.get('first_name'))
  const last_name = normalizeOptional(formData.get('last_name'))
  const base_salary = parseFloat(formData.get('base_salary') as string)
  const hire_date = normalizeOptional(formData.get('hire_date'))
  const status = normalizeOptional(formData.get('status')) || 'Active'
  const phone_number = normalizeOptional(formData.get('phone_number'))
  const email = normalizeOptional(formData.get('email'))
  const designation = normalizeOptional(formData.get('designation'))
  const pan_card_number = normalizeOptional(formData.get('pan_card_number'))
  const aadhaar_number = normalizeOptional(formData.get('aadhaar_number'))
  const bank_account_name = normalizeOptional(formData.get('bank_account_name'))
  const bank_account_number = normalizeOptional(formData.get('bank_account_number'))
  const bank_ifsc_code = normalizeOptional(formData.get('bank_ifsc_code'))
  const bank_name = normalizeOptional(formData.get('bank_name'))

  if (!first_name || !last_name) return { error: 'First name and last name are required.' }
  if (isNaN(base_salary) || base_salary < 0) return { error: 'Base salary must be a positive number.' }
  if (!hire_date) return { error: 'Hire date is required.' }

  const { error: insertErr } = await supabase
    .from('teachers')
    .insert({
      first_name, last_name, base_salary, hire_date, status,
      phone_number, email, designation,
      pan_card_number, aadhaar_number,
      bank_account_name, bank_account_number, bank_ifsc_code, bank_name,
    })

  if (insertErr) return { error: insertErr.message }

  revalidatePath('/staff/payroll')
  return { error: null }
}

export async function updateStaffMember(id: string, formData: FormData) {
  const { error, supabase } = await getAuthStaff(['Admin'])
  if (error || !supabase) return { error: error || 'Unauthorized' }

  const first_name = normalizeOptional(formData.get('first_name'))
  const last_name = normalizeOptional(formData.get('last_name'))
  const base_salary = parseFloat(formData.get('base_salary') as string)
  const hire_date = normalizeOptional(formData.get('hire_date'))
  const status = normalizeOptional(formData.get('status')) || 'Active'
  const phone_number = normalizeOptional(formData.get('phone_number'))
  const email = normalizeOptional(formData.get('email'))
  const designation = normalizeOptional(formData.get('designation'))
  const pan_card_number = normalizeOptional(formData.get('pan_card_number'))
  const aadhaar_number = normalizeOptional(formData.get('aadhaar_number'))
  const bank_account_name = normalizeOptional(formData.get('bank_account_name'))
  const bank_account_number = normalizeOptional(formData.get('bank_account_number'))
  const bank_ifsc_code = normalizeOptional(formData.get('bank_ifsc_code'))
  const bank_name = normalizeOptional(formData.get('bank_name'))

  if (!first_name || !last_name) return { error: 'First name and last name are required.' }
  if (isNaN(base_salary) || base_salary < 0) return { error: 'Base salary must be a positive number.' }
  if (!hire_date) return { error: 'Hire date is required.' }

  const { error: updateErr } = await supabase
    .from('teachers')
    .update({
      first_name, last_name, base_salary, hire_date, status,
      phone_number, email, designation,
      pan_card_number, aadhaar_number,
      bank_account_name, bank_account_number, bank_ifsc_code, bank_name,
    })
    .eq('id', id)

  if (updateErr) return { error: updateErr.message }

  revalidatePath('/staff/payroll')
  revalidatePath(`/staff/${id}`)
  return { error: null }
}
