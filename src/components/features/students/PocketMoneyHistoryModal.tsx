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
import { IndianRupee, ArrowDownToLine, ArrowUpFromLine, RefreshCcw } from "lucide-react"
import { getMorePocketMoneyTransactions } from "@/actions/finance.actions"
import { ReceiptUploadAndView } from "./ReceiptUploadAndView"

export function PocketMoneyHistoryModal({ 
  studentId, 
  initialTransactions 
}: { 
  studentId: string
  initialTransactions: any[] 
}) {
  const [transactions, setTransactions] = useState(initialTransactions)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialTransactions.length === 30) // Assuming initial load limit is 30
  
  const loadMore = async () => {
    setIsLoading(true)
    const { data, error } = await getMorePocketMoneyTransactions(studentId, 30, transactions.length)
    if (data && data.length > 0) {
      setTransactions([...transactions, ...data])
      if (data.length < 30) setHasMore(false)
    } else {
      setHasMore(false)
    }
    setIsLoading(false)
  }

  // Add robust balance calculation correctly based exactly on what's fetched so far
  const runningBalance = transactions.reduce((acc, t) => {
    const amount = Number(t.amount)
    return t.transaction_type === 'CREDIT' ? acc + amount : acc - amount
  }, 0)

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" className="w-full justify-start text-left shrink-0" />}>
        <IndianRupee className="mr-2 h-4 w-4" />
        Pocket Money History
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[90vw] md:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="pt-6 px-6 pb-4 shrink-0 border-b bg-white">
          <DialogTitle className="text-2xl flex items-center justify-between">
            Pocket Money Ledger
            <div className={`px-4 py-2 rounded-lg text-lg font-bold border flex items-center shadow-sm
              ${runningBalance >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
              <span className="text-sm font-medium mr-2 opacity-75">Displayed Balance:</span>
              <IndianRupee className="h-5 w-5 mr-1" />
              {Math.abs(runningBalance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              <span className="ml-1.5 text-sm opacity-75">{runningBalance >= 0 ? 'Cr' : 'Dr'}</span>
            </div>
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            Standard tabular ledger of all pocket money deposits and withdrawals.
          </p>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {transactions.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
              <RefreshCcw className="mx-auto h-10 w-10 text-slate-300 mb-4" />
              <p className="text-slate-600 font-medium text-lg">No transactions found</p>
              <p className="text-sm text-slate-400 mt-1">Transactions within the last 30 days will appear here.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white border rounded-xl shadow-sm overflow-hidden text-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="p-4 py-3 w-48">Date & Time</th>
                      <th className="p-4 py-3">Description & Staff</th>
                      <th className="p-4 py-3 text-right w-36">Credit (In)</th>
                      <th className="p-4 py-3 text-right w-36">Debit (Out)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((t: any) => (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="p-4 text-slate-700 font-semibold whitespace-nowrap">
                          {new Date(t.created_at).toLocaleDateString('en-IN', { 
                            day: '2-digit', month: 'short', year: 'numeric'
                          })}
                          <div className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mt-1">
                            {new Date(t.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="p-4 text-slate-800 font-medium">
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-md shrink-0 flex items-center justify-center
                              ${t.transaction_type === 'CREDIT' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                              {t.transaction_type === 'CREDIT' ? (
                                <ArrowDownToLine className="h-3 w-3" />
                              ) : (
                                <ArrowUpFromLine className="h-3 w-3" />
                              )}
                            </div>
                            <span>{t.description}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium mt-2 flex items-center gap-1.5 ml-9.5">
                             <span className="bg-amber-50 text-amber-700 border border-amber-100 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">By</span>
                             <span className="text-slate-700 font-bold">{t.staff?.name || 'System / Unknown'}</span>
                          </div>
                          <div className="ml-9.5 mt-2">
                             <ReceiptUploadAndView 
                                transactionId={t.id} 
                                existingKeys={t.receipt_object_keys} 
                                type="POCKET" 
                                onUploadSuccess={() => window.location.reload()} 
                             />
                          </div>
                        </td>
                        <td className="p-4 text-right font-bold text-emerald-600">
                          {t.transaction_type === 'CREDIT' ? (
                            <span className="flex items-center justify-end">
                              <IndianRupee className="h-3.5 w-3.5 mr-0.5" />
                              {Number(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="p-4 text-right font-bold text-rose-600 bg-rose-50/20">
                          {t.transaction_type === 'DEBIT' ? (
                            <span className="flex items-center justify-end">
                              <IndianRupee className="h-3.5 w-3.5 mr-0.5" />
                              {Number(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {hasMore && (
                <div className="pt-2 text-center pb-6">
                  <Button 
                    variant="outline" 
                    onClick={loadMore} 
                    disabled={isLoading}
                    className="rounded-full px-8 bg-white border-slate-200 shadow-sm hover:bg-slate-50 hover:text-slate-900 text-slate-600 font-medium"
                  >
                    {isLoading ? (
                      <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowDownToLine className="h-4 w-4 mr-2" />
                    )}
                    {isLoading ? 'Fetching historical records...' : 'Fetch More Transactions'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
