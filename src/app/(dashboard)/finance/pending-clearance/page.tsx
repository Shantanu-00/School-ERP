import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { PendingClearanceClient } from './PendingClearanceClient'

export default async function PendingClearancePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!staff || !['Admin', 'Accountant'].includes(staff.role)) {
    redirect('/dashboard')
  }

  const { data: payments } = await supabase
    .from('fee_payments')
    .select(`
      id, receipt_number, amount_paid, payment_date, payment_method,
      bank_name, instrument_date, transaction_reference,
      clearance_status, clearance_date, clearance_remarks,
      created_at, staff(name),
      fee_invoices(
        id, invoice_title, total_amount, student_id, enrollment_id,
        student_enrollments(student_id, academic_years(name), classes(grade_level, section))
      )
    `)
    .eq('clearance_status', 'Pending')
    .order('payment_date', { ascending: true })

  // Collect all student IDs to batch-fetch names
  const studentIds = new Set<string>()
  for (const p of (payments || [])) {
    const inv = (p as any).fee_invoices
    if (inv?.student_id) studentIds.add(inv.student_id)
    const enr = inv?.student_enrollments
    const resolvedEnr = Array.isArray(enr) ? enr[0] : enr
    if (resolvedEnr?.student_id) studentIds.add(resolvedEnr.student_id)
  }

  const { data: studentsData } = studentIds.size > 0
    ? await supabase.from('students').select('id, first_name, last_name, admission_number').in('id', [...studentIds])
    : { data: [] }
  const studentMap = new Map((studentsData || []).map(s => [s.id, s]))

  const mapped = (payments || []).map((p: any) => {
    const inv = p.fee_invoices
    const enrollment = inv?.student_enrollments
    const resolvedEnrollment = Array.isArray(enrollment) ? enrollment[0] : enrollment
    const studentId = inv?.student_id || resolvedEnrollment?.student_id
    const stu = studentId ? studentMap.get(studentId) : null
    const ay = resolvedEnrollment?.academic_years
    const resolvedAy = Array.isArray(ay) ? ay[0] : ay
    const cls = resolvedEnrollment?.classes
    const resolvedCls = Array.isArray(cls) ? cls[0] : cls

    return {
      id: p.id,
      receipt_number: p.receipt_number,
      amount_paid: p.amount_paid,
      payment_date: p.payment_date,
      payment_method: p.payment_method,
      bank_name: p.bank_name,
      instrument_date: p.instrument_date,
      transaction_reference: p.transaction_reference,
      clearance_status: p.clearance_status,
      created_at: p.created_at,
      student_name: stu ? `${stu.first_name} ${stu.last_name}` : 'Unknown',
      admission_number: stu?.admission_number || '',
      invoice_title: inv?.invoice_title || 'Fee',
      academic_year: resolvedAy?.name || 'Unknown',
      class_label: resolvedCls ? `${resolvedCls.grade_level} - ${resolvedCls.section}` : '',
      logged_by_name: p.staff?.name || 'System'
    }
  })

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <BackButton label="Back" />
        <div className="border-l border-slate-200 pl-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-none">Pending Clearance</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Review and update clearance status for Bank Transfer & Cheque payments
          </p>
        </div>
      </div>

      <PendingClearanceClient payments={mapped} />
    </div>
  )
}
