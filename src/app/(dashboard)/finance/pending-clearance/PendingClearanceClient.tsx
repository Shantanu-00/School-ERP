'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, CheckCircle, XCircle, AlertTriangle, IndianRupee, Loader2 } from 'lucide-react'
import { updatePaymentClearance } from '@/actions/finance.actions'

type Payment = {
  id: string
  receipt_number: string | null
  amount_paid: number
  payment_date: string
  payment_method: string
  bank_name: string | null
  instrument_date: string | null
  transaction_reference: string | null
  clearance_status: string
  created_at: string
  student_name: string
  admission_number: string
  invoice_title: string
  academic_year: string
  class_label: string
  logged_by_name: string
}

export function PendingClearanceClient({ payments }: { payments: Payment[] }) {
  const router = useRouter()
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [clearanceDate, setClearanceDate] = useState('')
  const [clearanceRemarks, setClearanceRemarks] = useState('')
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null)
  const [actionType, setActionType] = useState<'Cleared' | 'Bounced' | 'Refunded' | null>(null)

  const today = new Date().toISOString().split('T')[0]

  const handleAction = (paymentId: string, action: 'Cleared' | 'Bounced' | 'Refunded') => {
    setSelectedPayment(paymentId)
    setActionType(action)
    setClearanceDate(today)
    setClearanceRemarks('')
    setError('')
  }

  const confirmAction = async () => {
    if (!selectedPayment || !actionType) return
    setUpdating(selectedPayment)
    setError('')

    const result = await updatePaymentClearance(
      selectedPayment,
      actionType,
      clearanceDate || today,
      clearanceRemarks
    )

    if (result.error) {
      setError(result.error)
    } else {
      setSelectedPayment(null)
      setActionType(null)
      router.refresh()
    }
    setUpdating(null)
  }

  if (payments.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-emerald-400 mb-4" />
        <h3 className="text-lg font-bold text-slate-800 mb-1">All Clear</h3>
        <p className="text-sm text-slate-500">No payments pending clearance at this time.</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center gap-3">
        <Clock size={16} className="text-amber-600 shrink-0" />
        <span className="text-sm text-amber-800">
          <strong>{payments.length}</strong> payment{payments.length !== 1 ? 's' : ''} awaiting clearance verification
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="p-3 pl-5 text-left">Student</th>
                <th className="p-3 text-left">Receipt</th>
                <th className="p-3 text-left">Details</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-left">Bank / Ref</th>
                <th className="p-3 pr-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-3 pl-5">
                    <div className="font-semibold text-slate-800">{p.student_name}</div>
                    <div className="text-[10px] text-slate-400">#{p.admission_number} | {p.class_label}</div>
                  </td>
                  <td className="p-3">
                    {p.receipt_number ? (
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                        {p.receipt_number}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="p-3">
                    <div className="text-xs text-slate-700 font-medium">{p.invoice_title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {p.payment_method} | Paid {new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <span className="font-bold text-slate-900 flex items-center justify-end gap-0.5">
                      <IndianRupee size={12} />
                      {Number(p.amount_paid).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="text-xs text-slate-700 font-medium">{p.bank_name || '—'}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{p.transaction_reference || '—'}</div>
                    {p.instrument_date && (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Inst: {new Date(p.instrument_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </div>
                    )}
                  </td>
                  <td className="p-3 pr-5">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleAction(p.id, 'Cleared')}
                        className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded hover:bg-emerald-100 transition"
                        title="Mark as Cleared"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => handleAction(p.id, 'Bounced')}
                        className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded hover:bg-red-100 transition"
                        title="Mark as Bounced"
                      >
                        Bounce
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Modal */}
      {selectedPayment && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">
              Confirm: Mark as {actionType}
            </h3>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {actionType === 'Cleared' ? 'Clearance Date' : 'Date'}
              </label>
              <input
                type="date"
                value={clearanceDate}
                onChange={e => setClearanceDate(e.target.value)}
                max={today}
                className="w-full border-slate-200 rounded-md p-2.5 border outline-none shadow-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Remarks (Optional)</label>
              <input
                type="text"
                value={clearanceRemarks}
                onChange={e => setClearanceRemarks(e.target.value)}
                placeholder={actionType === 'Bounced' ? 'e.g. Insufficient Funds' : 'e.g. Verified via bank statement'}
                className="w-full border-slate-200 rounded-md p-2.5 border outline-none shadow-sm"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setSelectedPayment(null); setActionType(null) }}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                disabled={updating === selectedPayment}
                className={`flex-1 px-4 py-2 text-white rounded-md font-medium transition flex items-center justify-center gap-2 disabled:opacity-70 ${
                  actionType === 'Cleared' ? 'bg-emerald-600 hover:bg-emerald-700'
                  : actionType === 'Bounced' ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-violet-600 hover:bg-violet-700'
                }`}
              >
                {updating === selectedPayment ? <Loader2 size={16} className="animate-spin" /> : null}
                Confirm {actionType}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
