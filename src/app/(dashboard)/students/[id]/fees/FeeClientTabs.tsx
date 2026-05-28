'use client'

import React, { useState } from 'react'
import { FileText, History, IndianRupee, ChevronDown, ChevronUp, Clock, CheckCircle, XCircle, AlertTriangle, Printer } from 'lucide-react'
import { ReceiptUploadAndView } from "@/components/features/students/ReceiptUploadAndView"

function ClearanceBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; icon: any; label: string }> = {
    'Cleared': { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle, label: 'Cleared' },
    'Pending': { bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock, label: 'Pending' },
    'Bounced': { bg: 'bg-red-50 text-red-700 border-red-200', icon: XCircle, label: 'Bounced' },
    'Refunded': { bg: 'bg-violet-50 text-violet-700 border-violet-200', icon: AlertTriangle, label: 'Refunded' },
  }
  const cfg = map[status] || map['Pending']
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${cfg.bg}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  )
}

export function FeeClientTabs({ feeInvoices, allPayments }: { feeInvoices: any[], allPayments: any[] }) {
  const [activeTab, setActiveTab] = useState<'invoices' | 'timeline'>('invoices')
  const [expandedPayment, setExpandedPayment] = useState<string | null>(null)

  const toggleExpand = (id: string) => setExpandedPayment(prev => prev === id ? null : id)

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs Header */}
      <div className="flex bg-slate-100/80 p-1.5 rounded-lg w-fit border border-slate-200 shadow-sm">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-5 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'invoices' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
        >
          <FileText size={16} />
          Invoice Breakdowns
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`px-5 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'timeline' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
        >
          <History size={16} />
          Payment Timeline
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-2">
        {activeTab === 'invoices' ? (
          <div>
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="text-slate-500" size={20} />
                <h2 className="text-lg font-bold text-slate-800 tracking-tight m-0">Invoice Based Payments</h2>
              </div>
            </div>

            <div className="p-0 overflow-x-auto">
              {feeInvoices.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-b-xl border-dashed">
                  <FileText className="mx-auto h-10 w-10 text-slate-400 mb-3" />
                  <p className="text-slate-600 font-semibold text-lg">No invoices found.</p>
                </div>
              ) : Object.entries(
                feeInvoices.reduce((acc, inv) => {
                  const year = inv.academic_year || 'Unknown Year';
                  if (!acc[year]) acc[year] = [];
                  acc[year].push(inv);
                  return acc;
                }, {} as Record<string, any[]>)
              ).map(([year, invoices]) => (
                <div key={year} className="border-b-2 border-slate-200 last:border-b-0">
                  <div className="bg-slate-100/80 px-6 py-3 font-black text-slate-700 uppercase tracking-wider text-xs border-b border-slate-200">
                    Academic Year: {year}
                  </div>
                  <table className="w-full text-left border-collapse min-w-175">
                    <thead className="hidden sm:table-header-group">
                      <tr className="text-slate-500 font-bold uppercase tracking-wider text-[10px] bg-slate-50">
                        <th className="p-4 pl-6 py-3">Invoice Details</th>
                        <th className="p-4 py-3">Due Date</th>
                        <th className="p-4 py-3">Status</th>
                        <th className="p-4 pr-6 py-3 text-right">Amounts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(invoices as any[]).map((inv: any) => {
                        const paid = inv.fee_payments
                          ?.filter((p: any) => p.clearance_status === 'Cleared')
                          .reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0) || 0
                        const out = Number(inv.total_amount || 0) - paid
                        const isFullyPaid = out <= 0
                        const isOverdue = !isFullyPaid && new Date(inv.due_date) < new Date()

                        return (
                          <React.Fragment key={`inv-${inv.id}`}>
                            {/* Invoice Row */}
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-4 pl-6 align-top">
                                <div className="font-bold text-slate-900">{inv.invoice_title || 'Fee Invoice'}</div>
                                <div className="text-xs text-slate-500 mt-1">Generated: {new Date(inv.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                              </td>
                              <td className="p-4 align-top">
                                <span className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                                  {new Date(inv.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                                {isOverdue && <div className="text-[10px] text-red-500 font-bold uppercase tracking-wider mt-1 border border-red-200 bg-red-50 px-1.5 py-0.5 rounded inline-block">Overdue</div>}
                              </td>
                              <td className="p-4 align-top">
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                                  inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                                  inv.status === 'Partial' ? 'bg-amber-100 text-amber-800' :
                                  inv.status === 'Cancelled' ? 'bg-slate-200 text-slate-700' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {inv.status}
                                </span>
                              </td>
                              <td className="p-4 pr-6 text-right align-top">
                                <div className="flex flex-col items-end gap-1">
                                  <div className="text-slate-900 font-bold tracking-tight">Total: ₹{Number(inv.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                                  {out > 0 && <div className="text-red-600 font-bold text-xs">Due: ₹{out.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>}
                                </div>
                              </td>
                            </tr>
                            {/* Payments Sub-Rows */}
                            {inv.fee_payments && inv.fee_payments.length > 0 && (
                              <tr className="bg-slate-50/50">
                                <td colSpan={4} className="p-0 pl-12 pr-6 pb-4">
                                  <div className="border-l-2 border-slate-200 pl-4 mt-2 mb-2">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Payments Received</h4>
                                    <div className="flex flex-col gap-2">
                                      {inv.fee_payments.map((p: any) => (
                                        <div key={p.id} className="bg-white border border-slate-100 rounded-lg shadow-sm overflow-hidden">
                                          <div
                                            className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-slate-50/50 transition"
                                            onClick={() => toggleExpand(p.id)}
                                          >
                                            <div className="flex items-center gap-3">
                                              <div className="bg-emerald-50 text-emerald-600 p-1.5 rounded-md border border-emerald-100">
                                                <IndianRupee size={14} />
                                              </div>
                                              <div>
                                                <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                                  ₹{Number(p.amount_paid).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                                  {p.receipt_number && (
                                                    <span className="text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                                                      {p.receipt_number}
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                                                  {new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                  <span className="font-bold text-slate-600">{p.payment_method}</span>
                                                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                  <ClearanceBadge status={p.clearance_status || 'Cleared'} />
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <div className="text-[10px] text-slate-400 font-medium text-right hidden sm:block">
                                                Logged by<br/>
                                                <span className="text-slate-600 font-bold">{p.staff?.name || 'System'}</span>
                                              </div>
                                              <ReceiptUploadAndView
                                                transactionId={p.id}
                                                existingKeys={p.receipt_object_keys}
                                                type="FEE"
                                                onUploadSuccess={() => window.location.reload()}
                                              />
                                              {expandedPayment === p.id ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                            </div>
                                          </div>
                                          {expandedPayment === p.id && (
                                            <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                                              {p.receipt_number && (
                                                <div>
                                                  <span className="text-slate-400 font-medium uppercase tracking-wider block">Receipt #</span>
                                                  <span className="text-slate-800 font-bold">{p.receipt_number}</span>
                                                </div>
                                              )}
                                              {p.bank_name && (
                                                <div>
                                                  <span className="text-slate-400 font-medium uppercase tracking-wider block">Bank</span>
                                                  <span className="text-slate-800 font-bold">{p.bank_name}</span>
                                                </div>
                                              )}
                                              {p.transaction_reference && (
                                                <div>
                                                  <span className="text-slate-400 font-medium uppercase tracking-wider block">Reference/UTR</span>
                                                  <span className="text-slate-800 font-bold">{p.transaction_reference}</span>
                                                </div>
                                              )}
                                              {p.instrument_date && (
                                                <div>
                                                  <span className="text-slate-400 font-medium uppercase tracking-wider block">Instrument Date</span>
                                                  <span className="text-slate-800 font-bold">{new Date(p.instrument_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                </div>
                                              )}
                                              <div>
                                                <span className="text-slate-400 font-medium uppercase tracking-wider block">Clearance</span>
                                                <ClearanceBadge status={p.clearance_status || 'Cleared'} />
                                              </div>
                                              {p.clearance_date && (
                                                <div>
                                                  <span className="text-slate-400 font-medium uppercase tracking-wider block">Cleared On</span>
                                                  <span className="text-slate-800 font-bold">{new Date(p.clearance_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                </div>
                                              )}
                                              {p.clearance_remarks && (
                                                <div className="col-span-2">
                                                  <span className="text-slate-400 font-medium uppercase tracking-wider block">Remarks</span>
                                                  <span className="text-slate-800 font-medium">{p.clearance_remarks}</span>
                                                </div>
                                              )}
                                              <div>
                                                <span className="text-slate-400 font-medium uppercase tracking-wider block">Logged By</span>
                                                <span className="text-slate-800 font-bold">{p.staff?.name || 'System'}</span>
                                              </div>
                                              <div className="flex items-end">
                                                <a
                                                  href={`/receipt/${p.id}`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded hover:bg-blue-100 transition"
                                                >
                                                  <Printer size={10} /> Print Receipt
                                                </a>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
              <History className="text-slate-500" size={20} />
              <h2 className="text-lg font-bold text-slate-800 tracking-tight m-0">Payment Timeline</h2>
            </div>
            
            <div className="p-0 overflow-x-auto">
              {allPayments.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-b-xl border-dashed">
                  <FileText className="mx-auto h-10 w-10 text-slate-400 mb-3" />
                  <p className="text-slate-600 font-semibold text-lg">No payment records found.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-175">
                  <thead>
                    <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-xs">
                      <th className="p-4 pl-6">Payment Date</th>
                      <th className="p-4">Paid Toward</th>
                      <th className="p-4">Method & Status</th>
                      <th className="p-4 text-center">Receipt</th>
                      <th className="p-4 pr-6 text-right">Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allPayments.map((payment: any, idx: number) => (
                      <React.Fragment key={`payment-${payment.id || idx}`}>
                        <tr
                          className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                          onClick={() => toggleExpand(`tl-${payment.id}`)}
                        >
                          <td className="p-4 pl-6 whitespace-nowrap">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider text-center">Paid on</span>
                                <span className="text-slate-800 font-semibold">
                                  {new Date(payment.payment_date).toLocaleDateString('en-IN', {
                                    day: '2-digit', month: 'short', year: 'numeric'
                                  })}
                                </span>
                              </div>
                              {payment.receipt_number && (
                                <span className="text-[10px] text-blue-600 font-bold bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded w-fit">
                                  {payment.receipt_number}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-slate-700">
                            <div className="font-bold text-slate-900">{payment.invoice_title || 'Fee Invoice'}</div>
                            <div className="text-[11px] text-blue-700 font-bold mt-1.5 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded inline-block">
                              {payment.academic_year || 'Unknown Year'}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1.5">
                              <span className="bg-slate-100 text-slate-800 font-bold px-2 py-1 border border-slate-200 rounded text-xs uppercase tracking-wider inline-block w-fit">
                                {payment.payment_method || 'Unknown Method'}
                              </span>
                              <ClearanceBadge status={payment.clearance_status || 'Cleared'} />
                            </div>
                            <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5 font-medium">
                              Logged by: <span className="text-slate-800 font-bold">{payment.staff?.name || 'System'}</span>
                            </div>
                          </td>
                          <td className="p-4 align-middle text-center">
                            <div className="flex w-full items-center justify-center">
                              <ReceiptUploadAndView
                                transactionId={payment.id}
                                existingKeys={payment.receipt_object_keys}
                                type="FEE"
                                onUploadSuccess={() => window.location.reload()}
                              />
                            </div>
                          </td>
                          <td className="p-4 pr-6 text-right">
                            <span className="flex items-center justify-end font-black text-emerald-600 text-xl tracking-tight">
                              <IndianRupee className="h-5 w-5 mr-0.5" />
                              {Number(payment.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                        </tr>
                        {expandedPayment === `tl-${payment.id}` && (
                          <tr className="bg-slate-50/60">
                            <td colSpan={5} className="px-6 py-3">
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-[11px]">
                                {payment.receipt_number && (
                                  <div>
                                    <span className="text-slate-400 font-medium uppercase tracking-wider block">Receipt #</span>
                                    <span className="text-slate-800 font-bold">{payment.receipt_number}</span>
                                  </div>
                                )}
                                {payment.bank_name && (
                                  <div>
                                    <span className="text-slate-400 font-medium uppercase tracking-wider block">Bank</span>
                                    <span className="text-slate-800 font-bold">{payment.bank_name}</span>
                                  </div>
                                )}
                                {payment.transaction_reference && (
                                  <div>
                                    <span className="text-slate-400 font-medium uppercase tracking-wider block">Reference/UTR</span>
                                    <span className="text-slate-800 font-bold">{payment.transaction_reference}</span>
                                  </div>
                                )}
                                {payment.instrument_date && (
                                  <div>
                                    <span className="text-slate-400 font-medium uppercase tracking-wider block">Instrument Date</span>
                                    <span className="text-slate-800 font-bold">{new Date(payment.instrument_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                  </div>
                                )}
                                {payment.clearance_date && (
                                  <div>
                                    <span className="text-slate-400 font-medium uppercase tracking-wider block">Cleared On</span>
                                    <span className="text-slate-800 font-bold">{new Date(payment.clearance_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                  </div>
                                )}
                                {payment.clearance_remarks && (
                                  <div className="col-span-2">
                                    <span className="text-slate-400 font-medium uppercase tracking-wider block">Remarks</span>
                                    <span className="text-slate-800 font-medium">{payment.clearance_remarks}</span>
                                  </div>
                                )}
                                <div className="flex items-end">
                                  <a
                                    href={`/receipt/${payment.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded hover:bg-blue-100 transition"
                                  >
                                    <Printer size={10} /> Print Receipt
                                  </a>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
