import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { IndianRupee } from 'lucide-react'
import { FeeClientTabs } from './FeeClientTabs'
import { BackButton } from '@/components/ui/BackButton'

export default async function FeeHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const studentId = resolvedParams.id
  
  const supabase = await createClient()

  // Extract necessary details about the student
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('first_name, last_name, admission_number')
    .eq('id', studentId)
    .single()

  if (studentError || !student) {
    notFound()
  }

  const { data: allEnrollments } = await supabase
    .from('student_enrollments')
    .select(`id, academic_years(id, name)`)
    .eq('student_id', studentId)

  const enrollmentIds = allEnrollments?.map(e => e.id) || []
  
  let query = supabase
    .from('fee_invoices')
    .select(`
      id, invoice_title, total_amount, status, due_date, created_at, enrollment_id, student_id,
      fee_payments(id, amount_paid, payment_date, payment_method, created_at, receipt_object_keys, staff(name))
    `)
    .order('created_at', { ascending: false })

  if (enrollmentIds.length > 0) {
    query = query.or(`enrollment_id.in.(${enrollmentIds.join(',')}),student_id.eq.${studentId}`)
  } else {
    query = query.eq('student_id', studentId)
  }

  const { data: invs } = await query

  const feeInvoices: any[] = (invs || []).map((inv: any) => {
    const enr = allEnrollments?.find(e => e.id === inv.enrollment_id)
    const ayName = Array.isArray(enr?.academic_years) ? enr?.academic_years[0]?.name : (enr?.academic_years as any)?.name
    return {
      ...inv,
      academic_year: ayName || 'Previous Arrears'
    }
  })

  // Compute totals
  const totalInvoices = feeInvoices.reduce((acc, inv) => acc + Number(inv.total_amount || 0), 0)
  const totalPaid = feeInvoices.reduce((acc, inv) => {
    const paid = inv.fee_payments?.reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0) || 0
    return acc + paid
  }, 0)
  const totalOutstanding = totalInvoices - totalPaid

  // Extract all payments for the timeline
  const allPayments = feeInvoices.flatMap(inv => 
    (inv.fee_payments || []).map((p: any) => ({
      ...p,
      invoice_status: inv.status,
      due_date: inv.due_date,
      invoice_title: inv.invoice_title || 'Fee',
      academic_year: inv.academic_year
    }))
  ).sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between flex-wrap gap-4 items-start sm:items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <BackButton label="Back" />
          <div className="border-l border-slate-200 pl-4">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-none">Financial Ledger</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              {student.first_name} {student.last_name} ({student.admission_number})
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold tracking-widest text-slate-500 uppercase mb-2">Total Invoiced</p>
          <p className="text-3xl font-black text-slate-900 tracking-tight flex items-center">
            <IndianRupee className="h-6 w-6 mr-1 text-slate-400" />
            {totalInvoices.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="bg-emerald-50 relative overflow-hidden p-6 rounded-xl border border-emerald-100 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold tracking-widest text-emerald-700 uppercase mb-2 relative z-10">Total Paid</p>
          <p className="text-3xl font-black text-emerald-800 flex items-center relative z-10 tracking-tight">
            <IndianRupee className="h-6 w-6 mr-1 opacity-70" />
            {totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="bg-rose-50 relative overflow-hidden p-6 rounded-xl border border-rose-100 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold tracking-widest text-rose-700 uppercase mb-2 relative z-10">Total Outstanding</p>
          <p className="text-3xl font-black text-rose-800 flex items-center relative z-10 tracking-tight">
            <IndianRupee className="h-6 w-6 mr-1 opacity-70" />
            {totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      <FeeClientTabs feeInvoices={feeInvoices} allPayments={allPayments} />
    </div>
  )
}
