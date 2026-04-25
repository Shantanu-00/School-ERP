'use client'

import React, { useState, useTransition, useCallback, useEffect, useRef } from 'react'
import {
  getBulkStudentsAction,
  bulkGenerateInvoicesAction,
  bulkPocketMoneyAction,
  updateEnrollmentDiscountsAction,
  BulkStudent,
} from '@/actions/bulk-operations.actions'
import {
  FileText, Wallet, Search, Loader2, Users,
  AlertCircle, CheckCircle2, X, RefreshCw, Receipt,
  ArrowDownToLine, ArrowUpFromLine, Info, AlertTriangle,
  CheckSquare, Square, CalendarDays, Filter,
  Pencil, Check, Eye,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'invoices' | 'pocket-money'
// issue-new: manual flat invoice for any student regardless of existing invoices or fee config
// auto-pending: uses fee config, only students with no invoice for this enrollment
type InvoiceMode = 'issue-new' | 'auto-pending'
type PocketMode = 'flat' | 'per-student'
type PocketType = 'DEBIT' | 'CREDIT'
type PocketPaymentMode = 'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque' | 'Internal Adjustment'

type FiltersState = {
  year_id: string
  class_id: string
  gender: string
  status: string
  query: string
}

type InvoiceTemplate = {
  title: string
  amount: string   // only used in issue-new mode
  dueDate: string
  mode: InvoiceMode
}

type PocketConfig = {
  type: PocketType
  mode: PocketMode
  flatAmount: string
  flatReason: string
  paymentMode: PocketPaymentMode
  transactionReference: string
  perAmounts: Record<string, string>
  perReasons: Record<string, string>
}

// Per-student discount overrides (local, applied before submitting)
type DiscountOverride = {
  discount_type: string
  discount_mode: string
  discount_value: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function todayPlus30() {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().split('T')[0]
}

// Mirrors server-side buildInvoiceTitle
function buildTitle(invoiceTitle: string, gradeLevel: string | null, section: string | null, yearName: string | null) {
  const parts: string[] = [invoiceTitle]
  const cls = [gradeLevel, section].filter(Boolean).join('-')
  if (cls) parts.push(cls)
  if (yearName) parts.push(`AY ${yearName}`)
  return parts.join(' | ')
}

function applyDiscountClient(base: number, mode: string, value: number) {
  if (!base || value <= 0) return Math.max(0, base)
  if (mode === 'Percentage') return Math.max(0, base - base * (value / 100))
  return Math.max(0, base - value)
}

const selectCls = 'h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white disabled:opacity-50'
const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

const DISCOUNT_TYPES = ['None', 'RTE', 'Staff Child', 'Sibling', 'Management Discount', 'Other']

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const colours: Record<string, string> = {
    Unpaid: 'bg-red-50 text-red-700 border-red-200',
    Partial: 'bg-amber-50 text-amber-700 border-amber-200',
    Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${colours[status] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      {status}
    </span>
  )
}

function StudentStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Alumni: 'bg-blue-50 text-blue-700 border-blue-200',
    Dropout: 'bg-rose-50 text-rose-700 border-rose-200',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${map[status] ?? 'bg-slate-50 text-slate-500 border-slate-200'}`}>
      {status}
    </span>
  )
}

// ─── Summary chips ────────────────────────────────────────────────────────────

function SummaryChips({
  activeTab, students, selectedStudents, template, pocket, overrides,
}: {
  activeTab: TabId
  students: BulkStudent[]
  selectedStudents: BulkStudent[]
  template: InvoiceTemplate
  pocket: PocketConfig
  overrides: Record<string, DiscountOverride>
}) {
  const chips: { label: string; colour: string }[] = []
  chips.push({ label: `${selectedStudents.length} / ${students.length} selected`, colour: 'blue' })

  if (activeTab === 'invoices') {
    if (template.mode === 'issue-new') {
      const amt = Number(template.amount) || 0
      if (selectedStudents.length > 0) chips.push({ label: `${selectedStudents.length} invoices to issue`, colour: 'emerald' })
      if (amt > 0 && selectedStudents.length > 0) chips.push({ label: `Total ${fmt(amt * selectedStudents.length)}`, colour: 'slate' })
    } else {
      // auto-pending
      const noConfig = selectedStudents.filter(s => s.fee_config_base_amount === null)
      const canGenerate = selectedStudents.filter(s => s.fee_config_base_amount !== null)
      if (canGenerate.length) chips.push({ label: `${canGenerate.length} ready`, colour: 'emerald' })
      if (noConfig.length) chips.push({ label: `${noConfig.length} no fee config`, colour: 'amber' })
      const totalVal = canGenerate.reduce((a, s) => {
        const ov = overrides[s.id]
        const mode = ov ? ov.discount_mode : s.discount_mode
        const val = ov ? Number(ov.discount_value) || 0 : s.discount_value
        return a + applyDiscountClient(s.fee_config_base_amount ?? 0, mode, val)
      }, 0)
      if (totalVal > 0) chips.push({ label: `Total ${fmt(totalVal)}`, colour: 'slate' })
    }
  } else {
    const flatAmt = Number(pocket.flatAmount) || 0
    const totalVal = pocket.mode === 'flat'
      ? selectedStudents.length * flatAmt
      : selectedStudents.reduce((a, s) => a + (Number(pocket.perAmounts[s.id]) || 0), 0)
    if (totalVal > 0) chips.push({ label: `${pocket.type === 'DEBIT' ? 'Deducting' : 'Crediting'} ${fmt(totalVal)}`, colour: 'slate' })
    if (pocket.type === 'DEBIT') {
      const low = selectedStudents.filter(s => {
        const amt = pocket.mode === 'flat' ? flatAmt : (Number(pocket.perAmounts[s.id]) || 0)
        return amt > 0 && s.pocket_money_balance < amt
      }).length
      if (low) chips.push({ label: `${low} insufficient balance`, colour: 'rose' })
    }
  }

  const colourMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  }

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {chips.map((c, i) => (
        <span key={i} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${colourMap[c.colour]}`}>
          {c.label}
        </span>
      ))}
    </div>
  )
}

// ─── Invoice config panel ─────────────────────────────────────────────────────

function InvoicePanel({
  template, set, selectedStudents, overrides,
}: {
  template: InvoiceTemplate
  set: (t: Partial<InvoiceTemplate>) => void
  selectedStudents: BulkStudent[]
  overrides: Record<string, DiscountOverride>
}) {
  const isNew = template.mode === 'issue-new'

  // For auto-pending preview
  const withConfig = selectedStudents.filter(s => s.fee_config_base_amount !== null)
  const noConfig = selectedStudents.filter(s => s.enrollment_id && s.fee_config_base_amount === null)
  const previewStudent = withConfig[0] || null
  const previewAutoAmt = previewStudent
    ? (() => {
        const ov = overrides[previewStudent.id]
        const mode = ov ? ov.discount_mode : previewStudent.discount_mode
        const val = ov ? Number(ov.discount_value) || 0 : previewStudent.discount_value
        return applyDiscountClient(previewStudent.fee_config_base_amount!, mode, val)
      })()
    : 0
  const previewAutoTitle = previewStudent
    ? buildTitle(template.title || 'Tuition Fee', previewStudent.grade_level, previewStudent.section, previewStudent.academic_year_name)
    : template.title || 'Tuition Fee'

  // For issue-new preview
  const previewNewAmt = Number(template.amount) || 0
  const previewNewTitle = template.title || '—'

  const dueFormatted = template.dueDate
    ? new Date(template.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden sticky top-4">
      <div className="px-4 py-3 bg-slate-50 border-b flex items-center gap-2">
        <FileText size={15} className="text-slate-500" />
        <span className="text-sm font-black text-slate-800">Invoice Mode</span>
      </div>
      <div className="p-4 space-y-4">

        {/* ── Mode selector ── */}
        <div className="flex flex-col gap-2">
          {/* Option 1 */}
          <button type="button" onClick={() => set({ mode: 'issue-new' })}
            className={`w-full text-left rounded-xl border-2 p-3 transition-all ${isNew ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
            <div className="flex items-start gap-2.5">
              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${isNew ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
                {isNew && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <p className={`text-xs font-black ${isNew ? 'text-blue-800' : 'text-slate-700'}`}>Issue New Invoice(s)</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                  Create a custom invoice for any selected student — regardless of whether they already have one. You define the title, amount, and due date.
                </p>
              </div>
            </div>
          </button>

          {/* Option 2 */}
          <button type="button" onClick={() => set({ mode: 'auto-pending' })}
            className={`w-full text-left rounded-xl border-2 p-3 transition-all ${!isNew ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
            <div className="flex items-start gap-2.5">
              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${!isNew ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'}`}>
                {!isNew && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <p className={`text-xs font-black ${!isNew ? 'text-emerald-800' : 'text-slate-700'}`}>Auto-Generate Pending Invoices</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                  Only for students with no invoice yet this year. Amount is pulled from the fee configuration with their discount applied.
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-slate-100" />

        {/* ── Fields ── */}
        <div className="space-y-3">
          {/* Title — always shown; label changes per mode */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              {isNew ? 'Invoice Title *' : 'Invoice Type (prefix) *'}
            </label>
            <input value={template.title} onChange={e => set({ title: e.target.value })}
              placeholder={isNew ? 'e.g. Annual Sports Fee' : 'e.g. Tuition Fee'}
              className={inputCls} />
            {!isNew && (
              <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                <Info size={9} />
                Class & year are appended automatically: "Tuition Fee | Grade10-A | AY 2025-26"
              </p>
            )}
          </div>

          {/* Amount — only for issue-new */}
          {isNew && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Amount (₹) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                <input type="number" min={0} value={template.amount} onChange={e => set({ amount: e.target.value })}
                  onWheel={e => e.currentTarget.blur()}
                  placeholder="0" className={`${inputCls} pl-6`} />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Same amount for all selected students.</p>
            </div>
          )}

          {/* Due date */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Due Date *</label>
            <input type="date" value={template.dueDate} onChange={e => set({ dueDate: e.target.value })} className={inputCls} />
          </div>
        </div>

        {/* ── Live Invoice Preview ── */}
        <div className={`border rounded-xl p-3.5 space-y-2.5 ${isNew ? 'border-blue-200 bg-blue-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <p className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${isNew ? 'text-blue-700' : 'text-emerald-700'}`}>
            <Eye size={11} />
            Invoice Preview
          </p>

          {selectedStudents.length === 0 ? (
            <p className="text-xs text-slate-500">Select students from the table →</p>
          ) : (
            <>
              <div className="bg-white border border-slate-100 rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Title</p>
                    <p className="text-xs font-bold text-slate-800 mt-0.5 break-words">
                      {isNew ? (previewNewTitle || '—') : (previewAutoTitle || '—')}
                    </p>
                    {!isNew && withConfig.length > 1 && (
                      <p className="text-[10px] text-slate-400 mt-0.5 italic">Title varies per class</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</p>
                    <p className={`text-sm font-black mt-0.5 ${isNew ? 'text-blue-700' : 'text-emerald-700'}`}>
                      {isNew
                        ? (previewNewAmt > 0 ? fmt(previewNewAmt) : '—')
                        : (previewAutoAmt > 0 ? fmt(previewAutoAmt) : '—')}
                    </p>
                    {!isNew && withConfig.length > 1 && (
                      <p className="text-[10px] text-slate-400 mt-0.5 italic">Varies per student</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{dueFormatted}</p>
                </div>
                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Status on creation</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">Unpaid</span>
                </div>
              </div>

              {/* Counts */}
              <div className="space-y-1">
                {isNew ? (
                  <p className="text-[10px] text-blue-700 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 size={10} />
                    {selectedStudents.length} invoice{selectedStudents.length !== 1 ? 's' : ''} will be issued
                  </p>
                ) : (
                  <>
                    {withConfig.length > 0 && (
                      <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 size={10} />
                        {withConfig.length} invoice{withConfig.length !== 1 ? 's' : ''} will be generated
                      </p>
                    )}
                    {noConfig.length > 0 && (
                      <p className="text-[10px] text-amber-700 font-semibold flex items-center gap-1.5">
                        <AlertCircle size={10} />
                        {noConfig.length} blocked — no fee config
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* No fee config banner — auto-pending only */}
        {!isNew && noConfig.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-800 font-semibold leading-relaxed">
              {noConfig.length} student{noConfig.length !== 1 ? 's' : ''} cannot be invoiced — no fee configuration exists for their class. Ask an Admin to add it in Settings → Fee Configurations.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Pocket money config panel ────────────────────────────────────────────────

function PocketPanel({
  config, set, selectedStudents,
}: {
  config: PocketConfig
  set: (c: Partial<PocketConfig>) => void
  selectedStudents: BulkStudent[]
}) {
  const flatAmt = Number(config.flatAmount) || 0
  const lowBalCount = config.type === 'DEBIT' && config.mode === 'flat'
    ? selectedStudents.filter(s => s.pocket_money_balance < flatAmt).length
    : 0

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden sticky top-4">
      <div className="px-4 py-3 bg-slate-50 border-b flex items-center gap-2">
        <Wallet size={15} className="text-slate-500" />
        <span className="text-sm font-black text-slate-800">Pocket Money Config</span>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Transaction Type</label>
          <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
            {(['DEBIT', 'CREDIT'] as PocketType[]).map(t => (
              <button key={t} type="button" onClick={() => set({ type: t })}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1 ${
                  config.type === t
                    ? t === 'DEBIT' ? 'bg-rose-600 text-white shadow' : 'bg-emerald-600 text-white shadow'
                    : 'text-slate-500 hover:text-slate-700'
                }`}>
                {t === 'DEBIT' ? <ArrowUpFromLine size={11} /> : <ArrowDownToLine size={11} />}
                {t === 'DEBIT' ? 'Deduction' : 'Deposit'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Amount Mode</label>
          <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
            {(['flat', 'per-student'] as PocketMode[]).map(m => (
              <button key={m} type="button" onClick={() => set({ mode: m })}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${config.mode === m ? 'bg-white text-blue-700 shadow border border-slate-200/60' : 'text-slate-500 hover:text-slate-700'}`}>
                {m === 'flat' ? 'Same for All' : 'Per Student'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payment Method</label>
          <select
            value={config.paymentMode}
            onChange={e => {
              const next = e.target.value as PocketPaymentMode
              set({
                paymentMode: next,
                transactionReference: next === 'Cash' ? '' : config.transactionReference,
              })
            }}
            className={selectCls}
          >
            <option value="Cash">Cash</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="UPI">UPI</option>
            <option value="Cheque">Cheque</option>
            <option value="Internal Adjustment">Internal Adjustment</option>
          </select>
        </div>

        {config.paymentMode !== 'Cash' && (
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Transaction Reference {config.type === 'CREDIT' ? '*' : '(Optional)'}
            </label>
            <input
              value={config.transactionReference}
              onChange={e => set({ transactionReference: e.target.value })}
              placeholder="e.g. UTR123456789"
              className={inputCls}
            />
            {config.type === 'CREDIT' && (
              <p className="text-[10px] text-amber-700 font-semibold mt-1">
                Required for non-cash credits.
              </p>
            )}
          </div>
        )}

        {config.mode === 'flat' && (
          <>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Amount (₹) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                <input type="number" min={0} value={config.flatAmount} onChange={e => set({ flatAmount: e.target.value })} onWheel={e => e.currentTarget.blur()} placeholder="0" className={`${inputCls} pl-6`} />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Reason *</label>
              <input value={config.flatReason} onChange={e => set({ flatReason: e.target.value })}
                placeholder={config.type === 'DEBIT' ? 'e.g. Field Trip' : 'e.g. Parent Deposit'}
                className={inputCls} />
            </div>
          </>
        )}

        {config.mode === 'per-student' && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
            <p className="text-[10px] text-amber-800 font-semibold flex items-start gap-1.5">
              <Info size={11} className="shrink-0 mt-0.5" />
              Enter individual amounts and reasons directly in the student table →
            </p>
          </div>
        )}

        {lowBalCount > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle size={13} className="text-rose-500 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-800 font-semibold">
              {lowBalCount} student{lowBalCount !== 1 ? 's' : ''} will go negative after this deduction.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Inline discount editor cell ─────────────────────────────────────────────

function DiscountCell({
  student, override, onChange,
}: {
  student: BulkStudent
  override: DiscountOverride | undefined
  onChange: (ov: DiscountOverride | undefined) => void
}) {
  const [editing, setEditing] = useState(false)
  const current = override ?? {
    discount_type: student.discount_type || 'None',
    discount_mode: student.discount_mode || 'Percentage',
    discount_value: String(student.discount_value || 0),
  }

  if (!editing) {
    const hasDiscount = current.discount_type !== 'None'
    return (
      <div className="flex items-center gap-1.5 group">
        {hasDiscount ? (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-violet-50 text-violet-700 border-violet-200">
            {current.discount_type} · {current.discount_mode === 'Percentage' ? `${current.discount_value}%` : `₹${current.discount_value}`}
          </span>
        ) : (
          <span className="text-slate-300 text-xs">—</span>
        )}
        <button type="button" onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600 p-0.5">
          <Pencil size={11} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[180px]" onClick={e => e.stopPropagation()}>
      <select value={current.discount_type}
        onChange={e => onChange({ ...current, discount_type: e.target.value, discount_value: e.target.value === 'None' ? '0' : current.discount_value })}
        className="h-7 px-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
        {DISCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      {current.discount_type !== 'None' && (
        <div className="flex gap-1">
          <select value={current.discount_mode}
            onChange={e => onChange({ ...current, discount_mode: e.target.value })}
            className="h-7 px-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white flex-1">
            <option value="Percentage">%</option>
            <option value="Fixed">₹ Fixed</option>
          </select>
          <input type="number" min={0} value={current.discount_value}
            onChange={e => onChange({ ...current, discount_value: e.target.value })}
            onWheel={e => e.currentTarget.blur()}
            className="h-7 px-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-16 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
        </div>
      )}

      <div className="flex gap-1">
        <button type="button" onClick={() => setEditing(false)}
          className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold bg-blue-600 text-white rounded h-6 hover:bg-blue-700">
          <Check size={10} /> Done
        </button>
        {override && (
          <button type="button" onClick={() => { onChange(undefined); setEditing(false) }}
            className="flex items-center justify-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-600 rounded h-6 px-2 hover:bg-slate-200">
            Reset
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Invoice table ────────────────────────────────────────────────────────────

function InvoiceTable({
  students, selectedIds, onToggle, template, overrides, onOverrideChange,
}: {
  students: BulkStudent[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  template: InvoiceTemplate
  overrides: Record<string, DiscountOverride>
  onOverrideChange: (id: string, ov: DiscountOverride | undefined) => void
}) {
  const isNew = template.mode === 'issue-new'

  return (
    <table className="w-full text-sm text-left border-collapse min-w-[760px]">
      <thead>
        <tr className="bg-slate-50 border-b text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <th className="p-3 w-9" />
          <th className="p-3">Student</th>
          <th className="p-3">Status</th>
          <th className="p-3">Class</th>
          {/* Discount column only in auto-pending mode */}
          {!isNew && <th className="p-3">Discount <span className="normal-case font-normal text-slate-300">(hover to edit)</span></th>}
          {/* Fee config column only in auto-pending */}
          {!isNew && <th className="p-3 text-right">Fee Config</th>}
          <th className="p-3 text-right">This Invoice</th>
          <th className="p-3 text-center">Current Tuition Invoice</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {students.map(s => {
          const isSelected = selectedIds.has(s.id)

          // issue-new: disabled only if not enrolled (no enrollment_id to attach to)
          // auto-pending: disabled if no fee config
          const notEnrolled = !s.enrollment_id
          const noConfig = !isNew && s.fee_config_base_amount === null
          const disabled = notEnrolled || noConfig

          const ov = overrides[s.id]
          const discountMode = ov ? ov.discount_mode : s.discount_mode
          const discountValue = ov ? Number(ov.discount_value) || 0 : s.discount_value

          const invoiceAmt = isNew
            ? (Number(template.amount) || null)
            : s.fee_config_base_amount !== null
              ? applyDiscountClient(s.fee_config_base_amount, discountMode, discountValue)
              : null

          const invoiceTitle = isNew
            ? template.title
            : buildTitle(template.title || 'Tuition Fee', s.grade_level, s.section, s.academic_year_name)

          return (
            <tr key={s.id}
              onClick={() => !disabled && onToggle(s.id)}
              className={`transition-colors ${
                disabled
                  ? 'opacity-40 cursor-not-allowed bg-slate-50/40'
                  : isSelected
                  ? 'bg-blue-50/60 hover:bg-blue-50/80 cursor-pointer'
                  : 'hover:bg-slate-50/60 cursor-pointer'
              }`}
            >
              <td className="p-3 align-middle">
                <div onClick={e => { e.stopPropagation(); if (!disabled) onToggle(s.id) }}>
                  {isSelected
                    ? <CheckSquare size={16} className="text-blue-600" />
                    : <Square size={16} className="text-slate-300" />}
                </div>
              </td>

              <td className="p-3 align-middle">
                <div className="font-bold text-slate-900 leading-tight">{s.first_name} {s.last_name}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">#{s.admission_number}</div>
                {notEnrolled && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertCircle size={10} className="text-slate-400" />
                    <span className="text-[9px] text-slate-400 font-bold">Not enrolled this year</span>
                  </div>
                )}
                {noConfig && !notEnrolled && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertTriangle size={10} className="text-amber-500" />
                    <span className="text-[9px] text-amber-600 font-bold">No fee config — contact Admin</span>
                  </div>
                )}
              </td>

              {/* Student status badge */}
              <td className="p-3 align-middle">
                <StudentStatusBadge status={s.status} />
              </td>

              <td className="p-3 align-middle text-slate-700 font-semibold text-xs">
                {s.grade_level ? `${s.grade_level} – ${s.section}` : <span className="text-slate-300">—</span>}
              </td>

              {/* Discount cell — auto-pending only */}
              {!isNew && (
                <td className="p-3 align-middle" onClick={e => e.stopPropagation()}>
                  <DiscountCell
                    student={s}
                    override={overrides[s.id]}
                    onChange={ov => onOverrideChange(s.id, ov)}
                  />
                </td>
              )}

              {/* Fee config — auto-pending only */}
              {!isNew && (
                <td className="p-3 align-middle text-right">
                  {s.fee_config_base_amount !== null
                    ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-slate-800 font-bold">{fmt(s.fee_config_base_amount)}</span>
                        {(ov || s.discount_value > 0) && <span className="text-[10px] text-slate-400">base</span>}
                      </div>
                    )
                    : <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-amber-50 text-amber-600 border-amber-200">No Config</span>}
                </td>
              )}

              {/* This invoice amount */}
              <td className="p-3 align-middle text-right">
                {disabled
                  ? <span className="text-slate-300 text-xs">—</span>
                  : invoiceAmt !== null && invoiceAmt >= 0
                    ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-blue-700 font-black text-[13px]">{fmt(invoiceAmt)}</span>
                        {!isNew && (
                          <span className="text-[9px] text-slate-400 truncate max-w-[140px]" title={invoiceTitle}>{invoiceTitle}</span>
                        )}
                      </div>
                    )
                    : <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-slate-100 text-slate-400 border-slate-200">—</span>}
              </td>

              {/* Existing invoice status */}
              <td className="p-3 align-middle text-center">
                {s.existing_invoice ? (
                  <div className="flex flex-col items-center gap-1">
                    <StatusPill status={s.existing_invoice.status} />
                    <span className="text-[9px] text-slate-400">{fmt(s.existing_invoice.total_amount)}</span>
                  </div>
                ) : (
                  <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider">None</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Pocket money table ───────────────────────────────────────────────────────

function PocketTable({
  students, selectedIds, onToggle, config, setConfig,
}: {
  students: BulkStudent[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  config: PocketConfig
  setConfig: (c: Partial<PocketConfig>) => void
}) {
  const isPerStudent = config.mode === 'per-student'
  const isDebit = config.type === 'DEBIT'
  const flatAmt = Number(config.flatAmount) || 0

  return (
    <table className="w-full text-sm text-left border-collapse min-w-[640px]">
      <thead>
        <tr className="bg-slate-50 border-b text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <th className="p-3 w-9" />
          <th className="p-3">Student</th>
          <th className="p-3">Status</th>
          <th className="p-3">Class</th>
          <th className="p-3 text-right">Balance</th>
          {isPerStudent && (
            <>
              <th className="p-3 text-right">Amount (₹)</th>
              <th className="p-3">Reason</th>
            </>
          )}
          {!isPerStudent && <th className="p-3 text-right">After</th>}
          <th className="p-3 text-center w-20">Tx Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {students.map(s => {
          const isSelected = selectedIds.has(s.id)
          const perAmt = Number(config.perAmounts[s.id]) || 0
          const thisAmt = isPerStudent ? perAmt : flatAmt
          const afterBal = isDebit ? s.pocket_money_balance - thisAmt : s.pocket_money_balance + thisAmt
          const isLowBal = isDebit && isSelected && thisAmt > 0 && s.pocket_money_balance < thisAmt

          return (
            <tr key={s.id}
              onClick={() => !isPerStudent && onToggle(s.id)}
              className={`transition-colors ${
                isLowBal ? 'bg-rose-50/60 hover:bg-rose-50/80' :
                isSelected ? 'bg-blue-50/50 hover:bg-blue-50/70' :
                'hover:bg-slate-50/60'
              } ${!isPerStudent ? 'cursor-pointer' : ''}`}
            >
              <td className="p-3 align-middle">
                <div onClick={e => { e.stopPropagation(); onToggle(s.id) }} className="cursor-pointer">
                  {isSelected
                    ? <CheckSquare size={16} className={isLowBal ? 'text-rose-500' : 'text-blue-600'} />
                    : <Square size={16} className="text-slate-300" />}
                </div>
              </td>
              <td className="p-3 align-middle">
                <div className="font-bold text-slate-900 leading-tight">{s.first_name} {s.last_name}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">#{s.admission_number}</div>
              </td>
              <td className="p-3 align-middle">
                <StudentStatusBadge status={s.status} />
              </td>
              <td className="p-3 align-middle text-slate-700 font-semibold text-xs">
                {s.grade_level ? `${s.grade_level} – ${s.section}` : <span className="text-slate-300">—</span>}
              </td>
              <td className="p-3 align-middle text-right">
                <span className={`font-black text-sm ${s.pocket_money_balance > 300 ? 'text-emerald-600' : s.pocket_money_balance >= 0 ? 'text-amber-500' : 'text-rose-600'}`}>
                  {fmt(s.pocket_money_balance)}
                </span>
              </td>

              {isPerStudent && (
                <>
                  <td className="p-3 align-middle" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[11px] font-bold">₹</span>
                        <input type="number" min={0} value={config.perAmounts[s.id] ?? ''}
                          onChange={e => {
                            if (!isSelected) onToggle(s.id)
                            setConfig({ perAmounts: { ...config.perAmounts, [s.id]: e.target.value } })
                          }}
                          onWheel={e => e.currentTarget.blur()}
                          placeholder="0"
                          className={`pl-5 pr-2 py-1.5 text-sm font-bold border rounded-lg w-24 text-right focus:outline-none focus:ring-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isLowBal ? 'border-rose-300 bg-rose-50 focus:ring-rose-400 text-rose-800' : 'border-slate-200 bg-white focus:ring-blue-400 text-slate-800'}`} />
                      </div>
                    </div>
                  </td>
                  <td className="p-3 align-middle" onClick={e => e.stopPropagation()}>
                    <input value={config.perReasons[s.id] ?? ''}
                      onChange={e => setConfig({ perReasons: { ...config.perReasons, [s.id]: e.target.value } })}
                      placeholder="Enter reason…"
                      className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                  </td>
                </>
              )}

              {!isPerStudent && (
                <td className="p-3 align-middle text-right">
                  {isSelected && thisAmt > 0
                    ? <span className={`font-bold text-sm ${afterBal < 0 ? 'text-rose-600' : afterBal < 100 ? 'text-amber-500' : 'text-slate-700'}`}>{fmt(afterBal)}</span>
                    : <span className="text-slate-300 text-xs">—</span>}
                </td>
              )}

              <td className="p-3 align-middle text-center">
                {isLowBal
                  ? <div className="flex items-center justify-center gap-1"><AlertTriangle size={13} className="text-rose-500" /><span className="text-[9px] text-rose-700 font-bold uppercase">Low</span></div>
                  : isSelected
                  ? <div className="flex items-center justify-center gap-1"><CheckCircle2 size={13} className="text-emerald-500" /><span className="text-[9px] text-emerald-700 font-bold uppercase">Ready</span></div>
                  : <span className="text-slate-300 text-xs">—</span>}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BulkOperationsClient({
  initialStudents, classes, academicYears, initialYearId,
}: {
  initialStudents: BulkStudent[]
  classes: { id: string; grade_level: string; section: string }[]
  academicYears: { id: string; name: string; is_active: boolean }[]
  initialYearId: string | null
}) {
  const [activeTab, setActiveTab] = useState<TabId>('invoices')
  const [students, setStudents] = useState<BulkStudent[]>(initialStudents)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [discountOverrides, setDiscountOverrides] = useState<Record<string, DiscountOverride>>({})

  const [filters, setFilters] = useState<FiltersState>({
    year_id: initialYearId ?? (academicYears[0]?.id ?? ''),
    class_id: 'All',
    gender: 'All',
    status: 'Active',
    query: '',
  })

  const [isLoadingStudents, startLoadingStudents] = useTransition()
  const [isSubmitting, startSubmitting] = useTransition()

  const [template, setTemplate] = useState<InvoiceTemplate>({
    title: 'Tuition Fee',
    amount: '',
    dueDate: todayPlus30(),
    mode: 'issue-new',
  })

  const [pocket, setPocket] = useState<PocketConfig>({
    type: 'DEBIT',
    mode: 'flat',
    flatAmount: '',
    flatReason: '',
    paymentMode: 'Cash',
    transactionReference: '',
    perAmounts: {},
    perReasons: {},
  })

  // ── Load students (never called from inside a state updater) ───────────────
  const loadStudents = useCallback((f: FiltersState) => {
    if (!f.year_id) return
    startLoadingStudents(async () => {
      const result = await getBulkStudentsAction({
        academic_year_id: f.year_id,
        class_id: f.class_id !== 'All' ? f.class_id : undefined,
        gender: f.gender !== 'All' ? f.gender : undefined,
        status: f.status !== 'All' ? f.status : undefined,
        query: f.query || undefined,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        setStudents(result.students)
        setSelectedIds(prev => {
          const visible = new Set(result.students.map(s => s.id))
          return new Set([...prev].filter(id => visible.has(id)))
        })
        setDiscountOverrides({})
      }
    })
  }, [])

  // ── Safe filter change — computes next state then schedules load ───────────
  const handleFilterChange = useCallback((partial: Partial<FiltersState>) => {
    setFilters(prev => {
      const next = { ...prev, ...partial }
      setTimeout(() => loadStudents(next), 0)
      return next
    })
  }, [loadStudents])

  // Debounced search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [localQuery, setLocalQuery] = useState(filters.query)
  const handleQueryChange = (val: string) => {
    setLocalQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => handleFilterChange({ query: val }), 380)
  }
  useEffect(() => { setLocalQuery(filters.query) }, [filters.query])

  // ── Derived lists ──────────────────────────────────────────────────────────
  // auto-pending mode: only show students with no existing invoice for this enrollment
  const displayedStudents = (activeTab === 'invoices' && template.mode === 'auto-pending')
    ? students.filter(s => !s.existing_invoice && s.enrollment_id)
    : students

  const selectedStudents = displayedStudents.filter(s => selectedIds.has(s.id))
  const allChecked = displayedStudents.length > 0 && displayedStudents.every(s => selectedIds.has(s.id))
  const someChecked = displayedStudents.some(s => selectedIds.has(s.id)) && !allChecked

  const activeYear = academicYears.find(y => y.id === filters.year_id) || null

  const toggleAll = () => {
    if (allChecked || someChecked) {
      setSelectedIds(new Set())
    } else {
      // In auto-pending mode, skip no-config students (they can't be invoiced)
      const eligible = (activeTab === 'invoices' && template.mode === 'auto-pending')
        ? displayedStudents.filter(s => s.fee_config_base_amount !== null)
        : displayedStudents
      setSelectedIds(new Set(eligible.map(s => s.id)))
    }
  }
  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Invoice submit ─────────────────────────────────────────────────────────
  const handleGenerateInvoices = () => {
    if (!template.title.trim()) { toast.error('Enter an invoice title.'); return }
    if (!template.dueDate) { toast.error('Set a due date.'); return }

    const isNew = template.mode === 'issue-new'

    if (isNew) {
      // issue-new: needs a flat amount; any selected enrolled student is valid
      const amt = Number(template.amount)
      if (!amt || amt <= 0) { toast.error('Enter a valid invoice amount.'); return }
      if (!selectedStudents.length) { toast.error('Select at least one student.'); return }
      const notEnrolled = selectedStudents.filter(s => !s.enrollment_id)
      if (notEnrolled.length === selectedStudents.length) { toast.error('None of the selected students are enrolled this year.'); return }

      const items = selectedStudents
        .filter(s => s.enrollment_id)
        .map(s => ({
          student_id: s.id,
          enrollment_id: s.enrollment_id,
          invoice_title: template.title.trim(),
          total_amount: amt,
          due_date: template.dueDate,
        }))

      startSubmitting(async () => {
        const result = await bulkGenerateInvoicesAction(items)
        if (result.error) { toast.error(result.error); return }
        toast.success(`${result.successCount} invoice${result.successCount !== 1 ? 's' : ''} issued.`)
        setSelectedIds(new Set())
        loadStudents(filters)
      })
    } else {
      // auto-pending: needs fee config; blocks no-config students
      const noConfigStudents = selectedStudents.filter(s => s.fee_config_base_amount === null)
      if (noConfigStudents.length > 0) {
        // Auto-deselect no-config students and surface the issue
        setSelectedIds(prev => {
          const next = new Set(prev)
          noConfigStudents.forEach(s => next.delete(s.id))
          return next
        })
        toast.error(`${noConfigStudents.length} student(s) have no fee configuration and were deselected. Ask an Admin to add it in Settings → Fee Configurations.`)
        return
      }

      const eligible = selectedStudents.filter(s => s.enrollment_id && s.fee_config_base_amount !== null)
      if (!eligible.length) { toast.error('No eligible students selected.'); return }

      const items = eligible.map(s => {
        const ov = discountOverrides[s.id]
        const mode = ov ? ov.discount_mode : s.discount_mode
        const val = ov ? Number(ov.discount_value) || 0 : s.discount_value
        return {
          student_id: s.id,
          enrollment_id: s.enrollment_id,
          invoice_title: buildTitle(template.title, s.grade_level, s.section, s.academic_year_name),
          total_amount: applyDiscountClient(s.fee_config_base_amount!, mode, val),
          due_date: template.dueDate,
        }
      })

      const dirtyOverrides = Object.entries(discountOverrides)
        .filter(([sid]) => eligible.some(s => s.id === sid))
        .map(([sid, ov]) => {
          const s = eligible.find(s => s.id === sid)!
          return { enrollment_id: s.enrollment_id!, discount_type: ov.discount_type, discount_mode: ov.discount_mode, discount_value: Number(ov.discount_value) || 0 }
        })

      startSubmitting(async () => {
        if (dirtyOverrides.length > 0) {
          const discResult = await updateEnrollmentDiscountsAction(dirtyOverrides)
          if (discResult.error) { toast.error(`Discount update failed: ${discResult.error}`); return }
        }
        const result = await bulkGenerateInvoicesAction(items)
        if (result.error) { toast.error(result.error); return }
        toast.success(`${result.successCount} invoice${result.successCount !== 1 ? 's' : ''} generated.`)
        setSelectedIds(new Set())
        setDiscountOverrides({})
        loadStudents(filters)
      })
    }
  }

  // ── Pocket money submit ────────────────────────────────────────────────────
  const handlePocketSubmit = () => {
    if (!selectedStudents.length) { toast.error('Select at least one student.'); return }
    const isFlat = pocket.mode === 'flat'
    const flatAmt = Number(pocket.flatAmount)
    if (isFlat && flatAmt <= 0) { toast.error('Enter a valid amount.'); return }
    if (isFlat && !pocket.flatReason.trim()) { toast.error('Enter a reason.'); return }
    if (pocket.type === 'CREDIT' && pocket.paymentMode !== 'Cash' && !pocket.transactionReference.trim()) {
      toast.error('Transaction reference is required for non-cash credits.')
      return
    }

    const items: {
      student_id: string
      amount: number
      description: string
      type: 'CREDIT' | 'DEBIT'
      payment_mode: PocketPaymentMode
      transaction_reference?: string
    }[] = []
    const insufficient: string[] = []

    for (const s of selectedStudents) {
      const amt = isFlat ? flatAmt : (Number(pocket.perAmounts[s.id]) || 0)
      const reason = isFlat ? pocket.flatReason : (pocket.perReasons[s.id] || '')
      if (!amt || amt <= 0) continue
      if (!reason.trim()) { toast.error(`Enter a reason for ${s.first_name} ${s.last_name}.`); return }
      if (pocket.type === 'DEBIT' && s.pocket_money_balance < amt) {
        insufficient.push(`${s.first_name} ${s.last_name} (${fmt(s.pocket_money_balance)})`)
      }
      items.push({
        student_id: s.id,
        amount: amt,
        description: reason,
        type: pocket.type,
        payment_mode: pocket.paymentMode,
        transaction_reference: pocket.transactionReference.trim() || undefined,
      })
    }

    if (!items.length) { toast.error('No valid amounts entered.'); return }

    if (insufficient.length) {
      const msg = `${insufficient.length} student(s) have insufficient balance:\n\n${insufficient.slice(0, 5).join('\n')}${insufficient.length > 5 ? `\n…and ${insufficient.length - 5} more` : ''}\n\nThis will result in negative balances. Proceed?`
      if (!window.confirm(msg)) return
    }

    startSubmitting(async () => {
        const result = await bulkPocketMoneyAction(items)
        if (result.error) { toast.error(result.error); return }
        toast.success(`${result.successCount} transaction${result.successCount !== 1 ? 's' : ''} processed.`)
        setSelectedIds(new Set())
        setPocket(prev => ({
          ...prev,
          flatAmount: '',
          flatReason: '',
          paymentMode: 'Cash',
          transactionReference: '',
          perAmounts: {},
          perReasons: {},
        }))
        loadStudents(filters)
      })
  }

  const noYear = !filters.year_id
  const pendingInvoiceCount = students.filter(s => !s.existing_invoice && s.enrollment_id).length
  const eligibleInvoiceCount = template.mode === 'issue-new'
    ? selectedStudents.filter(s => s.enrollment_id).length
    : selectedStudents.filter(s => s.enrollment_id && s.fee_config_base_amount !== null).length

  const tabBtn = (id: TabId, icon: React.ReactNode, label: string) => (
    <button type="button" onClick={() => setActiveTab(id)}
      className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
        activeTab === id
          ? 'bg-white text-blue-700 shadow border border-slate-200/70'
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/70'
      }`}>
      {icon}{label}
    </button>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-0 min-h-screen pb-36">

      {/* ── Header card ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900">Bulk Operations</h1>
            <p className="text-xs text-slate-500 mt-0.5">Generate invoices and manage pocket money across multiple students at once.</p>
          </div>
          <button type="button" onClick={() => loadStudents(filters)} disabled={isLoadingStudents || noYear}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-40">
            <RefreshCw size={12} className={isLoadingStudents ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2.5 items-center">
          {/* Academic Year — active years only */}
          <div className="flex items-center gap-1.5">
            <CalendarDays size={14} className="text-slate-400 shrink-0" />
            {academicYears.length === 0 ? (
              <span className="text-xs text-amber-600 font-semibold px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">No active years. Contact Admin.</span>
            ) : (
              <select value={filters.year_id} onChange={e => handleFilterChange({ year_id: e.target.value })}
                disabled={isLoadingStudents} className={`${selectCls} font-semibold min-w-[150px]`}>
                <option value="">Select Year…</option>
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>{y.name}{y.is_active ? ' ✓' : ''}</option>
                ))}
              </select>
            )}
          </div>

          <select value={filters.class_id} onChange={e => handleFilterChange({ class_id: e.target.value })} disabled={isLoadingStudents || noYear} className={selectCls}>
            <option value="All">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.grade_level} – {c.section}</option>)}
          </select>

          <select value={filters.gender} onChange={e => handleFilterChange({ gender: e.target.value })} disabled={isLoadingStudents || noYear} className={selectCls}>
            <option value="All">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>

          <select value={filters.status} onChange={e => handleFilterChange({ status: e.target.value })} disabled={isLoadingStudents || noYear} className={selectCls}>
            <option value="Active">Active</option>
            <option value="All">All Statuses</option>
            <option value="Alumni">Alumni</option>
            <option value="Dropout">Dropout</option>
          </select>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input value={localQuery} onChange={e => handleQueryChange(e.target.value)}
              placeholder="Search name or admission…"
              className="pl-8 pr-7 h-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 w-52 bg-white disabled:opacity-50"
              disabled={isLoadingStudents || noYear} />
            {localQuery && (
              <button type="button" onClick={() => handleQueryChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                <X size={12} />
              </button>
            )}
          </div>

          {isLoadingStudents && <Loader2 size={15} className="text-blue-500 animate-spin shrink-0" />}
        </div>

        {/* Summary chips */}
        {!noYear && (
          <SummaryChips
            activeTab={activeTab}
            students={displayedStudents}
            selectedStudents={selectedStudents}
            template={template}
            pocket={pocket}
            overrides={discountOverrides}
          />
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex bg-slate-100/80 p-1.5 rounded-xl border border-slate-200 shadow-sm">
          {tabBtn('invoices', <FileText size={14} />, 'Fee Invoices')}
          {tabBtn('pocket-money', <Wallet size={14} />, 'Pocket Money')}
        </div>

        {/* auto-pending mode: show count badge indicating how many students need invoices */}
        {activeTab === 'invoices' && !noYear && template.mode === 'auto-pending' && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Filter size={12} className="text-emerald-500" />
            <span>Showing <span className="font-bold text-emerald-700">{pendingInvoiceCount}</span> student{pendingInvoiceCount !== 1 ? 's' : ''} without an invoice this year</span>
          </div>
        )}
      </div>

      {/* ── No year state ── */}
      {noYear ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-10 text-center">
          <CalendarDays size={32} className="mx-auto text-amber-400 mb-3" />
          <p className="font-bold text-amber-800">Select an Active Academic Year above to load students.</p>
          {academicYears.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">No active academic years found. Ask an Admin to activate one in Settings.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left: config panel */}
          <div className="w-full lg:w-72 shrink-0">
            {activeTab === 'invoices'
              ? <InvoicePanel template={template} set={p => setTemplate(prev => ({ ...prev, ...p }))} selectedStudents={selectedStudents} overrides={discountOverrides} />
              : <PocketPanel config={pocket} set={p => setPocket(prev => ({ ...prev, ...p }))} selectedStudents={selectedStudents} />}
          </div>

          {/* Right: table */}
          <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50/80 border-b flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <button type="button" onClick={toggleAll} className="text-slate-400 hover:text-blue-600 transition-colors"
                  title={allChecked ? 'Deselect all' : 'Select all (eligible only)'}>
                  {allChecked
                    ? <CheckSquare size={17} className="text-blue-600" />
                    : someChecked
                    ? <CheckSquare size={17} className="text-blue-400" />
                    : <Square size={17} />}
                </button>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  {displayedStudents.length} student{displayedStudents.length !== 1 ? 's' : ''}
                  {displayedStudents.length !== students.length && (
                    <span className="text-slate-300 font-normal"> (filtered from {students.length})</span>
                  )}
                </span>
              </div>
              {selectedIds.size > 0 && (
                <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded border border-blue-100">
                  {selectedIds.size} selected
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              {isLoadingStudents ? (
                <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm font-medium">Loading students…</span>
                </div>
              ) : displayedStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
                  <Users size={32} className="opacity-40" />
                  <p className="text-sm font-semibold">
                    {activeTab === 'invoices' && template.mode === 'auto-pending' ? 'All students already have invoices for this year.' : 'No students match your filters.'}
                  </p>
                </div>
              ) : activeTab === 'invoices' ? (
                <InvoiceTable
                  students={displayedStudents}
                  selectedIds={selectedIds}
                  onToggle={toggleOne}
                  template={template}
                  overrides={discountOverrides}
                  onOverrideChange={(id, ov) => setDiscountOverrides(prev => {
                    if (!ov) { const next = { ...prev }; delete next[id]; return next }
                    return { ...prev, [id]: ov }
                  })}
                />
              ) : (
                <PocketTable
                  students={displayedStudents}
                  selectedIds={selectedIds}
                  onToggle={toggleOne}
                  config={pocket}
                  setConfig={p => setPocket(prev => ({ ...prev, ...p }))}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Floating action bar ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
          <div className="pointer-events-auto mb-6 mx-4 w-full max-w-2xl bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="bg-blue-500 text-white text-sm font-black px-2.5 py-1 rounded-lg">{selectedIds.size}</span>
              <span className="text-sm font-semibold text-slate-200">student{selectedIds.size !== 1 ? 's' : ''} selected</span>
              <button type="button" onClick={() => setSelectedIds(new Set())} className="text-slate-500 hover:text-slate-300 ml-1">
                <X size={13} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === 'invoices' ? (
                <>
                  <span className="text-xs text-slate-500">{eligibleInvoiceCount} eligible</span>
                  <button type="button" onClick={handleGenerateInvoices} disabled={isSubmitting}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 rounded-xl text-sm font-bold transition-all">
                    {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
                    {template.mode === 'issue-new' ? `Issue ${eligibleInvoiceCount} Invoice${eligibleInvoiceCount !== 1 ? 's' : ''}` : `Generate ${eligibleInvoiceCount} Invoice${eligibleInvoiceCount !== 1 ? 's' : ''}`}
                  </button>
                </>
              ) : (
                <button type="button" onClick={handlePocketSubmit} disabled={isSubmitting}
                  className={`flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${pocket.type === 'DEBIT' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : pocket.type === 'DEBIT' ? <ArrowUpFromLine size={14} /> : <ArrowDownToLine size={14} />}
                  Process {selectedIds.size} {pocket.type === 'DEBIT' ? 'Deduction' : 'Deposit'}{selectedIds.size !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
