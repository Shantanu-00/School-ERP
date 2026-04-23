import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getStaffProfile } from '@/actions/payroll.actions'
import { ChevronLeft, Edit2 } from 'lucide-react'
import { StaffEditModal } from './StaffEditModal'

function fmtINR(n: number) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function StaffProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staffData } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle()

  const userRole = staffData?.role
  if (userRole !== 'Admin' && userRole !== 'Accountant') redirect('/students')

  const { teacher, payrollHistory, error } = await getStaffProfile(id)
  if (error || !teacher) notFound()

  const isAdmin = userRole === 'Admin'

  const totalPaid = payrollHistory
    .filter((r: any) => r.status === 'Paid')
    .reduce((s: number, r: any) => s + Number(r.net_paid), 0)

  const statusBadge = (s: string | null) => {
    if (s === 'Paid') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    if (s === 'Pending Approval') return 'bg-amber-100 text-amber-700 border-amber-200'
    return 'bg-slate-100 text-slate-600 border-slate-200'
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Back + title */}
      <div className="flex items-center justify-between">
        <Link
          href="/staff/payroll"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition font-medium"
        >
          <ChevronLeft size={16} /> Back to Payroll
        </Link>
        {isAdmin && (
          <StaffEditModal teacher={teacher} />
        )}
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        {/* Header band */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-8 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-2xl shrink-0">
            {teacher.first_name[0]}{teacher.last_name[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{teacher.first_name} {teacher.last_name}</h1>
            {teacher.designation && <p className="text-blue-100 text-sm mt-0.5">{teacher.designation}</p>}
            <span className={`mt-2 inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
              teacher.status === 'Active' ? 'bg-emerald-400/30 text-white' : 'bg-rose-300/30 text-white'
            }`}>
              {teacher.status}
            </span>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* Employment */}
          <div className="p-5 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Employment</p>
            <InfoRow label="Base Salary" value={fmtINR(teacher.base_salary)} bold />
            <InfoRow label="Hire Date" value={fmtDate(teacher.hire_date)} />
          </div>

          {/* Contact */}
          <div className="p-5 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Contact</p>
            <InfoRow label="Phone" value={teacher.phone_number} />
            <InfoRow label="Email" value={teacher.email} />
          </div>

          {/* Government IDs */}
          <div className="p-5 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Government IDs</p>
            <InfoRow label="PAN" value={teacher.pan_card_number} mono />
            <InfoRow label="Aadhaar" value={teacher.aadhaar_number} mono />
          </div>
        </div>

        {/* Banking */}
        <div className="border-t px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Bank</p>
            <p className="text-sm font-medium text-slate-800">{teacher.bank_name || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Account Holder</p>
            <p className="text-sm font-medium text-slate-800">{teacher.bank_account_name || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Account No.</p>
            <p className="text-sm font-mono font-medium text-slate-800">{teacher.bank_account_number || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">IFSC</p>
            <p className="text-sm font-mono font-medium text-slate-800">{teacher.bank_ifsc_code || '—'}</p>
          </div>
        </div>
      </div>

      {/* Summary stat */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Total Months Recorded</p>
          <p className="text-2xl font-bold text-slate-800">{payrollHistory.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Total Paid Out</p>
          <p className="text-2xl font-bold text-emerald-600">{fmtINR(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Pending / Draft</p>
          <p className="text-2xl font-bold text-amber-600">
            {payrollHistory.filter((r: any) => r.status !== 'Paid').length}
          </p>
        </div>
      </div>

      {/* Payroll History Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold text-slate-800">Payment History</h2>
          <p className="text-xs text-slate-400 mt-0.5">All payroll records for this staff member</p>
        </div>

        {payrollHistory.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No payroll records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Base</th>
                  <th className="px-4 py-3">Bonus</th>
                  <th className="px-4 py-3">Deduction</th>
                  <th className="px-4 py-3">Net Paid</th>
                  <th className="px-4 py-3">Payment Date</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Remarks</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payrollHistory.map((rec: any) => (
                  <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-800">{rec.month_year}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtINR(rec.base_amount)}</td>
                    <td className="px-4 py-3 text-emerald-600 font-medium">
                      {Number(rec.bonus_amount) > 0 ? `+${fmtINR(rec.bonus_amount)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-rose-600 font-medium">
                      {Number(rec.deduction_amount) > 0 ? `-${fmtINR(rec.deduction_amount)}` : '—'}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800">{fmtINR(rec.net_paid)}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {rec.status === 'Paid' ? fmtDate(rec.payment_date) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{rec.payment_mode || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-mono">{rec.transaction_reference || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[160px] truncate">{rec.remarks || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${statusBadge(rec.status)}`}>
                        {rec.status || 'Draft'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value, bold, mono }: { label: string; value: string | null | undefined; bold?: boolean; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-slate-400 text-xs shrink-0">{label}</span>
      <span className={`text-xs text-right break-all ${bold ? 'font-bold text-slate-800' : 'font-medium text-slate-700'} ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </span>
    </div>
  )
}
