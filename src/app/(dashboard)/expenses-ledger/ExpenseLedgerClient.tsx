'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  Plus, Download, X, Loader2, TrendingDown, TrendingUp,
  ChevronDown, ChevronRight, FileText, Eye, Paperclip,
  IndianRupee, Trash2, AlertCircle, Receipt, Filter,
  ArrowDownLeft, ArrowUpRight, Landmark,
} from 'lucide-react'
import {
  createExpenseBill, recordBillPayment, addBillItem, recordOtherIncome,
  getExpenseBills, getOtherIncome, getLoans, createLoan, addLoanTransaction,
  type ExpenseBillSummaryRow, type OtherIncomeRow,
  type InternalLoanRow, type LoanTransactionRow,
} from '@/actions/expenses.actions'
import { getUploadUrl, getViewUrls } from '@/actions/storage.actions'

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Maintenance', 'Electricity', 'Water', 'Stationery', 'Furniture',
  'IT / Tech', 'Transport', 'Canteen / Mess', 'Events', 'Salary (Non-Staff)',
  'Cleaning / Sanitation', 'Security', 'Medical', 'Books / Library',
  'Construction', 'Bank Charges', 'Miscellaneous',
]
const COST_CENTERS = ['Main School', 'Hostel', 'Mess', 'Transport']
const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'UPI', 'Cheque']
const INCOME_CATEGORIES = [
  'Rental Income', 'Bank Interest', 'Scrap/Asset Sale', 'Donation', 'Other',
]

const STATUS_STYLES: Record<string, { dot: string; badge: string }> = {
  Unpaid:    { dot: 'bg-rose-500',    badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  Partial:   { dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  Paid:      { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Cancelled: { dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-500 border-slate-200' },
}

const CC_DOT: Record<string, string> = {
  'Main School': 'bg-blue-500',
  'Hostel':      'bg-violet-500',
  'Mess':        'bg-orange-500',
  'Transport':   'bg-teal-500',
}

const LOAN_PAYMENT_MODES = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Internal Adjustment']

const LOAN_STATUS_STYLES: Record<string, { dot: string; badge: string }> = {
  Active:   { dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  Settled:  { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Defaulted:{ dot: 'bg-rose-500',    badge: 'bg-rose-50 text-rose-700 border-rose-200' },
}

const TXN_TYPE_LABELS: Record<string, string> = {
  INITIAL_DISBURSEMENT: 'Disbursement',
  PRINCIPAL_REPAYMENT: 'Principal Repayment',
  INTEREST_PAYMENT: 'Interest Payment',
}

const TXN_TYPE_COLORS: Record<string, string> = {
  INITIAL_DISBURSEMENT: 'bg-blue-50 text-blue-700 border-blue-200',
  PRINCIPAL_REPAYMENT:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  INTEREST_PAYMENT:     'bg-amber-50 text-amber-700 border-amber-200',
}

const INCOME_CAT_COLORS: Record<string, string> = {
  'Rental Income':    'bg-blue-50 text-blue-700 border-blue-100',
  'Bank Interest':    'bg-emerald-50 text-emerald-700 border-emerald-100',
  'Scrap/Asset Sale': 'bg-amber-50 text-amber-700 border-amber-100',
  'Donation':         'bg-purple-50 text-purple-700 border-purple-100',
  'Other':            'bg-slate-100 text-slate-600 border-slate-200',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(n: number) {
  return '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function today() { return new Date().toISOString().split('T')[0] }

function csvEscape(v: unknown): string {
  const s = String(v ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

function needsBankName(mode: string) {
  return mode !== 'Cash' && mode !== 'Internal Adjustment'
}

function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const lines = [headers.map(csvEscape).join(','), ...rows.map(r => r.map(csvEscape).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Shared Field Components ──────────────────────────────────────────────────

function Field({ label, name, type = 'text', required, value, onChange, placeholder, maxDate, note }: {
  label: string; name: string; type?: string; required?: boolean
  value: string; onChange: (v: string) => void; placeholder?: string; maxDate?: string; note?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      <input name={name} type={type} required={required} value={value}
        onChange={e => onChange(e.target.value)} placeholder={placeholder} max={maxDate}
        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {note && <p className="text-[10px] text-slate-400 mt-1">{note}</p>}
    </div>
  )
}

function SelectField({ label, name, required, value, onChange, options }: {
  label: string; name: string; required?: boolean
  value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <select name={name} required={required} value={value} onChange={e => onChange(e.target.value)}
          className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2.5 pr-9 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white transition cursor-pointer">
          <option value="">Select…</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  )
}

function ErrBanner({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
      <AlertCircle size={15} className="mt-0.5 shrink-0" /> {msg}
    </div>
  )
}

// ─── View Receipts ─────────────────────────────────────────────────────────────

function ViewReceiptsBtn({ fileKeys, label }: { fileKeys: string[]; label?: string }) {
  const [loading, setLoading] = useState(false)
  if (!fileKeys.length) return null
  const handleView = async () => {
    setLoading(true)
    try { const r = await getViewUrls(fileKeys); r.forEach(x => window.open(x.url, '_blank')) }
    catch { toast.error('Could not fetch receipt URLs.') }
    finally { setLoading(false) }
  }
  return (
    <button onClick={handleView} disabled={loading}
      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg transition disabled:opacity-60">
      {loading ? <Loader2 size={10} className="animate-spin" /> : <Eye size={10} />}
      {label ?? `${fileKeys.length} file${fileKeys.length > 1 ? 's' : ''}`}
    </button>
  )
}

// ─── File Picker Sub-Component ─────────────────────────────────────────────────

function FilePicker({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
              <span className="truncate text-slate-700 font-medium">{f.name}</span>
              <button onClick={() => onChange(files.filter((_, idx) => idx !== i))} className="ml-2 text-slate-300 hover:text-rose-500 transition shrink-0">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 rounded-lg py-2.5 cursor-pointer transition group">
        <Paperclip size={13} className="text-slate-400 group-hover:text-blue-500" />
        <span className="text-xs font-medium text-slate-400 group-hover:text-blue-600">
          {files.length > 0 ? 'Add more files' : 'Attach receipts / quotes'}
        </span>
        <input ref={ref} type="file" multiple accept="image/*,application/pdf"
          onChange={e => { if (e.target.files) onChange([...files, ...Array.from(e.target.files)]) }}
          className="hidden" />
      </label>
    </div>
  )
}

// ─── Create Bill Drawer ────────────────────────────────────────────────────────

type LineItem = { description: string; amount: string }

function BillDrawer({ open, onClose, onSaved, academicYearId }: {
  open: boolean; onClose: () => void; onSaved: () => void; academicYearId: string
}) {
  const [date, setDate] = useState(today())
  const [dueDate, setDueDate] = useState('')
  const [costCenter, setCostCenter] = useState('Main School')
  const [category, setCategory] = useState('')
  const [payee, setPayee] = useState('')
  const [items, setItems] = useState<LineItem[]>([{ description: '', amount: '' }])
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) {
      setDate(today()); setDueDate(''); setCostCenter('Main School')
      setCategory(''); setPayee(''); setItems([{ description: '', amount: '' }])
      setFiles([]); setErr('')
    }
  }, [open])

  const setItem = (i: number, k: keyof LineItem, v: string) =>
    setItems(prev => { const n = [...prev]; n[i] = { ...n[i], [k]: v }; return n })

  const handleSubmit = async () => {
    setSaving(true); setErr('')
    if (!category) { setErr('Please select a category.'); setSaving(false); return }
    if (!payee.trim()) { setErr('Payee name is required.'); setSaving(false); return }

    const MAX_ITEM_ABS = 10_000_000
    const parsed = items.map(it => ({ description: it.description.trim(), amount: parseFloat(it.amount) }))
    for (const it of parsed) {
      if (!it.description) { setErr('Each line item needs a description.'); setSaving(false); return }
      if (isNaN(it.amount) || it.amount === 0) { setErr('Line item amount cannot be zero.'); setSaving(false); return }
      if (Math.abs(it.amount) > MAX_ITEM_ABS) {
        setErr(`A single line item cannot exceed ₹${MAX_ITEM_ABS.toLocaleString('en-IN')}.`)
        setSaving(false); return
      }
    }
    const billTotal = parsed.reduce((s, it) => s + it.amount, 0)
    if (billTotal < 0.01) {
      setErr(`Bill total (${fmtINR(billTotal)}) must be greater than ₹0. Adjust your line items.`)
      setSaving(false); return
    }

    const result = await createExpenseBill({
      academic_year_id: academicYearId,
      date_incurred: date,
      due_date: dueDate || undefined,
      cost_center: costCenter,
      category,
      payee_name: payee,
      items: parsed,
    })
    setSaving(false)
    if (result.error) { setErr(result.error); return }
    toast.success('Bill recorded.')
    onSaved(); onClose()
  }

  if (!open) return null
  const total = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-250">
        <div className="px-5 py-4 border-b shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">New Expense Bill</h2>
            <p className="text-xs text-slate-400 mt-0.5">Voucher auto-assigned on save</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 transition"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <ErrBanner msg={err} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" name="date" type="date" required value={date} onChange={setDate} maxDate={today()} />
            <Field label="Due Date" name="dueDate" type="date" value={dueDate} onChange={setDueDate} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Cost Center" name="costCenter" required value={costCenter} onChange={setCostCenter} options={COST_CENTERS} />
            <SelectField label="Category" name="category" required value={category} onChange={setCategory} options={CATEGORIES} />
          </div>
          <Field label="Payee / Vendor Name" name="payee" required value={payee} onChange={setPayee} placeholder="e.g. Sharma Electricals" />

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Line Items <span className="text-rose-400">*</span>
              </label>
              {total !== 0 && (
                <span className={`text-xs font-bold ${total < 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                  {total < 0 ? '−' : ''}{fmtINR(total)}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" value={it.description} onChange={e => setItem(i, 'description', e.target.value)}
                    placeholder="Description (e.g. Painting – Block A)"
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white" />
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                    <input type="number" value={it.amount} onChange={e => setItem(i, 'amount', e.target.value)}
                      placeholder="0" step="0.01" onWheel={e => e.currentTarget.blur()}
                      className="w-full border border-slate-200 rounded-lg pl-6 pr-2 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                  <button type="button" onClick={() => setItems(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)}
                    disabled={items.length === 1}
                    className="p-2 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition disabled:opacity-30">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setItems(prev => [...prev, { description: '', amount: '' }])}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition mt-1">
                <Plus size={12} /> Add Line Item
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Use negative amounts for discounts or credits.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Documents (optional)</label>
            <FilePicker files={files} onChange={setFiles} />
          </div>
        </div>

        <div className="px-5 py-4 border-t shrink-0 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 border border-slate-200 bg-white text-slate-700 rounded-lg py-2.5 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Record Bill'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Line Item Drawer ──────────────────────────────────────────────────────

function AddItemDrawer({ open, onClose, onSaved, bill }: {
  open: boolean; onClose: () => void; onSaved: () => void; bill: ExpenseBillSummaryRow | null
}) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { if (open) { setDescription(''); setAmount(''); setErr('') } }, [open])

  const MAX_ITEM_ABS = 10_000_000

  const handleSubmit = async () => {
    if (!bill) return
    setSaving(true); setErr('')
    const amt = parseFloat(amount)
    if (!description.trim()) { setErr('Description is required.'); setSaving(false); return }
    if (isNaN(amt) || amt === 0) { setErr('Amount cannot be zero.'); setSaving(false); return }
    if (Math.abs(amt) > MAX_ITEM_ABS) {
      setErr(`Amount cannot exceed ₹${MAX_ITEM_ABS.toLocaleString('en-IN')}.`)
      setSaving(false); return
    }
    const newTotal = bill.total_bill_amount + amt
    if (newTotal < 0.01) {
      setErr(`This adjustment would make the bill total ${fmtINR(newTotal)}, which is invalid. The bill total must stay above ₹0.`)
      setSaving(false); return
    }
    const result = await addBillItem({ bill_id: bill.bill_id, description: description.trim(), amount: amt })
    setSaving(false)
    if (result.error) { setErr(result.error); return }
    toast.success('Line item added.')
    onSaved(); onClose()
  }

  if (!open || !bill) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-250">
        <div className="px-5 py-4 border-b shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Add to Bill</h2>
            <p className="text-xs text-slate-400 mt-0.5">{bill.voucher_number ?? 'Bill'} · {bill.payee_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 transition"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Current bill total context */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Current Bill Total</span>
              <span className="font-semibold text-slate-800">{fmtINR(bill.total_bill_amount)}</span>
            </div>
            {bill.items.map(it => (
              <div key={it.id} className="flex justify-between text-xs text-slate-400 pl-2">
                <span className="truncate pr-2">{it.description}</span>
                <span className={`shrink-0 font-medium ${it.amount < 0 ? 'text-emerald-600' : ''}`}>
                  {it.amount < 0 ? '−' : ''}{fmtINR(it.amount)}
                </span>
              </div>
            ))}
          </div>

          <ErrBanner msg={err} />

          <Field label="Description" name="desc" required value={description} onChange={setDescription} placeholder="e.g. Extra electrical fittings" />

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Amount (₹) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0 (negative for discounts)" step="0.01" onWheel={e => e.currentTarget.blur()}
                className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">Use a negative value (e.g. −500) for a discount or credit on this bill.</p>
          </div>

          {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) !== 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">New Bill Total will be</span>
              <span className="text-sm font-bold text-slate-800">
                {fmtINR(bill.total_bill_amount + parseFloat(amount))}
              </span>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t shrink-0 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 border border-slate-200 bg-white text-slate-700 rounded-lg py-2.5 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Add to Bill'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Record Payment Drawer ─────────────────────────────────────────────────────

function RecordPaymentDrawer({ open, onClose, onSaved, bill }: {
  open: boolean; onClose: () => void; onSaved: () => void; bill: ExpenseBillSummaryRow | null
}) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [txnRef, setTxnRef] = useState('')
  const [bankName, setBankName] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { if (open) { setAmount(''); setDate(today()); setPaymentMode('Cash'); setTxnRef(''); setBankName(''); setFiles([]); setErr('') } }, [open])

  const handleSubmit = async () => {
    if (!bill) return
    setSaving(true); setErr('')
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { setErr('Payment amount must be positive.'); setSaving(false); return }
    if (amt > bill.balance_due + 0.001) {
      setErr(`Payment cannot exceed the balance due of ${fmtINR(bill.balance_due)}.`)
      setSaving(false); return
    }
    if (needsBankName(paymentMode) && !bankName.trim()) {
      setErr('Bank name is required for non-cash payments.'); setSaving(false); return
    }

    let receiptKeys: string[] = []
    if (files.length > 0) {
      try {
        receiptKeys = await Promise.all(files.map(async file => {
          const { signedUrl, fileKey } = await getUploadUrl(file.type || 'application/octet-stream')
          const res = await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
          if (!res.ok) throw new Error('Upload failed')
          return fileKey
        }))
      } catch { setErr('Receipt upload failed. Please try again.'); setSaving(false); return }
    }

    const result = await recordBillPayment({
      bill_id: bill.bill_id,
      amount_paid: amt,
      payment_date: date,
      payment_mode: paymentMode,
      transaction_reference: txnRef || undefined,
      bank_name: needsBankName(paymentMode) ? bankName.trim() : undefined,
      receipt_object_keys: receiptKeys.length ? receiptKeys : undefined,
    })
    setSaving(false)
    if (result.error) { setErr(result.error); return }
    toast.success(`Payment recorded · ${result.newStatus}`)
    onSaved(); onClose()
  }

  if (!open || !bill) return null
  const allReceiptKeys = bill.payments.flatMap(p => p.receipt_object_keys ?? [])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-250">
        <div className="px-5 py-4 border-b shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Record Payment</h2>
            <p className="text-xs text-slate-400 mt-0.5">{bill.voucher_number ?? 'Bill'} · {bill.payee_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 transition"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Bill Total</span>
              <span className="font-semibold text-slate-800">{fmtINR(bill.total_bill_amount)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Already Paid</span>
              <span className="font-semibold text-emerald-600">{fmtINR(bill.total_amount_paid)}</span>
            </div>
            <div className="flex justify-between text-xs pt-1.5 border-t border-slate-200">
              <span className="font-semibold text-slate-700">Balance Due</span>
              <span className="font-bold text-rose-600">{fmtINR(bill.balance_due)}</span>
            </div>
          </div>

          <ErrBanner msg={err} />

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Amount Paying (₹) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" min="0.01" step="0.01" onWheel={e => e.currentTarget.blur()}
                className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
          </div>

          <Field label="Payment Date" name="date" type="date" required value={date} onChange={setDate} maxDate={today()} />

          <SelectField label="Payment Mode" name="mode" required value={paymentMode} onChange={v => { setPaymentMode(v); if (v === 'Cash') { setBankName(''); setTxnRef('') } }} options={PAYMENT_MODES} />

          {needsBankName(paymentMode) && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank Name" name="bank" required value={bankName} onChange={setBankName} placeholder="e.g. HDFC Bank" />
              <Field label="Ref / UTR / Cheque" name="ref" value={txnRef} onChange={setTxnRef} placeholder="e.g. UTR123" />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Receipts</label>
              {allReceiptKeys.length > 0 && <ViewReceiptsBtn fileKeys={allReceiptKeys} label={`View ${allReceiptKeys.length} saved`} />}
            </div>
            <FilePicker files={files} onChange={setFiles} />
          </div>
        </div>

        <div className="px-5 py-4 border-t shrink-0 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 border border-slate-200 bg-white text-slate-700 rounded-lg py-2.5 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Income Drawer ─────────────────────────────────────────────────────────────

const INCOME_CATEGORY_HINTS: Record<string, string> = {
  'Rental Income':   'e.g. Auditorium rental, ground hiring',
  'Bank Interest':   'e.g. FD interest from school bank account',
  'Scrap/Asset Sale':'e.g. Old furniture, newspapers, deprecated equipment',
  'Donation':        'e.g. Alumni fund, corporate CSR grant',
  'Other':           'Any other non-fee income not listed above',
}

function IncomeDrawer({ open, onClose, onSaved, academicYearId }: {
  open: boolean; onClose: () => void; onSaved: () => void; academicYearId: string
}) {
  const [date, setDate] = useState(today())
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [bankName, setBankName] = useState('')
  const [txnRef, setTxnRef] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) {
      setDate(today()); setCategory(''); setAmount(''); setDescription('')
      setPaymentMode('Cash'); setBankName(''); setTxnRef(''); setFiles([]); setErr('')
    }
  }, [open])

  const handleSubmit = async () => {
    setSaving(true); setErr('')
    const amt = parseFloat(amount)
    if (!category) { setErr('Please select an income category.'); setSaving(false); return }
    if (isNaN(amt) || amt <= 0) { setErr('Amount must be positive.'); setSaving(false); return }
    if (needsBankName(paymentMode) && !bankName.trim()) {
      setErr('Bank name is required for non-cash receipts.'); setSaving(false); return
    }

    let receiptKeys: string[] = []
    if (files.length > 0) {
      try {
        receiptKeys = await Promise.all(files.map(async file => {
          const { signedUrl, fileKey } = await getUploadUrl(file.type || 'application/octet-stream')
          const res = await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
          if (!res.ok) throw new Error('Upload failed')
          return fileKey
        }))
      } catch { setErr('Receipt upload failed. Please try again.'); setSaving(false); return }
    }

    const result = await recordOtherIncome({
      academic_year_id: academicYearId,
      income_category: category,
      amount: amt,
      date_received: date,
      description: description || undefined,
      payment_mode: paymentMode,
      bank_name: needsBankName(paymentMode) ? bankName.trim() : undefined,
      transaction_reference: txnRef.trim() || undefined,
      receipt_object_keys: receiptKeys.length ? receiptKeys : undefined,
    })
    setSaving(false)
    if (result.error) { setErr(result.error); return }
    toast.success('Income entry recorded.'); onSaved(); onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-250">
        <div className="px-5 py-4 border-b shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Record Other Income</h2>
            <p className="text-xs text-slate-400 mt-0.5">Non-fee inflows — rental, interest, donations, scrap</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 transition"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <ErrBanner msg={err} />

          <Field label="Date Received" name="date" type="date" required value={date} onChange={setDate} maxDate={today()} />

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Income Category <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2.5 pr-9 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white transition cursor-pointer">
                <option value="">Select category…</option>
                {INCOME_CATEGORIES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            {category && INCOME_CATEGORY_HINTS[category] && (
              <p className="text-[10px] text-slate-400 mt-1">{INCOME_CATEGORY_HINTS[category]}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Amount Received (₹) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" min="0.01" step="0.01" onWheel={e => e.currentTarget.blur()}
                className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
          </div>

          {/* Payment / Receipt Details */}
          <SelectField label="Received Via" name="mode" required value={paymentMode}
            onChange={v => { setPaymentMode(v); if (v === 'Cash') { setBankName(''); setTxnRef('') } }}
            options={PAYMENT_MODES} />

          {needsBankName(paymentMode) && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank Name" name="bank" required value={bankName} onChange={setBankName} placeholder="e.g. SBI, HDFC Bank" />
              <Field label="Ref / UTR / Cheque No" name="ref" value={txnRef} onChange={setTxnRef} placeholder="e.g. UTR123456" />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Description / Notes</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="e.g. Ground rental from local cricket club for Jan–Mar"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white resize-none transition" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Receipts / Documents</label>
            <FilePicker files={files} onChange={setFiles} />
          </div>
        </div>

        <div className="px-5 py-4 border-t shrink-0 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 border border-slate-200 bg-white text-slate-700 rounded-lg py-2.5 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Record Income'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Bill Card (collapsed + expanded) ─────────────────────────────────────────

function BillCard({ bill, onPay, onAddItem }: {
  bill: ExpenseBillSummaryRow
  onPay: (b: ExpenseBillSummaryRow) => void
  onAddItem: (b: ExpenseBillSummaryRow) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const st = STATUS_STYLES[bill.status] ?? STATUS_STYLES.Unpaid
  const ccDot = CC_DOT[bill.cost_center] ?? 'bg-slate-400'
  const allReceiptKeys = bill.payments.flatMap(p => p.receipt_object_keys ?? [])
  const paidPct = bill.total_bill_amount > 0 ? Math.min(100, (bill.total_amount_paid / bill.total_bill_amount) * 100) : 0

  return (
    <div className={`bg-white border rounded-xl transition-shadow ${expanded ? 'border-slate-300 shadow-md' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}>
      {/* ── Collapsed Row ── */}
      <button
        className="w-full text-left px-4 py-3.5 flex items-center gap-3"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Status dot */}
        <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />

        {/* Voucher */}
        <span className="font-mono text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-semibold shrink-0 w-24 text-center truncate">
          {bill.voucher_number ?? '—'}
        </span>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-slate-800 truncate">{bill.payee_name}</span>
            <span className="text-xs text-slate-400 shrink-0">{bill.category}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-slate-400">{fmtDate(bill.date_incurred)}</span>
            <span className={`flex items-center gap-1 text-[10px] font-medium ${ccDot.replace('bg-', 'text-').replace('-500', '-600')}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${ccDot}`} />
              {bill.cost_center}
            </span>
          </div>
        </div>

        {/* Financial summary */}
        <div className="text-right shrink-0 hidden sm:block">
          <div className="text-sm font-bold text-slate-800">{fmtINR(bill.total_bill_amount)}</div>
          {bill.balance_due > 0 && (
            <div className="text-[11px] text-rose-500 font-semibold">{fmtINR(bill.balance_due)} due</div>
          )}
        </div>

        {/* Status badge */}
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${st.badge}`}>
          {bill.status}
        </span>

        <ChevronRight size={15} className={`text-slate-300 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {/* ── Expanded Detail ── */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-4">
          {/* Progress bar */}
          {bill.total_bill_amount > 0 && (
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>Payment progress</span>
                <span>{paidPct.toFixed(0)}% paid</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${paidPct >= 100 ? 'bg-emerald-500' : paidPct > 0 ? 'bg-amber-400' : 'bg-rose-300'}`}
                  style={{ width: `${paidPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Paid {fmtINR(bill.total_amount_paid)}</span>
                <span>Total {fmtINR(bill.total_bill_amount)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Line Items</span>
                <button onClick={() => onAddItem(bill)}
                  className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 px-2 py-1 rounded-lg transition">
                  <Plus size={10} /> Add Item
                </button>
              </div>
              <div className="space-y-1">
                {bill.items.map(it => (
                  <div key={it.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-xs text-slate-600 truncate pr-4">{it.description}</span>
                    <span className={`text-xs font-semibold shrink-0 ${it.amount < 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {it.amount < 0 ? '−' : ''}{fmtINR(it.amount)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1.5">
                  <span className="text-xs font-bold text-slate-600">Total</span>
                  <span className="text-xs font-bold text-slate-900">{fmtINR(bill.total_bill_amount)}</span>
                </div>
              </div>
            </div>

            {/* Payments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payments</span>
                {bill.status !== 'Paid' && bill.status !== 'Cancelled' && (
                  <button onClick={() => onPay(bill)}
                    className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg transition">
                    <IndianRupee size={10} /> Record Payment
                  </button>
                )}
              </div>
              {bill.payments.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No payments recorded yet.</p>
              ) : (
                <div className="space-y-1">
                  {bill.payments.map(p => {
                    const pReceipts = p.receipt_object_keys ?? []
                    return (
                      <div key={p.id} className="flex items-start justify-between py-1.5 border-b border-slate-50 last:border-0">
                        <div>
                          <div className="text-xs text-slate-700 font-medium">{fmtINR(p.amount_paid)}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {fmtDate(p.payment_date)}{p.payment_mode ? ` · ${p.payment_mode}` : ''}{p.bank_name ? ` · ${p.bank_name}` : ''}{p.transaction_reference ? ` · ${p.transaction_reference}` : ''}
                          </div>
                        </div>
                        {pReceipts.length > 0 && <ViewReceiptsBtn fileKeys={pReceipts} />}
                      </div>
                    )
                  })}
                  <div className="flex items-center justify-between pt-1.5">
                    <span className="text-xs font-bold text-slate-600">Total Paid</span>
                    <span className="text-xs font-bold text-emerald-700">{fmtINR(bill.total_amount_paid)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer meta */}
          <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              {bill.staff_name && <span>Logged by {bill.staff_name}</span>}
              {bill.due_date && <span>Due {fmtDate(bill.due_date)}</span>}
              {allReceiptKeys.length > 0 && <ViewReceiptsBtn fileKeys={allReceiptKeys} label={`${allReceiptKeys.length} document${allReceiptKeys.length > 1 ? 's' : ''}`} />}
            </div>
            {bill.balance_due > 0 && (
              <span className="text-xs font-bold text-rose-600">Balance: {fmtINR(bill.balance_due)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Bills Tab ────────────────────────────────────────────────────────────────

function BillsTab({ bills, onAdd, onPay, onAddItem }: {
  bills: ExpenseBillSummaryRow[]
  onAdd: () => void
  onPay: (b: ExpenseBillSummaryRow) => void
  onAddItem: (b: ExpenseBillSummaryRow) => void
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [ccFilter, setCcFilter] = useState('All')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => bills.filter(b => {
    if (statusFilter !== 'All' && b.status !== statusFilter) return false
    if (ccFilter !== 'All' && b.cost_center !== ccFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!b.payee_name.toLowerCase().includes(q) && !b.category.toLowerCase().includes(q) && !(b.voucher_number ?? '').toLowerCase().includes(q)) return false
    }
    return true
  }), [bills, statusFilter, ccFilter, search])

  const totalBilled = filtered.reduce((s, b) => s + b.total_bill_amount, 0)
  const totalDue = filtered.reduce((s, b) => s + b.balance_due, 0)
  const unpaidCount = filtered.filter(b => b.status !== 'Paid' && b.status !== 'Cancelled').length

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 relative min-w-48">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search payee, category, voucher…"
            className="w-full border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <X size={13} />
            </button>
          )}
        </div>

        <button onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm font-medium transition ${showFilters || statusFilter !== 'All' || ccFilter !== 'All' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
          <Filter size={14} /> Filters
          {(statusFilter !== 'All' || ccFilter !== 'All') && (
            <span className="bg-blue-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {(statusFilter !== 'All' ? 1 : 0) + (ccFilter !== 'All' ? 1 : 0)}
            </span>
          )}
        </button>

        <button onClick={onAdd} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
          <Plus size={14} /> New Bill
        </button>
      </div>

      {/* Filter Row */}
      {showFilters && (
        <div className="flex items-center gap-2 flex-wrap p-3 bg-slate-50 border border-slate-200 rounded-xl">
          {[
            { label: 'Status', value: statusFilter, set: setStatusFilter, opts: ['Unpaid', 'Partial', 'Paid', 'Cancelled'] },
            { label: 'Cost Center', value: ccFilter, set: setCcFilter, opts: COST_CENTERS },
          ].map(({ label, value, set, opts }) => (
            <div key={label} className="relative">
              <select value={value} onChange={e => set(e.target.value)}
                className="appearance-none bg-white border border-slate-200 rounded-lg px-3 py-1.5 pr-7 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer">
                <option value="All">All {label}s</option>
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          ))}
          {(statusFilter !== 'All' || ccFilter !== 'All') && (
            <button onClick={() => { setStatusFilter('All'); setCcFilter('All') }} className="text-xs text-slate-400 hover:text-slate-600 underline ml-1">Clear</button>
          )}
        </div>
      )}

      {/* Summary chips */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
          <span>{filtered.length} bill{filtered.length !== 1 ? 's' : ''}</span>
          <span className="text-slate-300">·</span>
          <span>Total {fmtINR(totalBilled)}</span>
          {totalDue > 0 && <><span className="text-slate-300">·</span><span className="text-rose-600 font-semibold">{fmtINR(totalDue)} outstanding</span></>}
          {unpaidCount > 0 && <><span className="text-slate-300">·</span><span className="text-amber-600">{unpaidCount} pending</span></>}
        </div>
      )}

      {/* Bill Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <FileText size={20} className="text-slate-300" />
          </div>
          <p className="text-sm text-slate-400">{search || statusFilter !== 'All' || ccFilter !== 'All' ? 'No bills match the current filters.' : 'No expense bills recorded yet.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(bill => (
            <BillCard key={bill.bill_id} bill={bill} onPay={onPay} onAddItem={onAddItem} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Capital Tab ──────────────────────────────────────────────────────────────

function OtherIncomeTab({ income, onAdd }: { income: OtherIncomeRow[]; onAdd: () => void }) {
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')

  const filtered = useMemo(() => income.filter(r => {
    if (catFilter !== 'All' && r.income_category !== catFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!r.income_category.toLowerCase().includes(q) && !(r.description ?? '').toLowerCase().includes(q) && !(r.bank_name ?? '').toLowerCase().includes(q)) return false
    }
    return true
  }), [income, catFilter, search])

  const total = filtered.reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 relative min-w-48">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search category, description, bank…"
            className="w-full border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="relative">
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-7 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer">
            <option value="All">All Categories</option>
            {INCOME_CATEGORIES.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        <button onClick={onAdd} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
          <Plus size={14} /> Record Income
        </button>
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-slate-400">
          {filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'} · Total <span className="font-semibold text-emerald-700">{fmtINR(total)}</span>
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <IndianRupee size={20} className="text-slate-300" />
          </div>
          <p className="text-sm text-slate-400">{search || catFilter !== 'All' ? 'No entries match the current filters.' : 'No other income recorded yet.'}</p>
          {!search && catFilter === 'All' && (
            <p className="text-xs text-slate-400 mt-1">Record rental income, bank interest, donations, scrap sales and more.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(row => {
            const catColor = INCOME_CAT_COLORS[row.income_category] ?? 'bg-slate-100 text-slate-600 border-slate-200'
            const receipts = row.receipt_object_keys ?? []
            return (
              <div key={row.id} className="bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-slate-300 transition">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Top row: category badge + date */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${catColor}`}>
                        {row.income_category}
                      </span>
                      <span className="text-xs text-slate-400">{fmtDate(row.date_received)}</span>
                      {row.payment_mode && (
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-full">
                          {row.payment_mode}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    {row.description && (
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{row.description}</p>
                    )}

                    {/* Payment meta row */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {row.bank_name && (
                        <span className="text-[10px] text-slate-500 font-medium">{row.bank_name}</span>
                      )}
                      {row.bank_name && row.transaction_reference && (
                        <span className="text-[10px] text-slate-300">·</span>
                      )}
                      {row.transaction_reference && (
                        <span className="text-[10px] text-slate-400 font-mono">{row.transaction_reference}</span>
                      )}
                      {(row.bank_name || row.transaction_reference) && row.staff_name && (
                        <span className="text-[10px] text-slate-300">·</span>
                      )}
                      {row.staff_name && (
                        <span className="text-[10px] text-slate-400">Logged by {row.staff_name}</span>
                      )}
                    </div>
                  </div>

                  {/* Right: amount + receipt */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-sm font-bold text-emerald-700">{fmtINR(Number(row.amount))}</span>
                    {receipts.length > 0 && <ViewReceiptsBtn fileKeys={receipts} />}
                  </div>
                </div>
              </div>
            )
          })}

          <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl mt-1">
            <span className="text-xs font-semibold text-emerald-700">
              Total Other Income — {filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}
            </span>
            <span className="text-sm font-bold text-emerald-700">{fmtINR(total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Create Loan Drawer ───────────────────────────────────────────────────────

function CreateLoanDrawer({ open, onClose, onSaved, academicYearId }: {
  open: boolean; onClose: () => void; onSaved: () => void; academicYearId: string
}) {
  const [loanType, setLoanType] = useState<'LOAN_GIVEN' | 'LOAN_RECEIVED'>('LOAN_RECEIVED')
  const [partyName, setPartyName] = useState('')
  const [principal, setPrincipal] = useState('')
  const [interestRate, setInterestRate] = useState('0')
  const [dateExecuted, setDateExecuted] = useState(today())
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) {
      setLoanType('LOAN_RECEIVED'); setPartyName(''); setPrincipal('')
      setInterestRate('0'); setDateExecuted(today()); setDueDate(''); setErr('')
    }
  }, [open])

  const handleSubmit = async () => {
    setSaving(true); setErr('')
    const p = parseFloat(principal)
    const r = parseFloat(interestRate)
    if (!partyName.trim()) { setErr('Party name is required.'); setSaving(false); return }
    if (isNaN(p) || p <= 0) { setErr('Principal must be a positive amount.'); setSaving(false); return }
    if (p > 100_000_000) { setErr('Principal cannot exceed ₹10 Crore.'); setSaving(false); return }
    if (isNaN(r) || r < 0 || r > 100) { setErr('Interest rate must be between 0 and 100.'); setSaving(false); return }

    const result = await createLoan({
      academic_year_id: academicYearId,
      loan_type: loanType,
      party_name: partyName,
      initial_principal: p,
      interest_rate_percentage: r,
      date_executed: dateExecuted,
      due_date: dueDate || undefined,
    })
    setSaving(false)
    if (result.error) { setErr(result.error); return }
    toast.success('Loan created. Initial disbursement logged.')
    onSaved(); onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-250">
        <div className="px-5 py-4 border-b shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">New Loan Record</h2>
            <p className="text-xs text-slate-400 mt-0.5">Initial disbursement is auto-logged on save</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 transition"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <ErrBanner msg={err} />

          {/* Loan Type Toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Loan Type <span className="text-rose-400">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {(['LOAN_RECEIVED', 'LOAN_GIVEN'] as const).map(type => (
                <button key={type} type="button" onClick={() => setLoanType(type)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                    loanType === type
                      ? type === 'LOAN_RECEIVED'
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-violet-600 border-violet-600 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>
                  {type === 'LOAN_RECEIVED'
                    ? <ArrowDownLeft size={16} />
                    : <ArrowUpRight size={16} />}
                  {type === 'LOAN_RECEIVED' ? 'Money Received' : 'Money Given'}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">
              {loanType === 'LOAN_RECEIVED' ? 'School borrowed money (e.g. from a bank or chairman).' : 'School lent money to someone (e.g. to a vendor or staff).'}
            </p>
          </div>

          <Field label="Party Name" name="party" required value={partyName} onChange={setPartyName}
            placeholder={loanType === 'LOAN_RECEIVED' ? 'e.g. HDFC Bank / Chairman' : 'e.g. Vendor / Staff Name'} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Principal Amount (₹) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                <input type="number" value={principal} onChange={e => setPrincipal(e.target.value)}
                  placeholder="0.00" min="0.01" step="0.01" onWheel={e => e.currentTarget.blur()}
                  className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Interest Rate (% p.a.)
              </label>
              <div className="relative">
                <input type="number" value={interestRate} onChange={e => setInterestRate(e.target.value)}
                  placeholder="0" min="0" max="100" step="0.01" onWheel={e => e.currentTarget.blur()}
                  className="w-full border border-slate-200 rounded-lg pl-3 pr-8 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Execution Date" name="dateExec" type="date" required value={dateExecuted} onChange={setDateExecuted} maxDate={today()} />
            <Field label="Due Date" name="dueDate" type="date" value={dueDate} onChange={setDueDate} />
          </div>

          {principal && !isNaN(parseFloat(principal)) && parseFloat(principal) > 0 && interestRate && !isNaN(parseFloat(interestRate)) && parseFloat(interestRate) > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">Interest Estimate</p>
              <p className="text-xs text-blue-600">
                At {parseFloat(interestRate)}% p.a. on {fmtINR(parseFloat(principal))}: ~{fmtINR((parseFloat(principal) * parseFloat(interestRate)) / 100)}/year · ~{fmtINR((parseFloat(principal) * parseFloat(interestRate)) / 1200)}/month
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t shrink-0 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 border border-slate-200 bg-white text-slate-700 rounded-lg py-2.5 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className={`flex-1 text-white rounded-lg py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60 ${
              loanType === 'LOAN_RECEIVED' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-violet-600 hover:bg-violet-700'
            }`}>
            {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Create Loan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Record Loan Transaction Drawer ──────────────────────────────────────────

function RecordLoanTransactionDrawer({ open, onClose, onSaved, loan }: {
  open: boolean; onClose: () => void; onSaved: () => void; loan: InternalLoanRow | null
}) {
  const [txnType, setTxnType] = useState<'PRINCIPAL_REPAYMENT' | 'INTEREST_PAYMENT'>('PRINCIPAL_REPAYMENT')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [txnRef, setTxnRef] = useState('')
  const [bankName, setBankName] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) {
      setTxnType('PRINCIPAL_REPAYMENT'); setAmount(''); setDate(today())
      setPaymentMode('Cash'); setTxnRef(''); setBankName(''); setFiles([]); setErr('')
    }
  }, [open])

  const handleSubmit = async () => {
    if (!loan) return
    setSaving(true); setErr('')
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { setErr('Amount must be positive.'); setSaving(false); return }
    if (txnType === 'PRINCIPAL_REPAYMENT' && amt > loan.remaining_principal_balance + 0.001) {
      setErr(`Repayment cannot exceed remaining principal balance of ${fmtINR(loan.remaining_principal_balance)}.`)
      setSaving(false); return
    }
    if (needsBankName(paymentMode) && !bankName.trim()) {
      setErr('Bank name is required for non-cash payments.'); setSaving(false); return
    }

    let receiptKeys: string[] = []
    if (files.length > 0) {
      try {
        receiptKeys = await Promise.all(files.map(async file => {
          const { signedUrl, fileKey } = await getUploadUrl(file.type || 'application/octet-stream')
          const res = await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
          if (!res.ok) throw new Error('Upload failed')
          return fileKey
        }))
      } catch { setErr('Receipt upload failed. Please try again.'); setSaving(false); return }
    }

    const result = await addLoanTransaction({
      loan_id: loan.loan_id,
      transaction_date: date,
      type: txnType,
      amount: amt,
      payment_mode: paymentMode,
      transaction_reference: txnRef || undefined,
      bank_name: needsBankName(paymentMode) ? bankName.trim() : undefined,
      receipt_object_keys: receiptKeys.length ? receiptKeys : undefined,
    })
    setSaving(false)
    if (result.error) { setErr(result.error); return }
    toast.success(txnType === 'PRINCIPAL_REPAYMENT' ? 'Principal repayment recorded.' : 'Interest payment recorded.')
    onSaved(); onClose()
  }

  if (!open || !loan) return null

  const afterPayment = txnType === 'PRINCIPAL_REPAYMENT' && amount && !isNaN(parseFloat(amount))
    ? loan.remaining_principal_balance - parseFloat(amount)
    : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-250">
        <div className="px-5 py-4 border-b shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Record Transaction</h2>
            <p className="text-xs text-slate-400 mt-0.5">{loan.party_name} · {loan.loan_type === 'LOAN_RECEIVED' ? 'Received' : 'Given'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 transition"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Loan summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Initial Principal</span>
              <span className="font-semibold text-slate-800">{fmtINR(loan.initial_principal)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Repaid So Far</span>
              <span className="font-semibold text-emerald-600">{fmtINR(loan.total_principal_repaid)}</span>
            </div>
            <div className="flex justify-between text-xs pt-1.5 border-t border-slate-200">
              <span className="font-semibold text-slate-700">Remaining Principal</span>
              <span className="font-bold text-blue-700">{fmtINR(loan.remaining_principal_balance)}</span>
            </div>
            {loan.total_interest_paid > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Interest Paid So Far</span>
                <span className="font-semibold text-amber-600">{fmtINR(loan.total_interest_paid)}</span>
              </div>
            )}
          </div>

          {/* Transaction type toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Transaction Type <span className="text-rose-400">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {(['PRINCIPAL_REPAYMENT', 'INTEREST_PAYMENT'] as const).map(type => (
                <button key={type} type="button" onClick={() => setTxnType(type)}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-semibold transition ${
                    txnType === type
                      ? type === 'PRINCIPAL_REPAYMENT'
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>
                  {TXN_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <ErrBanner msg={err} />

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Amount (₹) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" min="0.01" step="0.01" onWheel={e => e.currentTarget.blur()}
                className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
            {afterPayment !== null && (
              <div className={`mt-2 px-3 py-2 rounded-lg text-xs font-semibold flex justify-between ${afterPayment <= 0.01 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-600 border border-slate-100'}`}>
                <span>{afterPayment <= 0.01 ? 'Loan will be fully settled' : 'Remaining principal after this payment'}</span>
                <span>{afterPayment <= 0.01 ? '₹0' : fmtINR(afterPayment)}</span>
              </div>
            )}
          </div>

          <Field label="Transaction Date" name="date" type="date" required value={date} onChange={setDate} maxDate={today()} />

          <SelectField label="Payment Mode" name="mode" required value={paymentMode} onChange={v => { setPaymentMode(v); if (v === 'Cash' || v === 'Internal Adjustment') { setBankName(''); setTxnRef('') } }} options={LOAN_PAYMENT_MODES} />

          {needsBankName(paymentMode) && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank Name" name="bank" required value={bankName} onChange={setBankName} placeholder="e.g. HDFC Bank" />
              <Field label="Ref / UTR / Cheque" name="ref" value={txnRef} onChange={setTxnRef} placeholder="e.g. UTR123" />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Receipts / Vouchers</label>
            <FilePicker files={files} onChange={setFiles} />
          </div>
        </div>

        <div className="px-5 py-4 border-t shrink-0 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 border border-slate-200 bg-white text-slate-700 rounded-lg py-2.5 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className={`flex-1 text-white rounded-lg py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60 ${
              txnType === 'PRINCIPAL_REPAYMENT' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600'
            }`}>
            {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : 'Record Transaction'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Loan Card ────────────────────────────────────────────────────────────────

function LoanCard({ loan, onAddTransaction }: {
  loan: InternalLoanRow
  onAddTransaction: (l: InternalLoanRow) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const st = LOAN_STATUS_STYLES[loan.status] ?? LOAN_STATUS_STYLES.Active
  const isReceived = loan.loan_type === 'LOAN_RECEIVED'
  const repaidPct = loan.initial_principal > 0
    ? Math.min(100, (loan.total_principal_repaid / loan.initial_principal) * 100) : 0

  return (
    <div className={`bg-white border rounded-xl transition-shadow ${expanded ? 'border-slate-300 shadow-md' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}>
      {/* Collapsed Row */}
      <button className="w-full text-left px-4 py-3.5 flex items-center gap-3" onClick={() => setExpanded(v => !v)}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />

        {/* Type badge */}
        <span className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
          isReceived ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-violet-50 text-violet-700 border-violet-200'
        }`}>
          {isReceived ? <ArrowDownLeft size={9} /> : <ArrowUpRight size={9} />}
          {isReceived ? 'Received' : 'Given'}
        </span>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-slate-800 truncate">{loan.party_name}</span>
            {loan.interest_rate_percentage > 0 && (
              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 shrink-0">
                {loan.interest_rate_percentage}% p.a.
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-slate-400">{fmtDate(loan.date_executed)}</span>
            {loan.due_date && <span className="text-xs text-slate-400">Due {fmtDate(loan.due_date)}</span>}
          </div>
        </div>

        {/* Financial summary */}
        <div className="text-right shrink-0 hidden sm:block">
          <div className="text-sm font-bold text-slate-800">{fmtINR(loan.initial_principal)}</div>
          {loan.remaining_principal_balance > 0.001 && (
            <div className="text-[11px] text-blue-600 font-semibold">{fmtINR(loan.remaining_principal_balance)} remaining</div>
          )}
        </div>

        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${st.badge}`}>{loan.status}</span>
        <ChevronRight size={15} className={`text-slate-300 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-4">
          {/* Repayment Progress */}
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1.5">
              <span>Principal repayment progress</span>
              <span>{repaidPct.toFixed(0)}% repaid</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${repaidPct >= 100 ? 'bg-emerald-500' : repaidPct > 0 ? 'bg-blue-400' : 'bg-slate-300'}`}
                style={{ width: `${repaidPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Repaid {fmtINR(loan.total_principal_repaid)}</span>
              <span>Total {fmtINR(loan.initial_principal)}</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Remaining Principal', value: fmtINR(loan.remaining_principal_balance), color: 'text-blue-700' },
              { label: 'Interest Paid', value: fmtINR(loan.total_interest_paid), color: 'text-amber-600' },
              { label: 'Rate p.a.', value: `${loan.interest_rate_percentage}%`, color: 'text-slate-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-50 rounded-lg p-2.5 text-center border border-slate-100">
                <p className="text-[10px] text-slate-400 mb-0.5">{label}</p>
                <p className={`text-xs font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Transaction History */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Transaction Ledger</span>
              {loan.status === 'Active' && (
                <button onClick={() => onAddTransaction(loan)}
                  className="flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg transition">
                  <Plus size={10} /> Record Transaction
                </button>
              )}
            </div>

            {loan.transactions.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No transactions yet.</p>
            ) : (
              <div className="space-y-1.5">
                {loan.transactions.map(txn => {
                  const typeColor = TXN_TYPE_COLORS[txn.type] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                  const receipts = txn.receipt_object_keys ?? []
                  return (
                    <div key={txn.id} className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeColor}`}>
                            {TXN_TYPE_LABELS[txn.type]}
                          </span>
                          <span className="text-xs font-bold text-slate-800">{fmtINR(txn.amount)}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{fmtDate(txn.transaction_date)}</span>
                          {txn.payment_mode && <span>· {txn.payment_mode}</span>}
                          {txn.bank_name && <span>· {txn.bank_name}</span>}
                          {txn.transaction_reference && <span>· {txn.transaction_reference}</span>}
                        </div>
                      </div>
                      {receipts.length > 0 && <ViewReceiptsBtn fileKeys={receipts} />}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer meta */}
          <div className="text-[10px] text-slate-400 pt-1">
            {loan.staff_name && <span>Created by {loan.staff_name} · </span>}
            <span>{fmtDate(loan.created_at)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Loans Tab ────────────────────────────────────────────────────────────────

function LoansTab({ loans, onAdd, onAddTransaction }: {
  loans: InternalLoanRow[]
  onAdd: () => void
  onAddTransaction: (l: InternalLoanRow) => void
}) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  const filtered = useMemo(() => loans.filter(l => {
    if (typeFilter !== 'All' && l.loan_type !== typeFilter) return false
    if (statusFilter !== 'All' && l.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!l.party_name.toLowerCase().includes(q)) return false
    }
    return true
  }), [loans, typeFilter, statusFilter, search])

  const totalGiven = filtered.filter(l => l.loan_type === 'LOAN_GIVEN').reduce((s, l) => s + l.initial_principal, 0)
  const totalReceived = filtered.filter(l => l.loan_type === 'LOAN_RECEIVED').reduce((s, l) => s + l.initial_principal, 0)
  const totalOutstanding = filtered.reduce((s, l) => s + l.remaining_principal_balance, 0)
  const activeCount = filtered.filter(l => l.status === 'Active').length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 relative min-w-48">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search party name…"
            className="w-full border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Type filter */}
        <div className="relative">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-7 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer">
            <option value="All">All Types</option>
            <option value="LOAN_RECEIVED">Received</option>
            <option value="LOAN_GIVEN">Given</option>
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Status filter */}
        <div className="relative">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-7 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer">
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Settled">Settled</option>
            <option value="Defaulted">Defaulted</option>
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        <button onClick={onAdd} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
          <Plus size={14} /> New Loan
        </button>
      </div>

      {/* Summary row */}
      {loans.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Borrowed', value: fmtINR(totalReceived), color: 'text-blue-700', sub: 'LOAN_RECEIVED' },
            { label: 'Lent Out', value: fmtINR(totalGiven), color: 'text-violet-700', sub: 'LOAN_GIVEN' },
            { label: 'Outstanding', value: fmtINR(totalOutstanding), color: 'text-slate-800', sub: 'all active' },
            { label: 'Active Loans', value: String(activeCount), color: 'text-slate-800', sub: 'loans' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-slate-400">{label}</p>
              <p className={`text-sm font-bold ${color} mt-0.5`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <Landmark size={20} className="text-slate-300" />
          </div>
          <p className="text-sm text-slate-400">{search || typeFilter !== 'All' || statusFilter !== 'All' ? 'No loans match the current filters.' : 'No loan records yet.'}</p>
          {!search && typeFilter === 'All' && statusFilter === 'All' && (
            <p className="text-xs text-slate-400 mt-1">Track borrowed capital and loans given to vendors or staff.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(loan => (
            <LoanCard key={loan.loan_id} loan={loan} onAddTransaction={onAddTransaction} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Export Modal ─────────────────────────────────────────────────────────────

function ExportModal({ open, onClose, bills, otherIncome }: {
  open: boolean; onClose: () => void; bills: ExpenseBillSummaryRow[]; otherIncome: OtherIncomeRow[]
}) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(today())
  const filtered = useMemo(() => ({
    bills: bills.filter(b => (!from || b.date_incurred >= from) && (!to || b.date_incurred <= to)),
    income: otherIncome.filter(i => (!from || i.date_received >= from) && (!to || i.date_received <= to)),
  }), [bills, otherIncome, from, to])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2"><Download size={15} className="text-slate-500" /><h2 className="text-base font-bold text-slate-800">Export</h2></div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 transition"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-slate-500 mb-1">From</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
            <div><label className="block text-xs text-slate-500 mb-1">To</label><input type="date" value={to} onChange={e => setTo(e.target.value)} max={today()} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
          </div>
          <div className="space-y-2">
            <button onClick={() => { downloadCsv('expense_bills.csv', ['Voucher', 'Date', 'Cost Center', 'Payee', 'Category', 'Status', 'Bill Total', 'Paid', 'Balance'], filtered.bills.map(b => [b.voucher_number, b.date_incurred, b.cost_center, b.payee_name, b.category, b.status, b.total_bill_amount, b.total_amount_paid, b.balance_due])); toast.success('CSV downloaded.') }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition">
              <TrendingDown size={15} className="text-rose-500 shrink-0" />
              <div className="text-left flex-1 text-sm font-semibold text-rose-700">Expense Bills CSV<span className="text-xs font-normal text-rose-400 ml-2">{filtered.bills.length} records</span></div>
              <Download size={13} className="text-rose-300" />
            </button>
            <button onClick={() => { downloadCsv('other_income.csv', ['Date', 'Category', 'Amount', 'Mode', 'Bank', 'Ref / UTR', 'Description'], filtered.income.map(i => [i.date_received, i.income_category, i.amount, i.payment_mode, i.bank_name, i.transaction_reference, i.description])); toast.success('CSV downloaded.') }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition">
              <TrendingUp size={15} className="text-emerald-500 shrink-0" />
              <div className="text-left flex-1 text-sm font-semibold text-emerald-700">Other Income CSV<span className="text-xs font-normal text-emerald-400 ml-2">{filtered.income.length} entries</span></div>
              <Download size={13} className="text-emerald-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Root Component ───────────────────────────────────────────────────────────

type Tab = 'bills' | 'capital' | 'loans'

export function ExpenseLedgerClient({
  bills: initialBills, otherIncome: initialIncome, loans: initialLoans,
  totalExpenses, totalCapital, academicYearId, academicYearName,
}: {
  bills: ExpenseBillSummaryRow[]; otherIncome: OtherIncomeRow[]; loans: InternalLoanRow[]
  totalExpenses: number; totalCapital: number
  academicYearId: string; academicYearName: string; userRole: 'Admin' | 'Accountant'
}) {
  const [activeTab, setActiveTab] = useState<Tab>('bills')
  const [bills, setBills] = useState(initialBills)
  const [income, setIncome] = useState(initialIncome)
  const [loans, setLoans] = useState(initialLoans)
  const [summaryExpenses, setSummaryExpenses] = useState(totalExpenses)
  const [summaryCapital, setSummaryCapital] = useState(totalCapital)

  const [billDrawerOpen, setBillDrawerOpen] = useState(false)
  const [payBill, setPayBill] = useState<ExpenseBillSummaryRow | null>(null)
  const [addItemBill, setAddItemBill] = useState<ExpenseBillSummaryRow | null>(null)
  const [incomeDrawerOpen, setIncomeDrawerOpen] = useState(false)
  const [loanDrawerOpen, setLoanDrawerOpen] = useState(false)
  const [txnLoan, setTxnLoan] = useState<InternalLoanRow | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const [bRes, iRes, lRes] = await Promise.all([
        getExpenseBills(academicYearId),
        getOtherIncome(academicYearId),
        getLoans(academicYearId),
      ])
      if (bRes.data) { setBills(bRes.data); setSummaryExpenses(bRes.data.reduce((s, b) => s + b.total_bill_amount, 0)) }
      if (iRes.data) { setIncome(iRes.data); setSummaryCapital(iRes.data.reduce((s, r) => s + Number(r.amount), 0)) }
      if (lRes.data) setLoans(lRes.data)
    } catch { /* revalidation handles hard reload */ }
    finally { setRefreshing(false) }
  }, [academicYearId])

  const net = summaryCapital - summaryExpenses
  const unpaidCount = bills.filter(b => b.status === 'Unpaid').length
  const partialCount = bills.filter(b => b.status === 'Partial').length
  const activeLoansCount = loans.filter(l => l.status === 'Active').length

  return (
    <>
      <BillDrawer open={billDrawerOpen} onClose={() => setBillDrawerOpen(false)} onSaved={refresh} academicYearId={academicYearId} />
      <AddItemDrawer open={!!addItemBill} onClose={() => setAddItemBill(null)} onSaved={refresh} bill={addItemBill} />
      <RecordPaymentDrawer open={!!payBill} onClose={() => setPayBill(null)} onSaved={refresh} bill={payBill} />
      <IncomeDrawer open={incomeDrawerOpen} onClose={() => setIncomeDrawerOpen(false)} onSaved={refresh} academicYearId={academicYearId} />
      <CreateLoanDrawer open={loanDrawerOpen} onClose={() => setLoanDrawerOpen(false)} onSaved={refresh} academicYearId={academicYearId} />
      <RecordLoanTransactionDrawer open={!!txnLoan} onClose={() => setTxnLoan(null)} onSaved={refresh} loan={txnLoan} />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} bills={bills} otherIncome={income} />

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Expenses &amp; Ledger
              {refreshing && <Loader2 size={15} className="animate-spin text-blue-400" />}
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">{academicYearName}</p>
          </div>
          <button onClick={() => setExportOpen(true)} className="flex items-center gap-1.5 border border-slate-200 bg-white text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition">
            <Download size={14} /> Export
          </button>
        </div>

        {/* Stat bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-1">Total Billed</p>
            <p className="text-lg font-bold text-rose-600">{fmtINR(summaryExpenses)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{bills.length} bill{bills.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-1">Other Income</p>
            <p className="text-lg font-bold text-emerald-600">{fmtINR(summaryCapital)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{income.length} entr{income.length !== 1 ? 'ies' : 'y'}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-1">Net Position</p>
            <p className={`text-lg font-bold ${net >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>{fmtINR(Math.abs(net))}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {net >= 0 ? 'Surplus' : 'Deficit'}
              {(unpaidCount > 0 || partialCount > 0) && ` · ${unpaidCount + partialCount} pending`}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-1">Active Loans</p>
            <p className="text-lg font-bold text-slate-800">{activeLoansCount}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {fmtINR(loans.filter(l => l.status === 'Active').reduce((s, l) => s + l.remaining_principal_balance, 0))} outstanding
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 -mb-3">
          {([
            { key: 'bills' as Tab, label: 'Expense Bills', count: bills.length },
            { key: 'capital' as Tab, label: 'Other Income', count: income.length },
            { key: 'loans' as Tab, label: 'Loans', count: loans.length },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === tab.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="pt-3">
          {activeTab === 'bills' && (
            <BillsTab bills={bills} onAdd={() => setBillDrawerOpen(true)} onPay={setPayBill} onAddItem={setAddItemBill} />
          )}
          {activeTab === 'capital' && (
            <OtherIncomeTab income={income} onAdd={() => setIncomeDrawerOpen(true)} />
          )}
          {activeTab === 'loans' && (
            <LoansTab loans={loans} onAdd={() => setLoanDrawerOpen(true)} onAddTransaction={setTxnLoan} />
          )}
        </div>
      </div>
    </>
  )
}
