'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ExpenseBillSummaryRow = {
  bill_id: string
  voucher_number: string | null
  payee_name: string
  category: string
  cost_center: string
  status: 'Unpaid' | 'Partial' | 'Paid' | 'Cancelled'
  date_incurred: string
  due_date: string | null
  academic_year_id: string
  total_bill_amount: number
  total_amount_paid: number
  balance_due: number
  logged_by: string | null
  staff_name?: string | null
  created_at: string
  items: ExpenseBillItemRow[]
  payments: ExpensePaymentRow[]
}

export type ExpenseBillItemRow = {
  id: string
  bill_id: string
  description: string
  amount: number
}

export type ExpensePaymentRow = {
  id: string
  bill_id: string
  amount_paid: number
  payment_date: string
  payment_mode: string | null
  transaction_reference: string | null
  receipt_object_keys: string[] | null
  logged_by: string | null
  staff_name?: string | null
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

// ─── Fetch Bills ───────────────────────────────────────────────────────────────

export async function getExpenseBills(academicYearId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('expense_bills')
    .select(`
      id, voucher_number, payee_name, category, status, date_incurred, due_date,
      cost_center, academic_year_id, logged_by, created_at,
      staff!logged_by(name),
      expense_bill_items(id, description, amount),
      expense_payments(id, amount_paid, payment_date, payment_mode, transaction_reference, receipt_object_keys, logged_by)
    `)
    .eq('academic_year_id', academicYearId)
    .order('date_incurred', { ascending: false })

  if (error) return { error: error.message, data: [] as ExpenseBillSummaryRow[] }

  const rows: ExpenseBillSummaryRow[] = (data || []).map((b: any) => {
    const items: ExpenseBillItemRow[] = (b.expense_bill_items || []).map((item: any) => ({
      id: item.id,
      bill_id: b.id,
      description: item.description,
      amount: Number(item.amount),
    }))

    const payments: ExpensePaymentRow[] = (b.expense_payments || []).map((p: any) => ({
      id: p.id,
      bill_id: b.id,
      amount_paid: Number(p.amount_paid),
      payment_date: p.payment_date,
      payment_mode: p.payment_mode ?? null,
      transaction_reference: p.transaction_reference ?? null,
      receipt_object_keys: p.receipt_object_keys ?? null,
      logged_by: p.logged_by ?? null,
    }))

    const total_bill_amount = items.reduce((s, i) => s + i.amount, 0)
    const total_amount_paid = payments.reduce((s, p) => s + p.amount_paid, 0)

    return {
      bill_id: b.id,
      voucher_number: b.voucher_number ?? null,
      payee_name: b.payee_name,
      category: b.category,
      cost_center: b.cost_center,
      status: b.status,
      date_incurred: b.date_incurred,
      due_date: b.due_date ?? null,
      academic_year_id: b.academic_year_id,
      total_bill_amount,
      total_amount_paid,
      balance_due: total_bill_amount - total_amount_paid,
      logged_by: b.logged_by ?? null,
      staff_name: (Array.isArray(b.staff) ? b.staff[0] : b.staff)?.name ?? null,
      created_at: b.created_at,
      items,
      payments,
    }
  })

  return { data: rows }
}

// ─── Fetch Other Income ────────────────────────────────────────────────────────

export async function getOtherIncome(academicYearId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('other_income')
    .select('*, staff!logged_by(name)')
    .eq('academic_year_id', academicYearId)
    .order('date_received', { ascending: false })

  if (error) return { error: error.message, data: [] as OtherIncomeRow[] }

  const rows: OtherIncomeRow[] = (data || []).map((r: any) => ({
    ...r,
    staff_name: r.staff?.name ?? null,
  }))

  return { data: rows }
}

// ─── Create Expense Bill ───────────────────────────────────────────────────────

export async function createExpenseBill(payload: {
  academic_year_id: string
  date_incurred: string
  due_date?: string
  cost_center: string
  category: string
  payee_name: string
  items: Array<{ description: string; amount: number }>
}) {
  if (!payload.items || payload.items.length === 0)
    return { error: 'At least one line item is required.' }

  const MAX_ITEM_ABS = 10_000_000
  for (const item of payload.items) {
    if (!item.description.trim()) return { error: 'Each line item must have a description.' }
    if (item.amount === 0) return { error: 'Line item amount cannot be zero.' }
    if (Math.abs(item.amount) > MAX_ITEM_ABS) return { error: `A single line item cannot exceed ₹${MAX_ITEM_ABS.toLocaleString('en-IN')}.` }
  }
  const billTotal = payload.items.reduce((s, i) => s + i.amount, 0)
  if (billTotal < 0.01) return { error: `Bill total must be greater than ₹0.` }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in.' }

  const { data: staff } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!staff) return { error: 'Staff record not found.' }
  if (!['Admin', 'Accountant'].includes(staff.role))
    return { error: 'Only Admin and Accountant can record expenses.' }

  const { data: bill, error: billErr } = await supabase
    .from('expense_bills')
    .insert({
      academic_year_id: payload.academic_year_id,
      date_incurred: payload.date_incurred,
      due_date: payload.due_date || null,
      cost_center: payload.cost_center,
      category: payload.category,
      payee_name: payload.payee_name,
      logged_by: staff.id,
    })
    .select('id')
    .single()

  if (billErr || !bill) return { error: billErr?.message ?? 'Failed to create bill.' }

  const { error: itemsErr } = await supabase
    .from('expense_bill_items')
    .insert(payload.items.map(item => ({
      bill_id: bill.id,
      description: item.description.trim(),
      amount: item.amount,
    })))

  if (itemsErr) return { error: itemsErr.message }

  revalidatePath('/expenses-ledger')
  return { success: true, billId: bill.id }
}

// ─── Add Line Item to Existing Bill ───────────────────────────────────────────

export async function addBillItem(payload: {
  bill_id: string
  description: string
  amount: number
}) {
  const MAX_ITEM_ABS = 10_000_000
  if (!payload.description.trim()) return { error: 'Description is required.' }
  if (payload.amount === 0) return { error: 'Amount cannot be zero.' }
  if (Math.abs(payload.amount) > MAX_ITEM_ABS) return { error: `Amount cannot exceed ₹${MAX_ITEM_ABS.toLocaleString('en-IN')}.` }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in.' }

  const { data: staff } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!staff) return { error: 'Staff record not found.' }
  if (!['Admin', 'Accountant'].includes(staff.role))
    return { error: 'Only Admin and Accountant can modify bills.' }

  // Fetch current items to validate the new total before inserting
  const { data: existingItems } = await supabase
    .from('expense_bill_items').select('amount').eq('bill_id', payload.bill_id)

  const currentTotal = (existingItems || []).reduce((s: number, i: any) => s + Number(i.amount), 0)
  const newTotal = currentTotal + payload.amount
  if (newTotal < 0.01) return { error: `This adjustment would make the bill total ₹${newTotal.toFixed(2)}, which is invalid. The bill total must stay above ₹0.` }

  const { error: insertErr } = await supabase
    .from('expense_bill_items')
    .insert({ bill_id: payload.bill_id, description: payload.description.trim(), amount: payload.amount })

  if (insertErr) return { error: insertErr.message }

  // Recompute status — re-fetch after insert to get accurate sum
  const [{ data: billItems }, { data: allPayments }] = await Promise.all([
    supabase.from('expense_bill_items').select('amount').eq('bill_id', payload.bill_id),
    supabase.from('expense_payments').select('amount_paid').eq('bill_id', payload.bill_id),
  ])

  const totalBillAmount = (billItems || []).reduce((s: number, i: any) => s + Number(i.amount), 0)
  const totalPaid = (allPayments || []).reduce((s: number, p: any) => s + Number(p.amount_paid), 0)
  const newStatus: 'Paid' | 'Partial' | 'Unpaid' =
    totalPaid >= totalBillAmount && totalBillAmount > 0 ? 'Paid' : totalPaid > 0 ? 'Partial' : 'Unpaid'

  await supabase.from('expense_bills').update({ status: newStatus }).eq('id', payload.bill_id)

  revalidatePath('/expenses-ledger')
  return { success: true }
}

// ─── Record Bill Payment ───────────────────────────────────────────────────────

export async function recordBillPayment(payload: {
  bill_id: string
  amount_paid: number
  payment_date: string
  payment_mode: string
  transaction_reference?: string
  receipt_object_keys?: string[]
}) {
  if (payload.amount_paid <= 0) return { error: 'Payment amount must be greater than zero.' }
  if (payload.amount_paid > 10_000_000) return { error: 'Payment amount is unrealistically large.' }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in.' }

  const { data: staff } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!staff) return { error: 'Staff record not found.' }
  if (!['Admin', 'Accountant'].includes(staff.role))
    return { error: 'Only Admin and Accountant can record payments.' }

  // Validate payment does not exceed remaining balance
  const [{ data: preItems }, { data: prePayments }] = await Promise.all([
    supabase.from('expense_bill_items').select('amount').eq('bill_id', payload.bill_id),
    supabase.from('expense_payments').select('amount_paid').eq('bill_id', payload.bill_id),
  ])
  const preTotalBill = (preItems || []).reduce((s: number, i: any) => s + Number(i.amount), 0)
  const preTotalPaid = (prePayments || []).reduce((s: number, p: any) => s + Number(p.amount_paid), 0)
  const preBalance = preTotalBill - preTotalPaid
  if (payload.amount_paid > preBalance + 0.001) {
    return { error: `Payment of ₹${payload.amount_paid.toFixed(2)} exceeds the balance due of ₹${preBalance.toFixed(2)}.` }
  }

  // 1. Insert the payment
  const { error: payErr } = await supabase
    .from('expense_payments')
    .insert({
      bill_id: payload.bill_id,
      amount_paid: payload.amount_paid,
      payment_date: payload.payment_date,
      payment_mode: payload.payment_mode,
      transaction_reference: payload.transaction_reference || null,
      receipt_object_keys: payload.receipt_object_keys?.length ? payload.receipt_object_keys : null,
      logged_by: staff.id,
    })

  if (payErr) return { error: payErr.message }

  // 2. Atomically recompute status — fetch totals and update in the same action
  const [{ data: billItems }, { data: allPayments }] = await Promise.all([
    supabase.from('expense_bill_items').select('amount').eq('bill_id', payload.bill_id),
    supabase.from('expense_payments').select('amount_paid').eq('bill_id', payload.bill_id),
  ])

  const totalBillAmount = (billItems || []).reduce((s: number, i: any) => s + Number(i.amount), 0)
  const totalPaid = (allPayments || []).reduce((s: number, p: any) => s + Number(p.amount_paid), 0)
  const newStatus: 'Paid' | 'Partial' | 'Unpaid' =
    totalPaid >= totalBillAmount ? 'Paid' : totalPaid > 0 ? 'Partial' : 'Unpaid'

  await supabase
    .from('expense_bills')
    .update({ status: newStatus })
    .eq('id', payload.bill_id)

  revalidatePath('/expenses-ledger')
  return { success: true, newStatus }
}

// ─── Record Other Income ───────────────────────────────────────────────────────

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
  if (!['Admin', 'Accountant'].includes(staff.role))
    return { error: 'Only Admin and Accountant can record capital entries.' }

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

  const [{ data: bills }, { data: income }] = await Promise.all([
    supabase
      .from('expense_bills')
      .select('expense_bill_items(amount)')
      .eq('academic_year_id', academicYearId),
    supabase
      .from('other_income')
      .select('amount')
      .eq('academic_year_id', academicYearId),
  ])

  const totalExpenses = (bills || []).reduce((s: number, b: any) => {
    const itemSum = (b.expense_bill_items || []).reduce((is: number, i: any) => is + Number(i.amount), 0)
    return s + itemSum
  }, 0)
  const totalCapital = (income || []).reduce((s: number, r: any) => s + Number(r.amount), 0)

  return { totalExpenses, totalCapital }
}
