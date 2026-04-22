'use client'

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { History, IndianRupee, FileText } from "lucide-react"
import { getStudentFeeHistory } from "@/actions/finance.actions"
import { ReceiptUploadAndView } from "./ReceiptUploadAndView"

export function FeeHistoryModal({ studentId, initialInvoices }: { studentId: string; initialInvoices: any[] }) {
  const [invoices, setInvoices] = useState(initialInvoices)
  const [viewMode, setViewMode] = useState<'payments' | 'invoices'>('payments')
  
  // Compute totals
  const totalInvoices = invoices.reduce((acc, inv) => acc + Number(inv.total_amount || 0), 0)
  const totalPaid = invoices.reduce((acc, inv) => {
    const paid = inv.fee_payments?.reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0) || 0
    return acc + paid
  }, 0)
  const totalOutstanding = totalInvoices - totalPaid

  // Extract all payments for the timeline
  const allPayments = invoices.flatMap(inv => 
    (inv.fee_payments || []).map((p: any) => ({
      ...p,
      invoice_status: inv.status,
      due_date: inv.due_date,
      invoice_title: inv.invoice_title || 'Fee',
      academic_year: inv.academic_year || 'Unknown Year'
    }))
  ).sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" className="w-full justify-start text-left text-slate-700 font-medium" />}>
        <History className="mr-2 h-4 w-4" />
        View Detailed Ledger
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl md:max-w-5xl max-h-[85vh] p-0 flex flex-col gap-0 overflow-hidden bg-white border border-slate-200 shadow-2xl rounded-2xl">
        <div className="p-6 border-b border-slate-100 bg-slate-50 shrink-0">
          <DialogTitle className="text-2xl font-bold flex justify-between items-center text-slate-800">
            Financial Ledger & History
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Complete financial history across all academic years including outstanding dues and payment logs.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-2 shrink-0 mb-6">
          <div className="bg-white p-5 rounded-2xl border shadow-sm">
            <p className="text-sm font-semibold tracking-wider text-slate-500 uppercase mb-2">Total Invoiced</p>
            <p className="text-3xl font-extrabold flex items-center text-slate-800">
              <IndianRupee className="h-6 w-6 mr-1 text-slate-400" />
              {totalInvoices.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-100 shadow-sm">
            <p className="text-sm font-semibold tracking-wider text-emerald-600 uppercase mb-2">Total Paid</p>
            <p className="text-3xl font-extrabold text-emerald-700 flex items-center">
              <IndianRupee className="h-6 w-6 mr-1 opacity-70" />
              {totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="bg-rose-50/70 p-5 rounded-2xl border border-rose-100 shadow-sm relative overflow-hidden">
            <p className="text-sm font-semibold tracking-wider text-rose-600 uppercase mb-2 relative z-10">Total Outstanding</p>
            <p className="text-3xl font-extrabold text-rose-700 flex items-center relative z-10">
              <IndianRupee className="h-6 w-6 mr-1 opacity-70" />
              {totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        <div className="flex gap-3 my-2 border-b pb-4">
          <Button 
            variant={viewMode === 'payments' ? 'default' : 'outline'}
            onClick={() => setViewMode('payments')}
            className={`rounded-lg px-6 ${viewMode === 'payments' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <History className="w-4 h-4 mr-2" />
            Timeline & Receipts
          </Button>
          <Button 
            variant={viewMode === 'invoices' ? 'default' : 'outline'}
            onClick={() => setViewMode('invoices')}
            className={`rounded-lg px-6 ${viewMode === 'invoices' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <FileText className="w-4 h-4 mr-2" />
            Yearly Breakdowns
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 pr-2 custom-scrollbar">
          {viewMode === 'payments' && (
            <div className="space-y-4">
              {allPayments.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <FileText className="mx-auto h-10 w-10 text-slate-400 mb-3" />
                  <p className="text-slate-600 font-semibold text-lg">No payment records found.</p>
                </div>
              ) : (
                <div className="bg-white border rounded-xl shadow-sm text-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                        <th className="p-4 w-56">Payment & Record Dates</th>
                        <th className="p-4">Paid Toward</th>
                        <th className="p-4">Method & Staff</th>
                        <th className="p-4 text-right">Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allPayments.map((payment: any, idx: number) => (
                        <tr key={`payment-${payment.id || idx}`} className="hover:bg-slate-50 transition-colors group">
                          <td className="p-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider min-w-12.5 text-center">Paid on</span>
                                <span className="text-slate-700 font-semibold">
                                  {new Date(payment.payment_date).toLocaleDateString('en-IN', { 
                                    day: '2-digit', month: 'short', year: 'numeric'
                                  })}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="bg-blue-50 text-blue-700 border border-blue-100 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider min-w-12.5 text-center">Rec. on</span>
                                <span className="text-slate-500 font-medium text-xs">
                                  {new Date(payment.created_at || payment.payment_date).toLocaleString('en-IN', { 
                                    day: '2-digit', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit', hour12: true
                                  })}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-slate-700 font-medium">
                            <div className="font-semibold text-slate-900">{payment.invoice_title || 'Fee Invoice'}</div>
                            <div className="text-[11px] text-blue-700 font-bold mt-1 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded inline-block">
                              {payment.academic_year || 'Unknown Year'}
                            </div>
                          </td>
                          <td className="p-4 text-slate-700 font-medium">
                            <div className="flex items-center gap-2">
                              <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 border border-slate-200 rounded text-[10px] uppercase tracking-wider">
                                {payment.payment_method || 'Unknown Method'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-medium mt-2 flex items-center gap-1.5">
                              <span className="bg-amber-50 text-amber-700 border border-amber-100 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">By</span>
                              <span className="text-slate-800 font-bold">{payment.staff?.name || 'System / Parent'}</span>
                            </div>
                          </td>
                          <td className="p-4 text-right font-extrabold text-emerald-600 text-lg">
                            <span className="flex items-center justify-end">
                              <IndianRupee className="h-4 w-4 mr-0.5" />
                              {Number(payment.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <div className="flex justify-end mt-1">
                              <ReceiptUploadAndView 
                                transactionId={payment.id} 
                                existingKeys={payment.receipt_object_keys} 
                                type="FEE" 
                                onUploadSuccess={() => window.location.reload()} 
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {viewMode === 'invoices' && (
            <div className="space-y-8">
              {invoices.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <FileText className="mx-auto h-10 w-10 text-slate-400 mb-3" />
                  <p className="text-slate-600 font-semibold text-lg">No invoice records found.</p>
                </div>
              ) : (
                Object.entries(
                  invoices.reduce((acc: any, inv: any) => {
                    const year = inv.academic_year || 'Unknown Year'
                    if (!acc[year]) acc[year] = []
                    acc[year].push(inv)
                    return acc
                  }, {})
                ).map(([year, yearInvoices]: [string, any]) => (
                  <div key={`year-${year}`} className="mb-6">
                    <h3 className="text-lg font-extrabold text-slate-800 mb-4 flex items-center">
                       <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 px-3 py-1 rounded-md text-sm mr-3 font-bold">Year: {year}</span> 
                    </h3>
                    <div className="space-y-4">
                      {yearInvoices.map((inv: any, idx: number) => {
                        const invPaid = inv.fee_payments?.reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0) || 0
                        const invPending = Math.max(0, Number(inv.total_amount) - invPaid)
                        return (
                          <div key={`inv-${inv.id || idx}`} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col md:flex-row group hover:border-blue-400 hover:shadow-md transition-all">
                            <div className="p-5 flex-1 flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-100">
                              <div className="flex items-center justify-between mb-3">
                                <span className={`inline-flex items-center px-3 py-1 rounded-md text-[11px] font-extrabold uppercase tracking-widest
                                  ${inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 
                                    inv.status === 'Partial' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 
                                    'bg-rose-100 text-rose-800 border border-rose-200'}`}>
                                  {inv.status}
                                </span>
                                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider bg-slate-100 px-2 py-1 rounded">
                                  Due: {new Date(inv.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                              <h4 className="text-base font-bold text-slate-800 mb-1">{inv.invoice_title || 'Fee Invoice'}</h4>
                              <p className="text-[11px] text-slate-500 font-medium">Inv ID: <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{inv.id?.split('-')[0]}</span></p>
                              
                              <div className="mt-4 grid grid-cols-3 gap-2">
                                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-0.5">Invoiced</p>
                                  <p className="font-bold text-slate-700 text-sm">₹{Number(inv.total_amount).toLocaleString('en-IN')}</p>
                                </div>
                                <div className="bg-emerald-50 p-2 rounded border border-emerald-100">
                                  <p className="text-[10px] uppercase font-bold text-emerald-600 tracking-widest mb-0.5">Paid</p>
                                  <p className="font-bold text-emerald-700 text-sm">₹{invPaid.toLocaleString('en-IN')}</p>
                                </div>
                                <div className={`p-2 rounded border ${invPending > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                                  <p className={`text-[10px] uppercase font-bold tracking-widest mb-0.5 ${invPending > 0 ? 'text-rose-600' : 'text-slate-500'}`}>Pending</p>
                                  <p className={`font-bold text-sm ${invPending > 0 ? 'text-rose-700' : 'text-slate-700'}`}>₹{invPending.toLocaleString('en-IN')}</p>
                                </div>
                              </div>
                            </div>
                            
                            {/* Payments Panel */}
                            <div className="md:w-80 bg-slate-50 p-5">
                              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center">
                                <History className="w-3 h-3 mr-1.5" /> Record Logs
                              </h4>
                              {(!inv.fee_payments || inv.fee_payments.length === 0) ? (
                                <div className="h-20 flex items-center justify-center border border-dashed border-slate-200 rounded-lg bg-white">
                                  <p className="text-slate-400 font-medium text-xs">No payments yet</p>
                                </div>
                              ) : (
                                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                  {inv.fee_payments.map((payment: any, pIdx: number) => (
                                    <div key={`payment-log-${payment.id || pIdx}`} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
                                      <div className="flex justify-between items-start mb-1.5">
                                        <div>
                                          <div className="text-slate-700 text-xs font-bold">
                                            {new Date(payment.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                          </div>
                                          <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">
                                            {new Date(payment.created_at || payment.payment_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                          </div>
                                        </div>
                                        <span className="font-extrabold text-emerald-600 text-sm">
                                          ₹{Number(payment.amount_paid).toLocaleString('en-IN')}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                                        <span className="text-[9px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                          {payment.payment_method || 'Method'}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-medium truncate ml-2">
                                          {payment.staff?.name || 'System'}
                                        </span>
                                      </div>
                                      <div className="mt-2 border-t border-slate-100 flex justify-end pt-2">
                                        <ReceiptUploadAndView 
                                          transactionId={payment.id} 
                                          existingKeys={payment.receipt_object_keys} 
                                          type="FEE" 
                                          onUploadSuccess={() => window.location.reload()} 
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
