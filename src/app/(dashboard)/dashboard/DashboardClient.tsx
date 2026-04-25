'use client'

import { useState, useTransition, useCallback } from 'react'
import Link from 'next/link'
import {
  Users, IndianRupee, TrendingUp, TrendingDown, AlertTriangle,
  GraduationCap, ArrowUpRight, Clock, Receipt, PiggyBank,
  UserCheck, Search, Download, ChevronRight, Loader2, CalendarDays,
  UserX, Wallet, ExternalLink, CircleDollarSign,
  ArrowDownLeft, ArrowUpRight as ArrowUpRightIcon, Banknote, ShieldCheck, BadgeIndianRupee, HandCoins
} from 'lucide-react'
import { getFeeLogs, getPocketMoneyLogs, getDashboardStaffData, getCashflowData } from '@/actions/dashboard.actions'
import { PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer, Legend } from 'recharts'
import { setGlobalAcademicYear } from '@/actions/settings.action'

// ─── Types ──────────────────────────────────────────────────────────────────

type ClassRow = { classId: string; gradeLevel: string; section: string; label: string; activeCount: number; formerCount: number; newAdmissions: number; feesToCollect: number; feesPending: number; feesCollected: number }
type FormerRow = { id: string; name: string; admissionNumber: string; status: string; lastClass: string; lastYear: string; totalOwed: number; totalPaid: number; totalPending: number }
type FeeLog = { id: string; date: string; studentName: string; admissionNumber: string; className: string; invoiceTitle: string; amount: number; method: string | null; reference: string | null; loggedBy: string | null }
type PmLog = { id: string; date: string; studentName: string; admissionNumber: string; type: 'CREDIT' | 'DEBIT'; amount: number; description: string; method: string | null; reference: string | null; loggedBy: string | null }

type StudentData = {
  totalActiveStudents: number; newAdmissions: number
  totalFeesToCollect: number; totalFeesCollected: number; totalCurrentOutstanding: number
  activeStudentsPastArrears: number; classBreakdown: ClassRow[]
  pocketMoney: { totalEscrow: number; negativeCount: number; lowBalanceCount: number; alumniPayable: number; healthDistribution: { healthy: number; low: number; negative: number; total: number }; topDefaulters: { id: string; name: string; balance: number }[] }
} | null

type FormerData = { totalFormer: number; alumniCount: number; dropoutCount: number; withPendingCount: number; clearedCount: number; totalPendingAmount: number; totalCollectedAmount: number; students: FormerRow[] } | null

type MonthBreakdown = { month: string; totalStaff: number; paidCount: number; pendingCount: number; draftCount: number; unprocCount: number; paidAmount: number; totalAmount: number; totalBonus: number; totalDeductions: number }
type StaffRow = { id: string; name: string; designation: string; baseSalary: number; status: string; netPaid: number; bonus: number; deduction: number; paymentMode: string | null; remarks: string | null }
type StaffData = {
  currentMonth: string; activeCount: number; inactiveCount: number; resignedCount: number; terminatedCount: number; totalBaseSalary: number
  thisMonth: { paidCount: number; pendingCount: number; draftCount: number; unprocCount: number; paidAmount: number; pendingAmount: number; draftAmount: number; totalProcessed: number }
  monthlyBreakdown: MonthBreakdown[]; staffDetail: StaffRow[]
} | null

type BDItem = { name: string; value: number }
type ExpRow = { id: string; date: string; category: string; amount: number; costCenter: string; payee: string; voucher: string; mode: string; description: string; reference: string; loggedBy: string | null }
type IncRow = { id: string; date: string; category: string; amount: number; description: string; loggedBy: string | null }
type AuditRow = { id: string; date: string; voucher: string; oldAmount: number; newAmount: number; oldCategory: string; newCategory: string; oldDescription: string; newDescription: string; changedBy: string | null }
type TimeWindow = { amount: number; count: number }
type ExpenseData = {
  totalExpenses: number; expenseCount: number; largeCount: number; totalOtherIncome: number; incomeCount: number; netOutflow: number
  context: { last24h: TimeWindow; last48h: TimeWindow; last7d: TimeWindow; last30d: TimeWindow; yearTotal: TimeWindow }
  byCategory: BDItem[]; byCostCenter: BDItem[]; byPaymentMode: BDItem[]; incomeByCategory: BDItem[]
  allExpenses: ExpRow[]; allIncome: IncRow[]; allAudits: AuditRow[]; auditCount: number; uniqueEditors: number
} | null

type CfSource = { label: string; amount: number; count: number }
type CfTx = { id: string; date: string; source: string; description: string; amount: number; direction: 'in' | 'out' | 'pending'; method: string | null; loggedBy: string | null }
type CashflowData = {
  period: { moneyIn: number; moneyOut: number; net: number; pendingDues: number; pendingDuesCount: number; inSources: CfSource[]; outSources: CfSource[]; txCount: number }
  cumulative: { totalFunds: number; pmHeld: number; pmToCollect: number; usableFunds: number; pendingDues: number; pendingDuesCount: number }
  transactions: CfTx[]; totalTransactions: number; hasMore: boolean
} | null

type Props = {
  academicYear: { id: string; name: string; startDate: string; endDate: string }
  allYears: { id: string; name: string; isActive: boolean }[]
  studentData: StudentData; formerData: FormerData; staffData: StaffData; expenseData: ExpenseData
  initialFeeLogs: FeeLog[]; initialFeeLogsHasMore: boolean
  initialPocketMoneyLogs: PmLog[]; initialPocketMoneyLogsHasMore: boolean
  initialCashflow: CashflowData
  userRole: 'Admin' | 'Accountant' | 'Teacher'; userName: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const INR = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const today = () => new Date().toISOString().split('T')[0]
const ROWS = [10, 25, 50]
const csvEsc = (v: string) => `"${v.replace(/"/g, '""')}"`
const toCSV = (h: string[], r: string[][]) => [h.map(csvEsc).join(','), ...r.map(row => row.map(csvEsc).join(','))].join('\n')
const dlCSV = (name: string, csv: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click() }
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })

// ─── Reusable Components ────────────────────────────────────────────────────

const colorMap: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600 border-blue-100', green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  red: 'bg-red-50 text-red-600 border-red-100', amber: 'bg-amber-50 text-amber-600 border-amber-100',
  purple: 'bg-violet-50 text-violet-600 border-violet-100', slate: 'bg-slate-50 text-slate-600 border-slate-100',
  rose: 'bg-rose-50 text-rose-600 border-rose-100',
}

function Metric({ label, value, sub, icon: I, color = 'blue', href }: { label: string; value: string | number; sub?: string; icon: any; color?: string; href?: string }) {
  const inner = (
    <div className={`bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 flex flex-col gap-1.5 ${href ? 'hover:border-slate-300 hover:shadow-sm cursor-pointer' : ''} transition-all h-full`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide leading-tight">{label}</span>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center border shrink-0 ${colorMap[color] || colorMap.slate}`}><I size={14} strokeWidth={2.2} /></div>
      </div>
      <span className="text-xl font-bold text-slate-900 tracking-tight">{value}</span>
      {sub && <span className="text-[11px] text-slate-400 leading-snug">{sub}</span>}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function Progress({ collected, total, label }: { collected: number; total: number; label?: string }) {
  const pct = total > 0 ? Math.round((collected / total) * 100) : 0
  const bar = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-medium text-slate-700">{label || 'Collection Progress'}</span>
        <span className={`text-sm font-bold ${pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{pct}%</span>
      </div>
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-slate-400 mt-2">
        <span>{INR(collected)} collected</span>
        <span>{INR(Math.max(0, total - collected))} remaining</span>
      </div>
    </div>
  )
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-[15px] font-semibold text-slate-800">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Badge({ status }: { status: string }) {
  const c: Record<string, string> = { Alumni: 'bg-blue-50 text-blue-700 border-blue-200', Dropout: 'bg-rose-50 text-rose-700 border-rose-200' }
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${c[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{status}</span>
}

function PayrollBadge({ status }: { status: string }) {
  const c: Record<string, string> = { 'Paid': 'bg-emerald-50 text-emerald-700 border-emerald-200', 'Pending Approval': 'bg-amber-50 text-amber-700 border-amber-200', 'Draft': 'bg-slate-100 text-slate-600 border-slate-200', 'Not Processed': 'bg-red-50 text-red-600 border-red-200' }
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${c[status] || c['Not Processed']}`}>{status}</span>
}

function TabBar({ tabs, active, onChange }: { tabs: { key: string; label: string; badge?: number | string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex border-b border-slate-200 overflow-x-auto">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap
            ${active === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'}`}>
          {t.label}
          {t.badge !== undefined && (
            <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active === t.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{t.badge}</span>
          )}
        </button>
      ))}
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`p-3 font-medium text-slate-500 text-[11px] uppercase tracking-wider ${className}`}>{children}</th>
}

function DateRangeInput({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  return (<>
    <label className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600">
      From <input type="date" value={from} onChange={e => onFrom(e.target.value)} className="bg-transparent border-none focus:outline-none text-slate-700 text-xs w-[110px]" />
    </label>
    <label className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600">
      To <input type="date" value={to} onChange={e => onTo(e.target.value)} className="bg-transparent border-none focus:outline-none text-slate-700 text-xs w-[110px]" />
    </label>
  </>)
}

function RowsPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <select value={value} onChange={e => onChange(Number(e.target.value))} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400">{ROWS.map(n => <option key={n} value={n}>{n} rows</option>)}</select>
}

function Btn({ onClick, disabled, loading, children, variant = 'primary' }: { onClick: () => void; disabled?: boolean; loading?: boolean; children: React.ReactNode; variant?: 'primary' | 'ghost' }) {
  const cls = variant === 'primary'
    ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
    : 'text-slate-500 hover:text-slate-700 bg-white border border-slate-200 hover:border-slate-300'
  return <button onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition ${cls}`}>{loading ? <Loader2 size={12} className="animate-spin" /> : null}{children}</button>
}

function Dot({ color }: { color: string }) {
  return <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />
}

// ─── Pie Chart Helper ───────────────────────────────────────────────────────

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f43f5e', '#14b8a6', '#6366f1', '#ec4899']

function PieCard({ title, data, total }: { title: string; data: BDItem[]; total: number }) {
  if (data.length === 0) return null
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
      <h4 className="text-sm font-semibold text-slate-700 mb-4">{title}</h4>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} dataKey="value">
            {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <RTooltip formatter={(v: any) => INR(Number(v))} />
          <Legend formatter={(v: string) => <span className="text-[11px] text-slate-600">{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-3 space-y-1.5">
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
          return <div key={d.name} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span className="flex-1 text-slate-600 truncate">{d.name}</span>
            <span className="font-bold text-slate-800">{INR(d.value)}</span>
            <span className="text-slate-400 w-8 text-right">{pct}%</span>
          </div>
        })}
      </div>
    </div>
  )
}

// ─── Expenses Tab (extracted for clarity) ───────────────────────────────────

function ExpensesTab({ ex, academicYear }: { ex: NonNullable<ExpenseData>; academicYear: { name: string } }) {
  const [exTab, setExTab] = useState<'expenses' | 'income' | 'audit'>('expenses')
  const [exLimit, setExLimit] = useState(15)
  const [incLimit, setIncLimit] = useState(15)

  const ctx = ex.context

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-[15px] font-semibold text-slate-800">Expenses & Ledger — {academicYear.name}</h3>
        <Link href="/expenses-ledger" className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition"><ExternalLink size={13} /> Full Ledger</Link>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label="Total Expenses" value={INR(ex.totalExpenses)} sub={`${ex.expenseCount} transactions this year`} icon={TrendingDown} color="red" />
        <Metric label="Other Income" value={INR(ex.totalOtherIncome)} sub={`${ex.incomeCount} entries — capital, not revenue`} icon={TrendingUp} color="purple" />
        <Metric label="Net Outflow" value={INR(Math.abs(ex.netOutflow))} sub={ex.netOutflow > 0 ? 'Expenses exceed income' : 'Income exceeds expenses'} icon={ex.netOutflow > 0 ? TrendingDown : TrendingUp} color={ex.netOutflow > 0 ? 'amber' : 'green'} />
        <Metric label="Audit Edits" value={ex.auditCount} sub={`${ex.uniqueEditors} editor${ex.uniqueEditors !== 1 ? 's' : ''}`} icon={Receipt} color="slate" />
      </div>

      {/* Contextual time windows */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Expense Activity</h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Last 24 Hours', data: ctx.last24h },
            { label: 'Last 48 Hours', data: ctx.last48h },
            { label: 'Last 7 Days', data: ctx.last7d },
            { label: 'Last 30 Days', data: ctx.last30d },
            { label: 'Year Total', data: ctx.yearTotal },
          ].map(w => (
            <div key={w.label} className="bg-slate-50/80 rounded-lg p-3 text-center">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{w.label}</p>
              <p className="text-lg font-bold text-slate-900 mt-1">{INR(w.data.amount)}</p>
              <p className="text-[11px] text-slate-400">{w.data.count} txn{w.data.count !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      </div>

      {ex.largeCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <span className="text-sm text-amber-800"><strong>{ex.largeCount}</strong> transaction{ex.largeCount !== 1 ? 's' : ''} over ₹50,000 — may require admin review</span>
        </div>
      )}

      {/* Pie charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PieCard title="By Category" data={ex.byCategory} total={ex.totalExpenses} />
        <PieCard title="By Cost Center" data={ex.byCostCenter} total={ex.totalExpenses} />
        <PieCard title="By Payment Mode" data={ex.byPaymentMode} total={ex.totalExpenses} />
      </div>

      {/* 3 Sub-tabs: Expenses / Other Income / Audit History */}
      <TabBar tabs={[
        { key: 'expenses', label: 'Expenses', badge: ex.expenseCount },
        { key: 'income', label: 'Other Income', badge: ex.incomeCount },
        { key: 'audit', label: 'Audit History', badge: ex.auditCount },
      ]} active={exTab} onChange={k => setExTab(k as any)} />

      {/* Expenses sub-tab */}
      {exTab === 'expenses' && (
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm"><div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="bg-slate-50/80 border-b border-slate-100">
            <Th className="pl-5 text-left">Date</Th><Th className="text-left">Category</Th><Th className="text-left">Payee</Th><Th className="text-left">Cost Center</Th><Th className="text-right">Amount</Th><Th className="text-left">Mode</Th><Th className="text-left">Voucher</Th><Th className="pr-5 text-left">By</Th>
          </tr></thead><tbody>
            {ex.allExpenses.length === 0 ? <tr><td colSpan={8} className="p-10 text-center text-slate-400">No expenses recorded this year</td></tr>
            : ex.allExpenses.slice(0, exLimit).map(e => (
              <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                <td className="p-3 pl-5 text-xs text-slate-600 whitespace-nowrap">{fmtDate(e.date)}</td>
                <td className="p-3 text-sm font-medium text-slate-800">{e.category}</td>
                <td className="p-3 text-xs text-slate-600 max-w-[120px] truncate" title={e.payee}>{e.payee || '—'}</td>
                <td className="p-3 text-xs text-slate-500">{e.costCenter}</td>
                <td className="p-3 text-right font-bold text-red-600">{INR(e.amount)}</td>
                <td className="p-3 text-xs text-slate-500">{e.mode || '—'}</td>
                <td className="p-3 text-xs text-slate-500">{e.voucher || '—'}</td>
                <td className="p-3 pr-5 text-xs text-slate-500">{e.loggedBy || '—'}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
        {exLimit < ex.allExpenses.length && <div className="p-3 border-t border-slate-100 text-center"><button onClick={() => setExLimit(p => p + 20)} className="text-xs font-medium text-blue-600 hover:text-blue-700">Show More ({ex.allExpenses.length - exLimit} remaining)</button></div>}
        {exLimit >= ex.allExpenses.length && ex.allExpenses.length > 0 && <div className="py-2 text-center text-[11px] text-slate-400 border-t border-slate-50">{ex.allExpenses.length} expense{ex.allExpenses.length !== 1 ? 's' : ''}</div>}
        </div>
      )}

      {/* Other Income sub-tab */}
      {exTab === 'income' && (<>
        {ex.incomeByCategory.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Income by Source</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ex.incomeByCategory.map((c, i) => (
                <div key={c.name} className="bg-violet-50/50 rounded-lg p-3 text-center border border-violet-100/50">
                  <p className="text-[10px] font-medium text-violet-500 uppercase tracking-wider truncate" title={c.name}>{c.name}</p>
                  <p className="text-lg font-bold text-violet-700 mt-1">{INR(c.value)}</p>
                  <p className="text-[11px] text-slate-400">{ex.totalOtherIncome > 0 ? Math.round((c.value / ex.totalOtherIncome) * 100) : 0}% of total</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm"><div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="bg-slate-50/80 border-b border-slate-100">
            <Th className="pl-5 text-left">Date</Th><Th className="text-left">Category</Th><Th className="text-right">Amount</Th><Th className="text-left">Description</Th><Th className="pr-5 text-left">By</Th>
          </tr></thead><tbody>
            {ex.allIncome.length === 0 ? <tr><td colSpan={5} className="p-10 text-center text-slate-400">No other income recorded this year</td></tr>
            : ex.allIncome.slice(0, incLimit).map(i => (
              <tr key={i.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                <td className="p-3 pl-5 text-xs text-slate-600 whitespace-nowrap">{fmtDate(i.date)}</td>
                <td className="p-3 text-sm font-medium text-slate-800">{i.category}</td>
                <td className="p-3 text-right font-bold text-violet-700">{INR(i.amount)}</td>
                <td className="p-3 text-xs text-slate-600 max-w-[200px] truncate" title={i.description}>{i.description || '—'}</td>
                <td className="p-3 pr-5 text-xs text-slate-500">{i.loggedBy || '—'}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
        {incLimit < ex.allIncome.length && <div className="p-3 border-t border-slate-100 text-center"><button onClick={() => setIncLimit(p => p + 20)} className="text-xs font-medium text-blue-600 hover:text-blue-700">Show More ({ex.allIncome.length - incLimit} remaining)</button></div>}
        {incLimit >= ex.allIncome.length && ex.allIncome.length > 0 && <div className="py-2 text-center text-[11px] text-slate-400 border-t border-slate-50">{ex.allIncome.length} entr{ex.allIncome.length !== 1 ? 'ies' : 'y'}</div>}
        </div>
      </>)}

      {/* Audit History sub-tab */}
      {exTab === 'audit' && (<>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Metric label="Total Edits" value={ex.auditCount} sub={`${academicYear.name}`} icon={Receipt} color="slate" />
          <Metric label="Unique Editors" value={ex.uniqueEditors} sub="Staff who made changes" icon={Users} color="blue" />
          <Metric label="Net Impact" value={INR(Math.abs(ex.allAudits.reduce((s, a) => s + (a.newAmount - a.oldAmount), 0)))} sub={(() => { const d = ex.allAudits.reduce((s, a) => s + (a.newAmount - a.oldAmount), 0); return d > 0 ? 'Total increase from edits' : d < 0 ? 'Total decrease from edits' : 'No net change' })()} icon={ex.allAudits.reduce((s, a) => s + (a.newAmount - a.oldAmount), 0) > 0 ? TrendingUp : TrendingDown} color={ex.allAudits.reduce((s, a) => s + (a.newAmount - a.oldAmount), 0) > 0 ? 'red' : 'green'} />
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm"><div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="bg-slate-50/80 border-b border-slate-100">
            <Th className="pl-5 text-left">Date</Th><Th className="text-left">Voucher</Th><Th className="text-left">What Changed</Th><Th className="text-right">Before</Th><Th className="text-right">After</Th><Th className="text-right">Diff</Th><Th className="pr-5 text-left">By</Th>
          </tr></thead><tbody>
            {ex.allAudits.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-slate-400">No expense edits recorded</td></tr>
            : ex.allAudits.map(a => {
              const amtChanged = a.oldAmount !== a.newAmount
              const catChanged = a.oldCategory !== a.newCategory
              const diff = a.newAmount - a.oldAmount
              return (
                <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                  <td className="p-3 pl-5 text-xs text-slate-600 whitespace-nowrap">{fmtDate(a.date)}</td>
                  <td className="p-3 text-xs font-medium text-slate-700">{a.voucher || '—'}</td>
                  <td className="p-3 text-xs text-slate-600">
                    {catChanged && <span>{a.oldCategory} <span className="text-slate-400">→</span> {a.newCategory}</span>}
                    {amtChanged && !catChanged && <span>Amount updated</span>}
                    {!amtChanged && !catChanged && <span className="text-slate-400">Description edited</span>}
                  </td>
                  <td className="p-3 text-right text-slate-500">{INR(a.oldAmount)}</td>
                  <td className="p-3 text-right font-semibold text-slate-800">{INR(a.newAmount)}</td>
                  <td className="p-3 text-right">{amtChanged ? <span className={`font-bold ${diff > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{diff > 0 ? '+' : ''}{INR(diff)}</span> : <span className="text-slate-300">—</span>}</td>
                  <td className="p-3 pr-5 text-xs text-slate-500">{a.changedBy || '—'}</td>
                </tr>
              )
            })}
          </tbody></table>
        </div></div>
      </>)}
    </div>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────

export function DashboardClient({ academicYear, allYears, studentData: d, formerData: f, staffData: initialStaff, expenseData: ex, initialFeeLogs, initialFeeLogsHasMore, initialPocketMoneyLogs, initialPocketMoneyLogsHasMore, initialCashflow, userRole, userName }: Props) {
  const [mainTab, setMainTab] = useState<'overview' | 'students' | 'staff' | 'expenses'>('overview')
  const [subTab, setSubTab] = useState<'overview' | 'active' | 'former' | 'pocket'>('overview')
  const [isPending, startTransition] = useTransition()
  const isFinance = userRole === 'Admin' || userRole === 'Accountant'

  const [staff, setStaff] = useState(initialStaff)
  const [staffRange, setStaffRange] = useState('current')
  const [staffLoading, setStaffLoading] = useState(false)

  const [cf, setCf] = useState(initialCashflow)
  const [cfPreset, setCfPreset] = useState<string>('today')
  const [cfFrom, setCfFrom] = useState(today())
  const [cfTo, setCfTo] = useState(today())
  const [cfBusy, setCfBusy] = useState(false)
  const [cfTxs, setCfTxs] = useState<CfTx[]>(initialCashflow?.transactions || [])
  const [cfTxMore, setCfTxMore] = useState(initialCashflow?.hasMore || false)
  const [cfFilter, setCfFilter] = useState<'all' | 'in' | 'out' | 'pending'>('all')

  const [fl, setFl] = useState(initialFeeLogs)
  const [flMore, setFlMore] = useState(initialFeeLogsHasMore)
  const [flFrom, setFlFrom] = useState(today())
  const [flTo, setFlTo] = useState(today())
  const [flBusy, setFlBusy] = useState(false)
  const [flRows, setFlRows] = useState(10)

  const [pl, setPl] = useState(initialPocketMoneyLogs)
  const [plMore, setPlMore] = useState(initialPocketMoneyLogsHasMore)
  const [plFrom, setPlFrom] = useState(today())
  const [plTo, setPlTo] = useState(today())
  const [plBusy, setPlBusy] = useState(false)
  const [plRows, setPlRows] = useState(10)

  const yearChange = (id: string) => startTransition(() => setGlobalAcademicYear(id))

  const loadFl = useCallback(async (from: string, to: string, lim: number, append = false) => { setFlBusy(true); const r = await getFeeLogs(from, to, append ? fl.length : 0, lim); setFl(append ? p => [...p, ...(r.data || [])] : r.data || []); setFlMore(r.hasMore || false); setFlBusy(false) }, [fl.length])
  const loadPl = useCallback(async (from: string, to: string, lim: number, append = false) => { setPlBusy(true); const r = await getPocketMoneyLogs(from, to, append ? pl.length : 0, lim); setPl(append ? p => [...p, ...(r.data || [])] : r.data || []); setPlMore(r.hasMore || false); setPlBusy(false) }, [pl.length])
  const loadStaff = useCallback(async (range: string) => { setStaffLoading(true); const r = await getDashboardStaffData(range); if (r.data) setStaff(r.data); setStaffLoading(false) }, [])
  const handleStaffRange = (range: string) => { setStaffRange(range); loadStaff(range) }

  const cfDateRange = useCallback((preset: string): [string, string] => {
    const now = new Date()
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    const sub = (days: number) => { const x = new Date(); x.setDate(x.getDate() - days); return fmt(x) }
    switch (preset) {
      case 'today': return [fmt(now), fmt(now)]
      case 'week': return [sub(7), fmt(now)]
      case 'month': return [sub(30), fmt(now)]
      case 'year': return [sub(365), fmt(now)]
      case '2y': return [sub(730), fmt(now)]
      case 'ytd': { const jan1 = new Date(now.getFullYear(), 0, 1); return [fmt(jan1), fmt(now)] }
      case 'all': return ['2000-01-01', fmt(now)]
      default: return [fmt(now), fmt(now)]
    }
  }, [])

  const loadCf = useCallback(async (from: string, to: string, append = false) => {
    setCfBusy(true)
    const r = await getCashflowData(from, to, append ? cfTxs.length : 0, 20)
    if (r.data) {
      setCf(r.data)
      setCfTxs(append ? prev => [...prev, ...r.data!.transactions] : r.data.transactions)
      setCfTxMore(r.data.hasMore)
    }
    setCfBusy(false)
  }, [cfTxs.length])

  const handleCfPreset = useCallback((preset: string) => {
    setCfPreset(preset)
    if (preset === 'custom') return
    const [from, to] = cfDateRange(preset)
    setCfFrom(from); setCfTo(to)
    loadCf(from, to)
  }, [cfDateRange, loadCf])

  const csvFl = () => dlCSV(`fee-payments_${flFrom}_${flTo}.csv`, toCSV(['Date', 'Student', 'Adm#', 'Class', 'Invoice', 'Amount', 'Method', 'Ref', 'By'], fl.map(l => [l.date, l.studentName, l.admissionNumber, l.className, l.invoiceTitle, l.amount + '', l.method || '', l.reference || '', l.loggedBy || ''])))
  const csvPl = () => dlCSV(`pocket-money_${plFrom}_${plTo}.csv`, toCSV(['Date', 'Student', 'Adm#', 'Type', 'Amount', 'Desc', 'Method', 'Ref', 'By'], pl.map(l => [l.date, l.studentName, l.admissionNumber, l.type, l.amount + '', l.description, l.method || '', l.reference || '', l.loggedBy || ''])))
  const csvCf = () => dlCSV(`cashflow_${cfFrom}_${cfTo}.csv`, toCSV(['Date', 'Direction', 'Source', 'Description', 'Amount', 'Method', 'By'], cfTxs.map(t => [t.date, t.direction === 'in' ? 'Money In' : 'Money Out', t.source, t.description, t.amount + '', t.method || '', t.loggedBy || ''])))
  const csvCls = () => d && dlCSV(`class-breakdown_${academicYear.name}.csv`, toCSV(['Class', 'Active', 'Former', 'New', 'To Collect', 'Collected', 'Pending'], d.classBreakdown.map(c => [c.label, c.activeCount + '', c.formerCount + '', c.newAdmissions + '', c.feesToCollect + '', c.feesCollected + '', c.feesPending + ''])))
  const csvFmr = () => f && dlCSV('former-students.csv', toCSV(['Student', 'Adm#', 'Status', 'Last Class', 'Last Year', 'Owed', 'Paid', 'Pending'], f.students.map(s => [s.name, s.admissionNumber, s.status, s.lastClass, s.lastYear, s.totalOwed + '', s.totalPaid + '', s.totalPending + ''])))

  // Derived staff numbers
  const unprocessedBaseSalary = staff ? staff.staffDetail.filter(s => s.status === 'Not Processed').reduce((sum, s) => sum + s.baseSalary, 0) : 0
  const processedCount = staff ? staff.thisMonth.paidCount + staff.thisMonth.pendingCount + staff.thisMonth.draftCount : 0

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 pb-16 max-w-[1400px]">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">Welcome back, {userName}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
            <CalendarDays size={15} className="text-slate-400 shrink-0" />
            <select value={academicYear.id} onChange={e => yearChange(e.target.value)} disabled={isPending} className="text-sm font-medium text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer disabled:opacity-50">
              {allYears.map(y => <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' (Active)' : ''}</option>)}
            </select>
          </div>
          {isPending && <Loader2 size={15} className="animate-spin text-blue-500" />}
        </div>
      </div>

      {/* ── Main Tabs ──────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-100/80 p-1 rounded-lg w-fit">
        {[{ key: 'overview' as const, label: 'Overview' }, ...(isFinance ? [{ key: 'students' as const, label: 'Students' }, { key: 'staff' as const, label: 'Staff' }, { key: 'expenses' as const, label: 'Expenses & Ledger' }] : [])].map(t =>
          <button key={t.key} onClick={() => setMainTab(t.key)} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${mainTab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t.label}</button>
        )}
      </div>

      {/* ════════ OVERVIEW ════════ */}
      {mainTab === 'overview' && (<div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Students card */}
          <button onClick={() => { if (isFinance) { setMainTab('students'); setSubTab('overview') } }} className="text-left">
            <div className="bg-white rounded-xl border border-slate-200/80 p-6 hover:shadow-md hover:border-blue-200 transition-all group h-full">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center"><Users size={20} className="text-blue-600" /></div>
                <div className="flex-1 min-w-0"><h3 className="text-[15px] font-semibold text-slate-900">Students</h3><p className="text-xs text-slate-400">Enrollment & fees</p></div>
                {isFinance && <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />}
              </div>
              {d && <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-50/80 rounded-lg p-3"><p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Active</p><p className="text-xl font-bold text-slate-900 mt-1">{d.totalActiveStudents}</p></div>
                <div className="bg-slate-50/80 rounded-lg p-3"><p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Former</p><p className="text-xl font-bold text-slate-500 mt-1">{f?.totalFormer || 0}</p></div>
                {isFinance && <>
                  <div className="bg-emerald-50/60 rounded-lg p-3"><p className="text-[10px] font-medium text-emerald-600/70 uppercase tracking-wider">Collected</p><p className="text-lg font-bold text-emerald-700 mt-1">{INR(d.totalFeesCollected)}</p></div>
                  <div className="bg-red-50/60 rounded-lg p-3"><p className="text-[10px] font-medium text-red-500/70 uppercase tracking-wider">Fees Pending</p><p className="text-lg font-bold text-red-600 mt-1">{INR(d.totalCurrentOutstanding)}</p></div>
                </>}
              </div>}
            </div>
          </button>

          {/* Staff card — links to Staff tab */}
          {isFinance && (
            <button onClick={() => setMainTab('staff')} className="text-left">
              <div className="bg-white rounded-xl border border-slate-200/80 p-6 hover:shadow-md hover:border-violet-200 transition-all group h-full flex flex-col">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center"><CircleDollarSign size={20} className="text-violet-600" /></div>
                  <div className="flex-1"><h3 className="text-[15px] font-semibold text-slate-900">Staff & Payroll</h3><p className="text-xs text-slate-400">{staff?.currentMonth || 'Current month'}</p></div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-violet-500 transition-colors shrink-0" />
                </div>
                {staff ? (
                  <div className="grid grid-cols-2 gap-2.5 flex-1">
                    <div className="bg-slate-50/80 rounded-lg p-3">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Active Staff</p>
                      <p className="text-xl font-bold text-slate-900 mt-1">{staff.activeCount}</p>
                    </div>
                    <div className="bg-slate-50/80 rounded-lg p-3">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Processed</p>
                      <p className="text-xl font-bold text-slate-900 mt-1">{processedCount}<span className="text-sm font-medium text-slate-400">/{staff.activeCount}</span></p>
                    </div>
                    <div className="bg-emerald-50/60 rounded-lg p-3">
                      <p className="text-[10px] font-medium text-emerald-600/70 uppercase tracking-wider">Paid</p>
                      <p className="text-lg font-bold text-emerald-700 mt-1">{INR(staff.thisMonth.paidAmount)}</p>
                    </div>
                    <div className={`${staff.thisMonth.unprocCount > 0 ? 'bg-amber-50/60' : 'bg-slate-50/80'} rounded-lg p-3`}>
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Remaining</p>
                      <p className={`text-lg font-bold mt-1 ${unprocessedBaseSalary > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{unprocessedBaseSalary > 0 ? `~${INR(unprocessedBaseSalary)}` : 'All done'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center bg-slate-50/60 rounded-lg"><p className="text-sm text-slate-400 py-6">View staff payroll details</p></div>
                )}
              </div>
            </button>
          )}

          {/* Expenses card */}
          {isFinance && (
            <button onClick={() => setMainTab('expenses')} className="text-left">
              <div className="bg-white rounded-xl border border-slate-200/80 p-6 hover:shadow-md hover:border-rose-200 transition-all group h-full flex flex-col">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center"><Receipt size={20} className="text-rose-600" /></div>
                  <div className="flex-1"><h3 className="text-[15px] font-semibold text-slate-900">Expenses & Ledger</h3><p className="text-xs text-slate-400">{academicYear.name}</p></div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-rose-500 transition-colors shrink-0" />
                </div>
                {ex ? (
                  <div className="grid grid-cols-2 gap-2.5 flex-1">
                    <div className="bg-red-50/60 rounded-lg p-3"><p className="text-[10px] font-medium text-red-500/70 uppercase tracking-wider">Expenses</p><p className="text-lg font-bold text-red-600 mt-1">{INR(ex.totalExpenses)}</p></div>
                    <div className="bg-violet-50/60 rounded-lg p-3"><p className="text-[10px] font-medium text-violet-600/70 uppercase tracking-wider">Other Income</p><p className="text-lg font-bold text-violet-700 mt-1">{INR(ex.totalOtherIncome)}</p></div>
                    <div className="bg-slate-50/80 rounded-lg p-3"><p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Transactions</p><p className="text-xl font-bold text-slate-900 mt-1">{ex.expenseCount + ex.incomeCount}</p></div>
                    <div className={`${ex.netOutflow > 0 ? 'bg-amber-50/60' : 'bg-emerald-50/60'} rounded-lg p-3`}><p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Difference</p><p className={`text-lg font-bold mt-1 ${ex.netOutflow > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{INR(Math.abs(ex.netOutflow))}</p></div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center bg-slate-50/60 rounded-lg"><p className="text-sm text-slate-400 py-6">View expense records</p></div>
                )}
              </div>
            </button>
          )}

          {!isFinance && <>
            <Link href="/students"><div className="bg-white rounded-xl border border-slate-200/80 p-6 hover:shadow-md transition-all group h-full"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center"><GraduationCap size={20} className="text-emerald-600" /></div><div><h3 className="text-[15px] font-semibold text-slate-900">My Students</h3><p className="text-xs text-slate-400">View details</p></div><ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-emerald-500 transition-colors" /></div></div></Link>
            <div className="bg-white rounded-xl border border-slate-200/80 p-6 flex items-center justify-center"><p className="text-sm text-slate-400">Financial details restricted to Admin & Accountant.</p></div>
          </>}
        </div>

        {/* ── Money In & Out Section ────────────────────────────────── */}
        {isFinance && cf && (<div className="space-y-5">

          {/* Header + Period Picker */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-slate-900">Money In & Out</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex bg-white border border-slate-200 p-0.5 rounded-lg shadow-sm">
                {[
                  { key: 'today', label: 'Today' }, { key: 'week', label: '7 Days' }, { key: 'month', label: '30 Days' },
                  { key: 'year', label: '1 Year' }, { key: '2y', label: '2 Years' }, { key: 'ytd', label: 'This Year' }, { key: 'all', label: 'All Time' },
                ].map(p => (
                  <button key={p.key} onClick={() => handleCfPreset(p.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${cfPreset === p.key ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                    {p.label}
                  </button>
                ))}
                <button onClick={() => setCfPreset('custom')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${cfPreset === 'custom' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                  Custom
                </button>
              </div>
              {cfBusy && <Loader2 size={14} className="animate-spin text-blue-500" />}
            </div>
          </div>

          {cfPreset === 'custom' && (
            <div className="flex items-center gap-2 flex-wrap">
              <DateRangeInput from={cfFrom} to={cfTo} onFrom={setCfFrom} onTo={setCfTo} />
              <Btn onClick={() => loadCf(cfFrom, cfTo)} disabled={cfBusy} loading={cfBusy}><Search size={12} /> Apply</Btn>
            </div>
          )}

          {/* ── School Balance Cards ─────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><Banknote size={16} className="text-blue-600" /></div>
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Cash in Hand</span>
              </div>
              <p className={`text-2xl font-bold ${cf.cumulative.totalFunds >= 0 ? 'text-slate-900' : 'text-red-600'}`}>{INR(cf.cumulative.totalFunds)}</p>
              <p className="text-[10px] text-slate-400 mt-1">All money received minus spent</p>
            </div>

            <div className="bg-white rounded-xl border border-orange-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center"><HandCoins size={16} className="text-orange-500" /></div>
                <span className="text-[11px] font-medium text-orange-400 uppercase tracking-wide">Students&apos; Money</span>
              </div>
              <p className="text-2xl font-bold text-orange-500">{INR(cf.cumulative.pmHeld)}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                {cf.cumulative.pmHeld > 0 ? 'Pocket money we hold for students' : 'No pocket money deposits'}
                {cf.cumulative.pmToCollect > 0 && <span className="block text-red-500 font-medium mt-0.5">{INR(cf.cumulative.pmToCollect)} to collect back from students</span>}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-green-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center"><ShieldCheck size={16} className="text-green-600" /></div>
                <span className="text-[11px] font-medium text-green-500 uppercase tracking-wide">School Can Use</span>
              </div>
              <p className={`text-2xl font-bold ${cf.cumulative.usableFunds >= 0 ? 'text-green-600' : 'text-red-600'}`}>{INR(cf.cumulative.usableFunds)}</p>
              <p className="text-[10px] text-slate-400 mt-1">{cf.cumulative.pmHeld > 0 ? 'Cash minus students\' pocket money' : 'No student money being held'}</p>
            </div>

            <div className={`bg-white rounded-xl border p-4 shadow-sm ${cf.cumulative.pendingDues > 0 ? 'border-red-200' : 'border-green-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cf.cumulative.pendingDues > 0 ? 'bg-red-50' : 'bg-green-50'}`}><Clock size={16} className={cf.cumulative.pendingDues > 0 ? 'text-red-500' : 'text-green-600'} /></div>
                <span className={`text-[11px] font-medium uppercase tracking-wide ${cf.cumulative.pendingDues > 0 ? 'text-red-400' : 'text-green-500'}`}>Fees Pending</span>
              </div>
              <p className={`text-2xl font-bold ${cf.cumulative.pendingDues > 0 ? 'text-red-500' : 'text-green-600'}`}>{cf.cumulative.pendingDues > 0 ? INR(cf.cumulative.pendingDues) : 'All Clear'}</p>
              <p className="text-[10px] text-slate-400 mt-1">{cf.cumulative.pendingDuesCount > 0 ? `${cf.cumulative.pendingDuesCount} unpaid bill${cf.cumulative.pendingDuesCount !== 1 ? 's' : ''}` : 'All fees collected'}</p>
            </div>
          </div>

          {/* ── Money In / Money Out ─────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Money Received */}
            <div className="bg-gradient-to-br from-green-50 to-white rounded-xl border border-green-200 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center"><ArrowDownLeft size={20} className="text-green-600" /></div>
                <div className="flex-1"><h4 className="text-[15px] font-bold text-slate-900">Money Received</h4>
                <p className="text-[11px] text-slate-400">{cfPreset === 'today' ? 'Today' : cfPreset === 'custom' ? `${cfFrom} to ${cfTo}` : cfPreset === 'week' ? 'Last 7 days' : cfPreset === 'month' ? 'Last 30 days' : cfPreset === 'year' ? 'Last 1 year' : cfPreset === '2y' ? 'Last 2 years' : cfPreset === 'ytd' ? 'This year' : 'All time'}</p></div>
                <span className="text-2xl font-bold text-green-600">{INR(cf.period.moneyIn)}</span>
              </div>
              <div className="space-y-3">
                {cf.period.inSources.map((s, i) => {
                  const icons = [<BadgeIndianRupee key="f" size={14} />, <Banknote key="o" size={14} />, <PiggyBank key="p" size={14} />]
                  const colors = ['text-green-600 bg-green-100', 'text-purple-600 bg-purple-100', 'text-orange-500 bg-orange-100']
                  const barColors = ['bg-green-500', 'bg-purple-500', 'bg-orange-400']
                  const pct = cf.period.moneyIn > 0 ? Math.round((s.amount / cf.period.moneyIn) * 100) : 0
                  return (
                    <div key={s.label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${colors[i]}`}>{icons[i]}</div>
                          <span className="text-xs font-medium text-slate-700">{s.label}</span>
                          <span className="text-[10px] text-slate-400 bg-white/80 border border-slate-100 px-1.5 py-0.5 rounded">{s.count} txn</span>
                        </div>
                        <span className="text-sm font-bold text-slate-800">{INR(s.amount)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-green-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColors[i]} transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Money Spent */}
            <div className="bg-gradient-to-br from-red-50 to-white rounded-xl border border-red-200 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center"><ArrowUpRightIcon size={20} className="text-red-500" /></div>
                <div className="flex-1"><h4 className="text-[15px] font-bold text-slate-900">Money Spent</h4>
                <p className="text-[11px] text-slate-400">{cfPreset === 'today' ? 'Today' : cfPreset === 'custom' ? `${cfFrom} to ${cfTo}` : cfPreset === 'week' ? 'Last 7 days' : cfPreset === 'month' ? 'Last 30 days' : cfPreset === 'year' ? 'Last 1 year' : cfPreset === '2y' ? 'Last 2 years' : cfPreset === 'ytd' ? 'This year' : 'All time'}</p></div>
                <span className="text-2xl font-bold text-red-500">{INR(cf.period.moneyOut)}</span>
              </div>
              <div className="space-y-3">
                {cf.period.outSources.map((s, i) => {
                  const icons = [<Users key="s" size={14} />, <Receipt key="e" size={14} />, <PiggyBank key="p" size={14} />]
                  const colors = ['text-purple-600 bg-purple-100', 'text-red-500 bg-red-100', 'text-orange-500 bg-orange-100']
                  const barColors = ['bg-purple-500', 'bg-red-400', 'bg-orange-400']
                  const pct = cf.period.moneyOut > 0 ? Math.round((s.amount / cf.period.moneyOut) * 100) : 0
                  return (
                    <div key={s.label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${colors[i]}`}>{icons[i]}</div>
                          <span className="text-xs font-medium text-slate-700">{s.label}</span>
                          <span className="text-[10px] text-slate-400 bg-white/80 border border-slate-100 px-1.5 py-0.5 rounded">{s.count} txn</span>
                        </div>
                        <span className="text-sm font-bold text-slate-800">{INR(s.amount)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-red-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColors[i]} transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Pending alert ────────────────────────────────────── */}
          {cf.period.pendingDues > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 flex items-center gap-3">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <span className="text-sm text-amber-800"><strong>{cf.period.pendingDuesCount}</strong> fee bill{cf.period.pendingDuesCount !== 1 ? 's' : ''} worth <strong>{INR(cf.period.pendingDues)}</strong> still unpaid in this period</span>
            </div>
          )}

          {/* ── Profit / Loss bar ────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cf.period.net >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  {cf.period.net >= 0 ? <TrendingUp size={16} className="text-green-600" /> : <TrendingDown size={16} className="text-red-500" />}
                </div>
                <div>
                  <span className="text-sm font-semibold text-slate-800">Profit / Loss</span>
                  <span className="text-[11px] text-slate-400 ml-2">{cf.period.txCount} entries</span>
                </div>
              </div>
              <span className={`text-2xl font-bold ${cf.period.net >= 0 ? 'text-green-600' : 'text-red-500'}`}>{cf.period.net >= 0 ? '+' : ''}{INR(cf.period.net)}</span>
            </div>
            {(cf.period.moneyIn > 0 || cf.period.moneyOut > 0) && <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex">
              {cf.period.moneyIn > 0 && <div className="h-full bg-green-500 rounded-l-full transition-all duration-500" style={{ width: `${(cf.period.moneyIn / (cf.period.moneyIn + cf.period.moneyOut)) * 100}%` }} />}
              {cf.period.moneyOut > 0 && <div className="h-full bg-red-400 rounded-r-full transition-all duration-500" style={{ width: `${(cf.period.moneyOut / (cf.period.moneyIn + cf.period.moneyOut)) * 100}%` }} />}
            </div>}
            {(cf.period.moneyIn > 0 || cf.period.moneyOut > 0) && <div className="flex justify-between text-xs mt-2">
              <span className="text-green-600 font-semibold flex items-center gap-1"><ArrowDownLeft size={12} /> {INR(cf.period.moneyIn)} received</span>
              <span className="text-red-500 font-semibold flex items-center gap-1">{INR(cf.period.moneyOut)} spent <ArrowUpRightIcon size={12} /></span>
            </div>}
          </div>

          {/* ── Transaction Feed ──────────────────────────────────── */}
          <Section title="All Entries" action={
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex bg-white border border-slate-200 p-0.5 rounded-lg shadow-sm">
                {[{ key: 'all' as const, label: 'All' }, { key: 'in' as const, label: 'Received' }, { key: 'out' as const, label: 'Spent' }, { key: 'pending' as const, label: 'Pending Fees' }].map(f => (
                  <button key={f.key} onClick={() => setCfFilter(f.key)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${cfFilter === f.key ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>{f.label}</button>
                ))}
              </div>
              {cfTxs.length > 0 && <Btn onClick={csvCf} variant="ghost"><Download size={12} /> CSV</Btn>}
            </div>
          }>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm"><div className="overflow-x-auto">
              <table className="w-full text-sm"><thead><tr className="bg-slate-50 border-b border-slate-200">
                <Th className="pl-5 text-left">Date</Th><Th className="text-left">Type</Th><Th className="text-left">Details</Th><Th className="text-right">Amount</Th><Th className="text-left">Mode</Th><Th className="pr-5 text-left">Done By</Th>
              </tr></thead><tbody>
                {(() => {
                  const filtered = cfFilter === 'all' ? cfTxs : cfTxs.filter(t => t.direction === cfFilter)
                  if (filtered.length === 0) return <tr><td colSpan={6} className="p-12 text-center text-slate-400">No entries for this period</td></tr>
                  return filtered.map(t => (
                    <tr key={`${t.id}-${t.source}`} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 pl-5 text-xs text-slate-600 whitespace-nowrap">{fmtDate(t.date)}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          t.direction === 'in' ? 'bg-green-100 text-green-700'
                          : t.direction === 'pending' ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-600'
                        }`}>
                          {t.direction === 'in' ? <ArrowDownLeft size={10} /> : t.direction === 'out' ? <ArrowUpRightIcon size={10} /> : <Clock size={10} />}
                          {t.source}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-slate-700 max-w-[250px] truncate" title={t.description}>{t.description}</td>
                      <td className={`p-3 text-right font-bold ${
                        t.direction === 'in' ? 'text-green-600' : t.direction === 'pending' ? 'text-amber-600' : 'text-red-500'
                      }`}>
                        {t.direction === 'in' ? '+' : t.direction === 'out' ? '-' : ''}{INR(t.amount)}
                      </td>
                      <td className="p-3 text-xs text-slate-500">{t.method || '—'}</td>
                      <td className="p-3 pr-5 text-xs text-slate-500">{t.loggedBy || '—'}</td>
                    </tr>
                  ))
                })()}
              </tbody></table>
            </div>
            {cfTxMore && <div className="p-3 border-t border-slate-100 text-center"><button onClick={() => loadCf(cfFrom, cfTo, true)} disabled={cfBusy} className="text-xs font-medium text-blue-600 hover:text-blue-700">{cfBusy ? 'Loading...' : 'Load More'}</button></div>}
            {cfTxs.length > 0 && !cfTxMore && <div className="py-2 text-center text-[11px] text-slate-400 border-t border-slate-50">{cf.totalTransactions} entr{cf.totalTransactions !== 1 ? 'ies' : 'y'}</div>}
            </div>
          </Section>
        </div>)}
      </div>)}

      {/* ════════ STUDENTS ════════ */}
      {mainTab === 'students' && isFinance && d && (<div className="space-y-6">
        <TabBar tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'active', label: 'Active Students', badge: d.totalActiveStudents },
          { key: 'former', label: 'Former Students', badge: f?.totalFormer },
          { key: 'pocket', label: 'Pocket Money' },
        ]} active={subTab} onChange={k => setSubTab(k as any)} />

        {subTab === 'overview' && <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Metric label="Active Students" value={d.totalActiveStudents} icon={Users} color="blue" href="/students" />
            <Metric label="Former Students" value={f?.totalFormer || 0} sub={`${f?.alumniCount || 0} alumni, ${f?.dropoutCount || 0} dropout`} icon={UserX} color="slate" />
            <Metric label="Fees Collected" value={INR(d.totalFeesCollected)} sub={`of ${INR(d.totalFeesToCollect)} total`} icon={TrendingUp} color="green" />
            <Metric label="Fees Pending" value={INR(d.totalCurrentOutstanding)} sub="Still to be collected" icon={Clock} color={d.totalCurrentOutstanding > 0 ? 'amber' : 'green'} />
          </div>
          {d.totalFeesToCollect > 0 && <Progress collected={d.totalFeesCollected} total={d.totalFeesToCollect} />}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Metric label="New Admissions" value={d.newAdmissions} sub={academicYear.name} icon={UserCheck} color="green" />
            <Metric label="Old Year Dues" value={INR(d.activeStudentsPastArrears)} sub="Carried over from previous years" icon={AlertTriangle} color={d.activeStudentsPastArrears > 0 ? 'red' : 'green'} />
            <Metric label="Pocket Money Held" value={INR(d.pocketMoney.totalEscrow)} sub="All years • students' money with school" icon={PiggyBank} color="blue" />
            <Metric label="Left Students' Dues" value={INR(f?.totalPendingAmount || 0)} sub={`${f?.withPendingCount || 0} students`} icon={UserX} color={f?.totalPendingAmount ? 'amber' : 'green'} />
          </div>
        </div>}

        {subTab === 'active' && <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Metric label="Active Students" value={d.totalActiveStudents} icon={Users} color="blue" href="/students" />
            <Metric label="New Admissions" value={d.newAdmissions} sub={academicYear.name} icon={UserCheck} color="green" />
            <Metric label="Old Year Dues" value={INR(d.activeStudentsPastArrears)} sub="Carried over from previous years" icon={AlertTriangle} color={d.activeStudentsPastArrears > 0 ? 'red' : 'green'} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Metric label="Total Fees Billed" value={INR(d.totalFeesToCollect)} sub={`${academicYear.name} bills`} icon={IndianRupee} color="slate" />
            <Metric label="Fees Collected" value={INR(d.totalFeesCollected)} icon={TrendingUp} color="green" />
            <Metric label="Fees Pending" value={INR(d.totalCurrentOutstanding)} icon={Clock} color={d.totalCurrentOutstanding > 0 ? 'amber' : 'green'} />
          </div>
          {d.totalFeesToCollect > 0 && <Progress collected={d.totalFeesCollected} total={d.totalFeesToCollect} />}

          <Section title="Class-wise Breakdown" action={<Btn onClick={csvCls} variant="ghost"><Download size={13} /> CSV</Btn>}>
            {d.classBreakdown.length === 0 ? <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-12 text-center"><p className="text-sm text-slate-400">No enrollments for {academicYear.name}</p></div>
            : <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50/80 border-b border-slate-100"><Th className="pl-5 text-left">Class</Th><Th className="text-center">Active</Th><Th className="text-center">Former</Th><Th className="text-center">New</Th><Th className="text-right">To Collect</Th><Th className="text-right">Collected</Th><Th className="text-right pr-5">Pending</Th></tr></thead><tbody>
              {d.classBreakdown.map(c => { const pct = c.feesToCollect > 0 ? Math.round((c.feesCollected / c.feesToCollect) * 100) : 0; return <tr key={c.classId} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors"><td className="p-3 pl-5 font-semibold text-slate-800">{c.label}</td><td className="p-3 text-center font-bold text-slate-700">{c.activeCount}</td><td className="p-3 text-center">{c.formerCount > 0 ? <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-bold">{c.formerCount}</span> : <span className="text-slate-300">0</span>}</td><td className="p-3 text-center">{c.newAdmissions > 0 ? <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-bold">+{c.newAdmissions}</span> : <span className="text-slate-300">0</span>}</td><td className="p-3 text-right text-slate-700">{INR(c.feesToCollect)}</td><td className="p-3 text-right"><span className="font-semibold text-emerald-600">{INR(c.feesCollected)}</span>{c.feesToCollect > 0 && <div className="flex items-center justify-end gap-1.5 mt-1"><div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} /></div><span className="text-[10px] text-slate-400">{pct}%</span></div>}</td><td className="p-3 text-right pr-5">{c.feesPending > 0 ? <span className="font-bold text-red-600">{INR(c.feesPending)}</span> : <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold uppercase border border-emerald-100">Cleared</span>}</td></tr> })}
              <tr className="bg-slate-50/80 font-semibold text-sm"><td className="p-3 pl-5 text-slate-700">Total</td><td className="p-3 text-center text-slate-700">{d.classBreakdown.reduce((s, c) => s + c.activeCount, 0)}</td><td className="p-3 text-center text-slate-500">{d.classBreakdown.reduce((s, c) => s + c.formerCount, 0)}</td><td className="p-3 text-center text-emerald-600">{d.classBreakdown.reduce((s, c) => s + c.newAdmissions, 0)}</td><td className="p-3 text-right text-slate-700">{INR(d.totalFeesToCollect)}</td><td className="p-3 text-right text-emerald-600">{INR(d.totalFeesCollected)}</td><td className="p-3 text-right pr-5 text-red-600">{INR(d.totalCurrentOutstanding)}</td></tr>
            </tbody></table></div></div>}
          </Section>

          <Section title="Fee Payment Logs" action={<div className="flex items-center gap-2 flex-wrap"><RowsPicker value={flRows} onChange={v => { setFlRows(v); loadFl(flFrom, flTo, v) }} /><DateRangeInput from={flFrom} to={flTo} onFrom={setFlFrom} onTo={setFlTo} /><Btn onClick={() => loadFl(flFrom, flTo, flRows)} disabled={flBusy} loading={flBusy}><Search size={12} /> Apply</Btn>{fl.length > 0 && <Btn onClick={csvFl} variant="ghost"><Download size={12} /> CSV</Btn>}</div>}>
            <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50/80 border-b border-slate-100"><Th className="pl-5 text-left">Date</Th><Th className="text-left">Student</Th><Th className="text-left">Class</Th><Th className="text-left">Invoice</Th><Th className="text-right">Amount</Th><Th className="text-left">Method</Th><Th className="text-left">Ref</Th><Th className="pr-5 text-left">By</Th></tr></thead><tbody>
              {fl.length === 0 ? <tr><td colSpan={8} className="p-10 text-center text-slate-400">No payments for selected range</td></tr> : fl.map(l => <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors"><td className="p-3 pl-5 text-xs text-slate-600 whitespace-nowrap">{fmtDate(l.date)}</td><td className="p-3"><span className="font-medium text-slate-800 text-sm">{l.studentName}</span>{l.admissionNumber && <span className="block text-[10px] text-slate-400">#{l.admissionNumber}</span>}</td><td className="p-3 text-xs text-slate-600">{l.className}</td><td className="p-3 text-xs text-slate-600 max-w-[150px] truncate" title={l.invoiceTitle}>{l.invoiceTitle}</td><td className="p-3 text-right font-bold text-emerald-600">{INR(l.amount)}</td><td className="p-3 text-xs text-slate-500">{l.method || '—'}</td><td className="p-3 text-xs text-slate-500 max-w-[90px] truncate">{l.reference || '—'}</td><td className="p-3 pr-5 text-xs text-slate-500">{l.loggedBy || '—'}</td></tr>)}
            </tbody></table></div>
            {flMore && <div className="p-3 border-t border-slate-100 text-center"><button onClick={() => loadFl(flFrom, flTo, flRows, true)} disabled={flBusy} className="text-xs font-medium text-blue-600 hover:text-blue-700">{flBusy ? 'Loading...' : 'Load More'}</button></div>}
            {fl.length > 0 && !flMore && <div className="py-2 text-center text-[11px] text-slate-400 border-t border-slate-50">{fl.length} payment{fl.length !== 1 ? 's' : ''}</div>}
            </div>
          </Section>
        </div>}

        {subTab === 'former' && f && <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Metric label="Total Former" value={f.totalFormer} sub={`${f.alumniCount} alumni, ${f.dropoutCount} dropout`} icon={Users} color="slate" />
            <Metric label="With Pending Dues" value={`${f.withPendingCount} of ${f.totalFormer}`} sub={f.totalPendingAmount > 0 ? INR(f.totalPendingAmount) + ' total' : 'All clear'} icon={AlertTriangle} color={f.withPendingCount > 0 ? 'red' : 'green'} />
            <Metric label="Cleared" value={`${f.clearedCount} of ${f.totalFormer}`} sub={`${f.totalFormer > 0 ? Math.round((f.clearedCount / f.totalFormer) * 100) : 0}% clearance rate`} icon={TrendingUp} color="green" />
          </div>
          {f.totalFormer > 0 && <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm"><div className="flex items-center justify-between mb-2.5"><span className="text-sm font-medium text-slate-700">Dues Clearance</span><span className="text-sm font-bold text-slate-900">{Math.round((f.clearedCount / f.totalFormer) * 100)}%</span></div><div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex"><div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${(f.clearedCount / f.totalFormer) * 100}%` }} /><div className="h-full bg-red-400 rounded-r-full" style={{ width: `${(f.withPendingCount / f.totalFormer) * 100}%` }} /></div><div className="flex justify-between text-[11px] mt-2"><span className="text-emerald-600 font-medium">{f.clearedCount} cleared</span><span className="text-red-500 font-medium">{f.withPendingCount} pending ({INR(f.totalPendingAmount)})</span></div></div>}
          <Section title="All Former Students" action={<div className="flex items-center gap-2">{f.students.length > 0 && <Btn onClick={csvFmr} variant="ghost"><Download size={13} /> CSV</Btn>}<Link href="/students/former-students" className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-3.5 py-1.5 rounded-lg hover:bg-blue-100 transition"><ExternalLink size={13} /> Detailed View</Link></div>}>
            {f.students.length === 0 ? <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-12 text-center"><p className="text-sm text-slate-400">No former students in the system.</p></div>
            : <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50/80 border-b border-slate-100"><Th className="pl-5 text-left">Student</Th><Th className="text-left">Status</Th><Th className="text-left">Last Class</Th><Th className="text-left">Last Year</Th><Th className="text-right">Owed</Th><Th className="text-right">Paid</Th><Th className="text-right pr-5">Pending</Th></tr></thead><tbody>
              {f.students.map(s => <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors"><td className="p-3 pl-5"><Link href={`/students/${s.id}/fees`} className="hover:text-blue-600 transition-colors"><span className="font-medium text-slate-800">{s.name}</span>{s.admissionNumber && <span className="block text-[10px] text-slate-400">#{s.admissionNumber}</span>}</Link></td><td className="p-3"><Badge status={s.status} /></td><td className="p-3 text-xs text-slate-600">{s.lastClass || '—'}</td><td className="p-3 text-xs text-slate-600">{s.lastYear || '—'}</td><td className="p-3 text-right text-slate-700">{s.totalOwed > 0 ? INR(s.totalOwed) : <span className="text-slate-300">—</span>}</td><td className="p-3 text-right text-emerald-600">{s.totalPaid > 0 ? INR(s.totalPaid) : <span className="text-slate-300">—</span>}</td><td className="p-3 text-right pr-5">{s.totalPending > 0 ? <span className="font-bold text-red-600">{INR(s.totalPending)}</span> : <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold uppercase border border-emerald-100">Cleared</span>}</td></tr>)}
              <tr className="bg-slate-50/80 font-semibold text-sm"><td className="p-3 pl-5 text-slate-700" colSpan={4}>{f.students.length} students</td><td className="p-3 text-right text-slate-700">{INR(f.students.reduce((s, x) => s + x.totalOwed, 0))}</td><td className="p-3 text-right text-emerald-600">{INR(f.totalCollectedAmount)}</td><td className="p-3 text-right pr-5 text-red-600">{INR(f.totalPendingAmount)}</td></tr>
            </tbody></table></div></div>}
          </Section>
        </div>}

        {subTab === 'pocket' && <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Metric label="Total Money Held" value={INR(d.pocketMoney.totalEscrow)} sub="All years • all students" icon={PiggyBank} color="blue" />
            <Metric label="Overdrawn Students" value={d.pocketMoney.negativeCount} sub="Spent more than deposited" icon={AlertTriangle} color={d.pocketMoney.negativeCount > 0 ? 'red' : 'green'} />
            <Metric label="Low Balance" value={d.pocketMoney.lowBalanceCount} sub="Below ₹500" icon={TrendingDown} color={d.pocketMoney.lowBalanceCount > 0 ? 'amber' : 'green'} />
            <Metric label="Left Students' Refund" value={INR(d.pocketMoney.alumniPayable)} sub="All years • refund owed to alumni/dropout" icon={Wallet} color={d.pocketMoney.alumniPayable > 0 ? 'rose' : 'slate'} />
          </div>
          {d.pocketMoney.healthDistribution.total > 0 && <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm"><div className="flex items-center gap-5 mb-3 text-xs text-slate-600"><span className="flex items-center gap-1.5"><Dot color="bg-blue-500" /> Healthy ({d.pocketMoney.healthDistribution.healthy})</span><span className="flex items-center gap-1.5"><Dot color="bg-amber-500" /> Low ({d.pocketMoney.healthDistribution.low})</span><span className="flex items-center gap-1.5"><Dot color="bg-red-500" /> Negative ({d.pocketMoney.healthDistribution.negative})</span></div><div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">{d.pocketMoney.healthDistribution.healthy > 0 && <div className="h-full bg-blue-500" style={{ width: `${(d.pocketMoney.healthDistribution.healthy / d.pocketMoney.healthDistribution.total) * 100}%` }} />}{d.pocketMoney.healthDistribution.low > 0 && <div className="h-full bg-amber-500" style={{ width: `${(d.pocketMoney.healthDistribution.low / d.pocketMoney.healthDistribution.total) * 100}%` }} />}{d.pocketMoney.healthDistribution.negative > 0 && <div className="h-full bg-red-500" style={{ width: `${(d.pocketMoney.healthDistribution.negative / d.pocketMoney.healthDistribution.total) * 100}%` }} />}</div></div>}
          {d.pocketMoney.topDefaulters.length > 0 && <Section title="Top Negative Balances"><div className="bg-white rounded-xl border border-slate-200/80 divide-y divide-slate-50 shadow-sm">{d.pocketMoney.topDefaulters.map((x, i) => <Link key={x.id} href={`/students/${x.id}/pocket-money`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/60 transition-colors"><div className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-red-50 text-red-600 text-[10px] font-bold flex items-center justify-center border border-red-100">{i + 1}</span><span className="text-sm font-medium text-slate-800">{x.name}</span></div><span className="text-sm font-bold text-red-600">{INR(Math.abs(x.balance))}</span></Link>)}</div></Section>}
          <Section title="Transaction Logs" action={<div className="flex items-center gap-2 flex-wrap"><RowsPicker value={plRows} onChange={v => { setPlRows(v); loadPl(plFrom, plTo, v) }} /><DateRangeInput from={plFrom} to={plTo} onFrom={setPlFrom} onTo={setPlTo} /><Btn onClick={() => loadPl(plFrom, plTo, plRows)} disabled={plBusy} loading={plBusy}><Search size={12} /> Apply</Btn>{pl.length > 0 && <Btn onClick={csvPl} variant="ghost"><Download size={12} /> CSV</Btn>}</div>}>
            <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50/80 border-b border-slate-100"><Th className="pl-5 text-left">Date</Th><Th className="text-left">Student</Th><Th className="text-left">Type</Th><Th className="text-right">Amount</Th><Th className="text-left">Description</Th><Th className="text-left">Method</Th><Th className="pr-5 text-left">By</Th></tr></thead><tbody>
              {pl.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-slate-400">No transactions for selected range</td></tr> : pl.map(l => <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors"><td className="p-3 pl-5 text-xs text-slate-600 whitespace-nowrap">{fmtDate(l.date)}</td><td className="p-3"><span className="font-medium text-slate-800 text-sm">{l.studentName}</span>{l.admissionNumber && <span className="block text-[10px] text-slate-400">#{l.admissionNumber}</span>}</td><td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${l.type === 'CREDIT' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>{l.type}</span></td><td className={`p-3 text-right font-bold ${l.type === 'CREDIT' ? 'text-blue-600' : 'text-red-600'}`}>{l.type === 'CREDIT' ? '+' : '-'}{INR(l.amount)}</td><td className="p-3 text-xs text-slate-600 max-w-[160px] truncate" title={l.description}>{l.description}</td><td className="p-3 text-xs text-slate-500">{l.method || '—'}</td><td className="p-3 pr-5 text-xs text-slate-500">{l.loggedBy || '—'}</td></tr>)}
            </tbody></table></div>
            {plMore && <div className="p-3 border-t border-slate-100 text-center"><button onClick={() => loadPl(plFrom, plTo, plRows, true)} disabled={plBusy} className="text-xs font-medium text-blue-600 hover:text-blue-700">{plBusy ? 'Loading...' : 'Load More'}</button></div>}
            {pl.length > 0 && !plMore && <div className="py-2 text-center text-[11px] text-slate-400 border-t border-slate-50">{pl.length} transaction{pl.length !== 1 ? 's' : ''}</div>}
            </div>
          </Section>
        </div>}
      </div>)}

      {/* ════════ STAFF ════════ */}
      {mainTab === 'staff' && isFinance && staff && (<div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-[15px] font-semibold text-slate-800">Staff & Payroll</h3>
          <div className="flex items-center gap-2">
            <select value={staffRange} onChange={e => handleStaffRange(e.target.value)} disabled={staffLoading} className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50">
              <option value="current">Current Month</option><option value="3m">Past 3 Months</option><option value="6m">Past 6 Months</option><option value="12m">Past 12 Months</option>
            </select>
            {staffLoading && <Loader2 size={14} className="animate-spin text-blue-500" />}
            <Link href="/staff/payroll" className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition"><ExternalLink size={13} /> Manage Payroll</Link>
          </div>
        </div>

        {/* Headcount */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Metric label="Active Staff" value={staff.activeCount} icon={Users} color="blue" href="/staff/payroll" />
          <Metric label="Left / Terminated" value={`${staff.resignedCount} / ${staff.terminatedCount}`} sub={`${staff.inactiveCount} total inactive`} icon={UserX} color="slate" />
          <Metric label="Total Base Salary" value={INR(staff.totalBaseSalary)} sub="Active staff this month (base only)" icon={IndianRupee} color="purple" />
          <Metric label="Unprocessed Base" value={unprocessedBaseSalary > 0 ? `~${INR(unprocessedBaseSalary)}` : '₹0'} sub={`${staff.thisMonth.unprocCount} staff not yet in payroll`} icon={AlertTriangle} color={staff.thisMonth.unprocCount > 0 ? 'red' : 'green'} />
        </div>

        {/* This month status + financials grouped */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">{staff.currentMonth} Payroll</span>
            <span className="text-sm font-bold text-slate-600">{processedCount}/{staff.activeCount} processed</span>
          </div>

          {/* Status dots */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div className="flex items-center gap-2"><Dot color="bg-emerald-500" /><span className="text-sm font-bold text-slate-800">{staff.thisMonth.paidCount}</span><span className="text-xs text-slate-400">Paid</span><span className="text-xs font-semibold text-emerald-600">{INR(staff.thisMonth.paidAmount)}</span></div>
            <div className="flex items-center gap-2"><Dot color="bg-amber-500" /><span className="text-sm font-bold text-slate-800">{staff.thisMonth.pendingCount}</span><span className="text-xs text-slate-400">Pending</span>{staff.thisMonth.pendingAmount > 0 && <span className="text-xs font-semibold text-amber-600">{INR(staff.thisMonth.pendingAmount)}</span>}</div>
            <div className="flex items-center gap-2"><Dot color="bg-slate-300" /><span className="text-sm font-bold text-slate-800">{staff.thisMonth.draftCount}</span><span className="text-xs text-slate-400">Draft</span>{staff.thisMonth.draftAmount > 0 && <span className="text-xs font-semibold text-slate-500">{INR(staff.thisMonth.draftAmount)}</span>}</div>
            <div className="flex items-center gap-2"><Dot color="bg-red-400" /><span className="text-sm font-bold text-slate-800">{staff.thisMonth.unprocCount}</span><span className="text-xs text-slate-400">Not Started</span></div>
          </div>

          {/* Progress bar */}
          {staff.activeCount > 0 && <div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
              {staff.thisMonth.paidCount > 0 && <div className="h-full bg-emerald-500" style={{ width: `${(staff.thisMonth.paidCount / staff.activeCount) * 100}%` }} />}
              {staff.thisMonth.pendingCount > 0 && <div className="h-full bg-amber-400" style={{ width: `${(staff.thisMonth.pendingCount / staff.activeCount) * 100}%` }} />}
              {staff.thisMonth.draftCount > 0 && <div className="h-full bg-slate-300" style={{ width: `${(staff.thisMonth.draftCount / staff.activeCount) * 100}%` }} />}
            </div>
          </div>}
        </div>

        {/* Monthly breakdown (multi-month range) */}
        {staff.monthlyBreakdown.length > 1 && <Section title="Monthly Breakdown">
          <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50/80 border-b border-slate-100"><Th className="pl-5 text-left">Month</Th><Th className="text-center">Paid</Th><Th className="text-center">Pending</Th><Th className="text-center">Draft</Th><Th className="text-center">Unprocessed</Th><Th className="text-right">Paid Amt</Th><Th className="text-right">Bonuses</Th><Th className="text-right pr-5">Deductions</Th></tr></thead><tbody>
            {staff.monthlyBreakdown.map(m => <tr key={m.month} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors"><td className="p-3 pl-5 font-semibold text-slate-800">{m.month}</td><td className="p-3 text-center"><span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-bold">{m.paidCount}</span></td><td className="p-3 text-center">{m.pendingCount > 0 ? <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-bold">{m.pendingCount}</span> : <span className="text-slate-300">0</span>}</td><td className="p-3 text-center">{m.draftCount > 0 ? <span className="text-slate-500 text-xs font-bold">{m.draftCount}</span> : <span className="text-slate-300">0</span>}</td><td className="p-3 text-center">{m.unprocCount > 0 ? <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-xs font-bold">{m.unprocCount}</span> : <span className="text-slate-300">0</span>}</td><td className="p-3 text-right font-semibold text-emerald-600">{INR(m.paidAmount)}</td><td className="p-3 text-right">{m.totalBonus > 0 ? <span className="text-blue-600">+{INR(m.totalBonus)}</span> : <span className="text-slate-300">—</span>}</td><td className="p-3 text-right pr-5">{m.totalDeductions > 0 ? <span className="text-red-500">-{INR(m.totalDeductions)}</span> : <span className="text-slate-300">—</span>}</td></tr>)}
          </tbody></table></div></div>
        </Section>}

        {/* Per-staff detail */}
        <Section title={`Staff Detail — ${staff.currentMonth}`} action={<Link href="/staff/payroll" className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition"><ExternalLink size={13} /> Manage</Link>}>
          <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50/80 border-b border-slate-100"><Th className="pl-5 text-left">Staff</Th><Th className="text-left">Role</Th><Th className="text-right">Base</Th><Th className="text-right">Bonus</Th><Th className="text-right">Deduction</Th><Th className="text-right">Net</Th><Th className="text-center pr-5">Status</Th></tr></thead><tbody>
            {staff.staffDetail.map(s => <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors"><td className="p-3 pl-5"><Link href={`/staff/${s.id}`} className="hover:text-blue-600 transition-colors font-medium text-slate-800">{s.name}</Link></td><td className="p-3 text-xs text-slate-500">{s.designation || '—'}</td><td className="p-3 text-right text-slate-700">{INR(s.baseSalary)}</td><td className="p-3 text-right">{s.bonus > 0 ? <span className="text-blue-600">+{INR(s.bonus)}</span> : <span className="text-slate-300">—</span>}</td><td className="p-3 text-right">{s.deduction > 0 ? <span className="text-red-500">-{INR(s.deduction)}</span> : <span className="text-slate-300">—</span>}</td><td className="p-3 text-right font-bold text-slate-800">{s.netPaid > 0 ? INR(s.netPaid) : <span className="text-slate-300">—</span>}</td><td className="p-3 text-center pr-5"><PayrollBadge status={s.status} /></td></tr>)}
            <tr className="bg-slate-50/80 font-semibold text-sm"><td className="p-3 pl-5 text-slate-700" colSpan={2}>{staff.staffDetail.length} staff</td><td className="p-3 text-right text-slate-700">{INR(staff.totalBaseSalary)}</td><td className="p-3 text-right text-blue-600">{(() => { const t = staff.staffDetail.reduce((s, x) => s + x.bonus, 0); return t > 0 ? '+' + INR(t) : '—' })()}</td><td className="p-3 text-right text-red-500">{(() => { const t = staff.staffDetail.reduce((s, x) => s + x.deduction, 0); return t > 0 ? '-' + INR(t) : '—' })()}</td><td className="p-3 text-right text-slate-800">{INR(staff.thisMonth.totalProcessed)}</td><td className="p-3"></td></tr>
          </tbody></table></div></div>
        </Section>
      </div>)}

      {/* ════════ EXPENSES ════════ */}
      {mainTab === 'expenses' && isFinance && ex && (<ExpensesTab ex={ex} academicYear={academicYear} />)}
    </div>
  )
}
