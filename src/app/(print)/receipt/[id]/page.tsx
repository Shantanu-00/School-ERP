import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ReceiptDocument } from './ReceiptDocument'

function numberToWords(num: number): string {
  if (num === 0) return 'Zero'
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function convert(n: number): string {
    if (n < 20) return ones[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '')
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '')
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '')
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '')
  }

  const rupees = Math.floor(num)
  const paise = Math.round((num - rupees) * 100)
  let result = convert(rupees)
  if (paise > 0) result += ' and ' + convert(paise) + ' Paise'
  return result
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  let printedByName = 'System'
  if (user) {
    const { data: staff } = await supabase.from('staff').select('name').eq('auth_id', user.id).maybeSingle()
    if (staff?.name) printedByName = staff.name
  }

  const { data: payment, error } = await supabase
    .from('fee_payments')
    .select(`
      id, receipt_number, amount_paid, payment_date, payment_method,
      bank_name, instrument_date, transaction_reference,
      clearance_status, created_at, staff(name),
      fee_invoices(id, invoice_title, total_amount, status, student_id, enrollment_id)
    `)
    .eq('id', id)
    .single()

  if (error || !payment) notFound()

  const inv = payment.fee_invoices as any

  let resolvedStudent: { id: string; first_name: string; last_name: string; admission_number: string } | null = null
  let resolvedCls: { grade_level: string; section: string } | null = null
  let resolvedAy: { name: string } | null = null

  if (inv?.student_id) {
    const { data: stu } = await supabase.from('students').select('id, first_name, last_name, admission_number').eq('id', inv.student_id).single()
    if (stu) resolvedStudent = stu
  }

  if (inv?.enrollment_id) {
    const { data: enr } = await supabase
      .from('student_enrollments')
      .select('student_id, academic_years(name), classes(grade_level, section)')
      .eq('id', inv.enrollment_id)
      .single()

    if (enr) {
      const ayData = Array.isArray(enr.academic_years) ? enr.academic_years[0] : enr.academic_years
      const clsData = Array.isArray(enr.classes) ? enr.classes[0] : enr.classes
      if (ayData) resolvedAy = ayData as any
      if (clsData) resolvedCls = clsData as any
      if (!resolvedStudent && enr.student_id) {
        const { data: stu } = await supabase.from('students').select('id, first_name, last_name, admission_number').eq('id', enr.student_id).single()
        if (stu) resolvedStudent = stu
      }
    }
  }

  const { data: allPayments } = await supabase
    .from('fee_payments')
    .select('amount_paid, clearance_status')
    .eq('invoice_id', inv?.id)

  const isPendingClearance = payment.clearance_status === 'Pending'
  const effectiveTotal = (allPayments || [])
    .filter((p: any) => p.clearance_status === 'Cleared' || p.clearance_status === 'Pending')
    .reduce((a: number, p: any) => a + Number(p.amount_paid), 0)
  const pendingFee = Math.max(0, Number(inv?.total_amount || 0) - effectiveTotal)

  let pocketBalance = 0
  if (resolvedStudent?.id) {
    const { data: pmData } = await supabase.from('pocket_money_balances').select('current_balance').eq('student_id', resolvedStudent.id).maybeSingle()
    pocketBalance = pmData?.current_balance || 0
  }

  return (
    <ReceiptDocument
      data={{
        receipt_number: payment.receipt_number || 'N/A',
        receipt_date: new Date(payment.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        student_name: resolvedStudent ? `${resolvedStudent.first_name} ${resolvedStudent.last_name}` : 'Unknown',
        student_id: resolvedStudent?.admission_number || 'N/A',
        student_class: resolvedCls ? `${resolvedCls.grade_level} - ${resolvedCls.section}` : 'N/A',
        academic_year: resolvedAy?.name || 'N/A',
        fee_particular: inv?.invoice_title || 'Tuition Fee',
        amount_paid: Number(payment.amount_paid),
        pending_fee_balance: pendingFee,
        pocket_money_balance: pocketBalance,
        payment_mode: payment.payment_method || 'Cash',
        bank_name: payment.bank_name || '—',
        utr_number: payment.transaction_reference || '—',
        amount_in_words: numberToWords(Number(payment.amount_paid)),
        received_by: printedByName,
        is_pending_clearance: isPendingClearance,
      }}
    />
  )
}
