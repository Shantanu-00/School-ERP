import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { IndianRupee, RefreshCcw, ArrowDownToLine, ArrowUpFromLine, Wallet } from 'lucide-react'
import { getMorePocketMoneyTransactions } from '@/actions/finance.actions'
import { ReceiptUploadAndView } from "@/components/features/students/ReceiptUploadAndView"
import { BackButton } from '@/components/ui/BackButton'

export default async function PocketMoneyLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const studentId = resolvedParams.id
  
  const supabase = await createClient()

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('first_name, last_name, admission_number')
    .eq('id', studentId)
    .single()

  if (studentError || !student) {
    notFound()
  }

  // Get initial transactions (let's say all of them if we want to show a ledger, or chunk it. Here we just fetch enough for a single page view, e.g. 100)
  const { data: txData } = await supabase
    .from('pocket_money_transactions')
    .select('id, amount, description, transaction_type, created_at, logged_by, staff(name), receipt_object_keys')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(100)
    
  const transactions = txData || []

  // Check the actual balance
  const { data: balanceData } = await supabase
    .from('pocket_money_balances')
    .select('current_balance')
    .eq('student_id', studentId)
    .maybeSingle()

  const runningBalance = balanceData?.current_balance || 0

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between flex-wrap gap-4 items-start sm:items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <BackButton label="Back" />
          <div className="border-l border-slate-200 pl-4">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-none">Pocket Money Ledger</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              {student.first_name} {student.last_name} ({student.admission_number})
            </p>
          </div>
        </div>
        
        <div className={`px-5 py-3 rounded-xl text-lg font-bold border flex items-center shadow-inner
          ${runningBalance >= 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
          <span className="text-sm font-semibold tracking-wider uppercase mr-3 opacity-70">Current Balance</span>
          <IndianRupee className="h-5 w-5 mr-1" />
          <span className="text-2xl tracking-tight leading-none">{Math.abs(runningBalance).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
          <span className="ml-2 text-sm opacity-70 font-semibold tracking-wider">{runningBalance >= 0 ? 'Cr' : 'Dr'}</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
          <Wallet className="text-slate-500" size={20} />
          <h2 className="text-lg font-bold text-slate-800 tracking-tight m-0">Recent Transactions</h2>
        </div>

        <div className="p-0 overflow-x-auto">
          {transactions.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-b-xl border-dashed">
              <RefreshCcw className="mx-auto h-10 w-10 text-slate-300 mb-4" />
              <p className="text-slate-600 font-medium text-lg">No transactions found</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-175]">
              <thead>
                <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-xs">
                  <th className="p-4 pl-6">Date & Time</th>
                  <th className="p-4">Description & Staff</th>
                  <th className="p-4 text-center">Receipt</th>
                  <th className="p-4 text-right">Credit (In)</th>
                  <th className="p-4 pr-6 text-right">Debit (Out)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4 pl-6 text-slate-700 font-semibold whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString('en-IN', { 
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                      <div className="text-[10px] text-slate-400 uppercase tracking-wide font-bold mt-1.5 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded inline-block">
                        {new Date(t.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="p-4 text-slate-800 font-medium">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg shrink-0 flex items-center justify-center
                          ${t.transaction_type === 'CREDIT' ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : 'bg-rose-100 text-rose-600 border border-rose-200'}`}>
                          {t.transaction_type === 'CREDIT' ? (
                            <ArrowDownToLine className="h-4 w-4" />
                          ) : (
                            <ArrowUpFromLine className="h-4 w-4" />
                          )}
                        </div>
                        <span className="font-bold text-slate-900">{t.description}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2 md:ml-10.5">
                        <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                          Logged by <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[10px] uppercase tracking-wider">{t.staff?.name || 'System / Parent'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 align-middle text-center">
                      <div className="flex w-full items-center justify-center">
                        <ReceiptUploadAndView 
                          transactionId={t.id} 
                          existingKeys={t.receipt_object_keys} 
                          type="POCKET" 
                        />
                      </div>
                    </td>
                    <td className="p-4 text-right font-black text-emerald-600 text-lg">
                      {t.transaction_type === 'CREDIT' ? (
                        <span className="flex items-center justify-end tracking-tight">
                          <IndianRupee className="h-4 w-4 mr-0.5 opacity-80" />
                          {Number(t.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="p-4 pr-6 text-right font-black text-rose-600 text-lg">
                      {t.transaction_type === 'DEBIT' ? (
                        <span className="flex items-center justify-end tracking-tight">
                          <IndianRupee className="h-4 w-4 mr-0.5 opacity-80" />
                          {Number(t.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  )
}
