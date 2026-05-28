import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PmReceiptDocument } from './PmReceiptDocument'

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

  const rupees = Math.floor(Math.abs(num))
  return convert(rupees)
}

export default async function PmReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  let receivedBy = 'System'
  if (user) {
    const { data: staff } = await supabase.from('staff').select('name').eq('auth_id', user.id).maybeSingle()
    if (staff?.name) receivedBy = staff.name
  }

  const { data: txn, error } = await supabase
    .from('pocket_money_transactions')
    .select('id, receipt_number, student_id, transaction_type, amount, description, payment_mode, transaction_reference, bank_name, balance_after_transaction, created_at, staff:logged_by(name)')
    .eq('id', id)
    .single()

  if (error || !txn) notFound()

  const { data: student } = await supabase
    .from('students')
    .select('first_name, last_name, admission_number')
    .eq('id', txn.student_id)
    .single()

  // Get class from latest enrollment
  const { data: enrollment } = await supabase
    .from('student_enrollments')
    .select('classes(grade_level, section), academic_years(name)')
    .eq('student_id', txn.student_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const cls = enrollment?.classes ? (Array.isArray(enrollment.classes) ? enrollment.classes[0] : enrollment.classes) : null
  const ay = enrollment?.academic_years ? (Array.isArray(enrollment.academic_years) ? enrollment.academic_years[0] : enrollment.academic_years) : null

  return (
    <PmReceiptDocument
      data={{
        receipt_number: txn.receipt_number || 'N/A',
        receipt_date: new Date(txn.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        student_name: student ? `${student.first_name} ${student.last_name}` : 'Unknown',
        student_id: student?.admission_number || 'N/A',
        student_class: cls ? `${(cls as any).grade_level} - ${(cls as any).section}` : 'N/A',
        academic_year: ay ? (ay as any).name : 'N/A',
        transaction_type: txn.transaction_type as 'CREDIT' | 'DEBIT',
        amount: Number(txn.amount),
        description: txn.description,
        balance_after: txn.balance_after_transaction != null ? Number(txn.balance_after_transaction) : null,
        payment_mode: txn.payment_mode || 'Cash',
        bank_name: txn.bank_name || '—',
        reference: txn.transaction_reference || '—',
        amount_in_words: numberToWords(Number(txn.amount)),
        received_by: receivedBy,
      }}
    />
  )
}
