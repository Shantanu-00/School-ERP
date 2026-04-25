'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ExpenseRow = {
  id: string
  voucher_number: string | null
  date_incurred: string
  cost_center: string | null
  payee_name: string | null
  category: string
  payment_mode: string | null
  transaction_reference: string | null
  amount: number
  description: string | null
  receipt_object_keys: string[] | null
  academic_year_id: string
  logged_by: string | null
  updated_by: string | null
  updated_at: string | null
  staff_name?: string | null
  updated_by_name?: string | null
}

export type OtherIncomeRow = {
  id: string
  academic_year_id: string
  income_category: string
  amount: number
  date_received: string
  description: string | null
  logged_by: string | null
  staff_name?: string | null
  created_at: string
}

export type AuditLogRow = {
  id: string
  expense_id: string
  voucher_number: string | null
  changed_at: string
  changed_by_name: string | null
  old_amount: number
  new_amount: number
  old_category: string
  new_category: string
  old_description: string | null
  new_description: string | null
}

// ─── Fetch Expenses ─────────────────────────────────────────────────────────────

export async function getExpenses(academicYearId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('general_expenses')
    .select('*, logged_by_staff:staff!logged_by(name), updated_by_staff:staff!updated_by(name)')
    .eq('academic_year_id', academicYearId)
    .order('date_incurred', { ascending: false })

  if (error) return { error: error.message, data: [] }

  const rows: ExpenseRow[] = (data || []).map((r: any) => ({
    ...r,
    staff_name: r.logged_by_staff?.name ?? null,
    updated_by_name: r.updated_by_staff?.name ?? null,
  }))

  return { data: rows }
}

// ─── Fetch Other Income ─────────────────────────────────────────────────────────

export async function getOtherIncome(academicYearId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('other_income')
    .select('*, staff!logged_by(name)')
    .eq('academic_year_id', academicYearId)
    .order('date_received', { ascending: false })

  if (error) return { error: error.message, data: [] }

  const rows: OtherIncomeRow[] = (data || []).map((r: any) => ({
    ...r,
    staff_name: r.staff?.name ?? null,
  }))

  return { data: rows }
}

// ─── Fetch Audit Logs ─────────────────────────────────────────────────────────

export async function getExpenseAuditLogs(academicYearId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('expense_audit_logs')
    .select('*, staff!changed_by(name)')
    .eq('academic_year_id', academicYearId)
    .order('changed_at', { ascending: false })

  if (error) {
    // Table may not exist yet; return empty gracefully
    return { data: [] }
  }

  const rows: AuditLogRow[] = (data || []).map((r: any) => ({
    ...r,
    changed_by_name: r.staff?.name ?? null,
  }))

  return { data: rows }
}

// ─── Record Expense ─────────────────────────────────────────────────────────────

export async function recordExpense(payload: {
  academic_year_id: string
  date_incurred: string
  cost_center: string
  category: string
  payee_name: string
  amount: number
  payment_mode: string
  transaction_reference?: string
  description?: string
  receipt_object_keys?: string[]
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in.' }

  const { data: staff } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!staff) return { error: 'Staff record not found.' }
  if (!['Admin', 'Accountant'].includes(staff.role)) {
    return { error: 'Only Admin and Accountant can record expenses.' }
  }

  const { error } = await supabase.from('general_expenses').insert({
    academic_year_id: payload.academic_year_id,
    date_incurred: payload.date_incurred,
    cost_center: payload.cost_center,
    category: payload.category,
    payee_name: payload.payee_name || null,
    amount: payload.amount,
    payment_mode: payload.payment_mode,
    transaction_reference: payload.transaction_reference || null,
    description: payload.description || null,
    receipt_object_keys: payload.receipt_object_keys?.length ? payload.receipt_object_keys : null,
    logged_by: staff.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/expenses-ledger')
  return { success: true }
}

// ─── Update Expense ─────────────────────────────────────────────────────────────

export async function updateExpense(
  expenseId: string,
  payload: {
    date_incurred: string
    cost_center: string
    category: string
    payee_name: string
    amount: number
    payment_mode: string
    transaction_reference?: string
    description?: string
  },
  originalExpense: { amount: number; category: string; description: string | null }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in.' }

  const { data: staff } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!staff) return { error: 'Staff record not found.' }
  if (!['Admin', 'Accountant'].includes(staff.role)) {
    return { error: 'Only Admin and Accountant can edit expenses.' }
  }

  // Fetch the current record first for audit
  const { data: current } = await supabase
    .from('general_expenses')
    .select('voucher_number, amount, category, description, academic_year_id')
    .eq('id', expenseId)
    .single()

  if (!current) return { error: 'Expense not found.' }

  const amountChanged = Number(current.amount) !== payload.amount
  const categoryChanged = current.category !== payload.category

  const { error: updateErr } = await supabase
    .from('general_expenses')
    .update({
      date_incurred: payload.date_incurred,
      cost_center: payload.cost_center,
      category: payload.category,
      payee_name: payload.payee_name || null,
      amount: payload.amount,
      payment_mode: payload.payment_mode,
      transaction_reference: payload.transaction_reference || null,
      description: payload.description || null,
      updated_by: staff.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', expenseId)

  if (updateErr) return { error: updateErr.message }

  // Write to audit log if financial fields changed
  if (amountChanged || categoryChanged) {
    await supabase.from('expense_audit_logs').insert({
      expense_id: expenseId,
      academic_year_id: current.academic_year_id,
      voucher_number: current.voucher_number,
      changed_by: staff.id,
      old_amount: Number(current.amount),
      new_amount: payload.amount,
      old_category: current.category,
      new_category: payload.category,
      old_description: current.description,
      new_description: payload.description || null,
    }).then(() => {}) // non-blocking; table might not exist yet
  }

  revalidatePath('/expenses-ledger')
  return { success: true, auditWritten: amountChanged || categoryChanged }
}

// ─── Record Other Income ────────────────────────────────────────────────────────

export async function recordOtherIncome(payload: {
  academic_year_id: string
  income_category: string
  amount: number
  date_received: string
  description?: string
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in.' }

  const { data: staff } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!staff) return { error: 'Staff record not found.' }
  if (!['Admin', 'Accountant'].includes(staff.role)) {
    return { error: 'Only Admin and Accountant can record capital entries.' }
  }

  const { error } = await supabase.from('other_income').insert({
    academic_year_id: payload.academic_year_id,
    income_category: payload.income_category,
    amount: payload.amount,
    date_received: payload.date_received,
    description: payload.description || null,
    logged_by: staff.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/expenses-ledger')
  return { success: true }
}

// ─── Summary ───────────────────────────────────────────────────────────────────

export async function getExpenseLedgerSummary(academicYearId: string) {
  const supabase = await createClient()

  const [{ data: expenses }, { data: income }] = await Promise.all([
    supabase
      .from('general_expenses')
      .select('amount')
      .eq('academic_year_id', academicYearId),
    supabase
      .from('other_income')
      .select('amount')
      .eq('academic_year_id', academicYearId),
  ])

  const totalExpenses = (expenses || []).reduce((s: number, r: any) => s + Number(r.amount), 0)
  const totalCapital = (income || []).reduce((s: number, r: any) => s + Number(r.amount), 0)

  return { totalExpenses, totalCapital }
}
