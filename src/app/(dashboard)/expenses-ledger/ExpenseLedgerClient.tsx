'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  Plus, Download, X, Loader2, Edit2, TrendingDown, TrendingUp,
  Shield, ChevronDown, FileText, ArrowRight, Eye, Paperclip,
  UploadCloud, Receipt, AlertCircle, BookOpen, IndianRupee,
} from 'lucide-react'
import {
  recordExpense, updateExpense, recordOtherIncome,
  type ExpenseRow, type OtherIncomeRow, type AuditLogRow,
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
  'Borrowed Capital / Loan', 'Owner Deposit', 'Donation', 'Scrap/Asset Sale', 'Other',
]

const COST_CENTER_COLORS: Record<string, string> = {
  'Main School': 'bg-blue-50 text-blue-700 border-blue-100',
  'Hostel':      'bg-violet-50 text-violet-700 border-violet-100',
  'Mess':        'bg-orange-50 text-orange-700 border-orange-100',
  'Transport':   'bg-teal-50 text-teal-700 border-teal-100',
}

const INCOME_CAT_COLORS: Record<string, string> = {
  'Borrowed Capital / Loan': 'bg-rose-50 text-rose-700 border-rose-100',
  'Owner Deposit':            'bg-emerald-50 text-emerald-700 border-emerald-100',
  'Donation':                 'bg-purple-50 text-purple-700 border-purple-100',
  'Scrap/Asset Sale':         'bg-amber-50 text-amber-700 border-amber-100',
  'Other':                    'bg-slate-100 text-slate-600 border-slate-200',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function today() { return new Date().toISOString().split('T')[0] }

function csvEscape(v: unknown): string {
  const s = String(v ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const lines = [headers.map(csvEscape).join(','), ...rows.map(r => r.map(csvEscape).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Shared Field Components ──────────────────────────────────────────────────

function Field({ label, name, type = 'text', required, value, onChange, placeholder, maxDate }: {
  label: string; name: string; type?: string; required?: boolean
  value: string; onChange: (v: string) => void; placeholder?: string; maxDate?: string
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

// ─── View Bills Button ─────────────────────────────────────────────────────────

function ViewBillsButton({ fileKeys }: { fileKeys: string[] }) {
  const [loading, setLoading] = useState(false)
  if (!fileKeys || fileKeys.length === 0) return null

  const handleView = async () => {
    setLoading(true)
    try {
      const results = await getViewUrls(fileKeys)
      results.forEach(r => window.open(r.url, '_blank'))
    } catch {
      toast.error('Could not fetch bill URLs.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleView} disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition disabled:opacity-60">
      {loading ? <Loader2 size={11} className="animate-spin" /> : <Eye size={11} />}
      {fileKeys.length} Bill{fileKeys.length > 1 ? 's' : ''}
    </button>
  )
}

// ─── Expense Drawer ───────────────────────────────────────────────────────────

type ExpenseFormState = {
  date: string; costCenter: string; category: string; payee: string
  amount: string; paymentMode: string; txnRef: string; description: string
  newFiles: File[]
}

function emptyExpenseForm(): ExpenseFormState {
  return { date: today(), costCenter: 'Main School', category: '', payee: '', amount: '', paymentMode: 'Cash', txnRef: '', description: '', newFiles: [] }
}

function ExpenseDrawer({ open, onClose, onSaved, academicYearId, editing }: {
  open: boolean; onClose: () => void; onSaved: (isEdit: boolean) => void
  academicYearId: string; editing: ExpenseRow | null
}) {
  const isEdit = !!editing
  const [form, setForm] = useState<ExpenseFormState>(emptyExpenseForm)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [viewingBills, setViewingBills] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = useCallback((k: keyof ExpenseFormState) => (v: string) => setForm(f => ({ ...f, [k]: v })), [])

  useEffect(() => {
    if (open) {
      setErr('')
      setForm(editing ? {
        date: editing.date_incurred,
        costCenter: editing.cost_center ?? 'Main School',
        category: editing.category,
        payee: editing.payee_name ?? '',
        amount: String(editing.amount),
        paymentMode: editing.payment_mode ?? 'Cash',
        txnRef: editing.transaction_reference ?? '',
        description: editing.description ?? '',
        newFiles: [],
      } : emptyExpenseForm())
    }
  }, [open, editing])

  const removeNewFile = (i: number) => setForm(f => ({ ...f, newFiles: f.newFiles.filter((_, idx) => idx !== i) }))

  const handleViewExistingBills = async () => {
    if (!editing?.receipt_object_keys?.length) return
    setViewingBills(true)
    try {
      const results = await getViewUrls(editing.receipt_object_keys)
      results.forEach(r => window.open(r.url, '_blank'))
    } catch { toast.error('Could not fetch bill URLs.') }
    finally { setViewingBills(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setErr('')
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) { setErr('Amount must be a positive number.'); setSaving(false); return }
    if (!form.category) { setErr('Please select a category.'); setSaving(false); return }
    if (!form.paymentMode) { setErr('Please select a payment mode.'); setSaving(false); return }

    let receiptKeys: string[] = editing?.receipt_object_keys ?? []
    if (form.newFiles.length > 0) {
      try {
        const uploads = await Promise.all(form.newFiles.map(async file => {
          const { signedUrl, fileKey } = await getUploadUrl(file.type || 'application/octet-stream')
          const res = await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
          if (!res.ok) throw new Error('Upload failed')
          return fileKey
        }))
        receiptKeys = [...receiptKeys, ...uploads]
      } catch { setErr('Bill upload failed. Please try again.'); setSaving(false); return }
    }

    if (isEdit && editing) {
      const result = await updateExpense(editing.id,
        { date_incurred: form.date, cost_center: form.costCenter, category: form.category, payee_name: form.payee, amount, payment_mode: form.paymentMode, transaction_reference: form.txnRef || undefined, description: form.description || undefined },
        { amount: editing.amount, category: editing.category, description: editing.description }
      )
      setSaving(false)
      if (result.error) { setErr(result.error); return }
      if (result.auditWritten) {
        toast('Updated. Original amount/category saved to Audit Logs.', { icon: '🔒', duration: 4000 })
      } else {
        toast.success('Expense updated.')
      }
    } else {
      const result = await recordExpense({
        academic_year_id: academicYearId, date_incurred: form.date, cost_center: form.costCenter,
        category: form.category, payee_name: form.payee, amount, payment_mode: form.paymentMode,
        transaction_reference: form.txnRef || undefined, description: form.description || undefined,
        receipt_object_keys: receiptKeys.length ? receiptKeys : undefined,
      })
      setSaving(false)
      if (result.error) { setErr(result.error); return }
      toast.success('Expense recorded.')
    }
    onSaved(isEdit); onClose()
  }

  if (!open) return null

  const existingBillCount = editing?.receipt_object_keys?.length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[420px] bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-250">

        {/* Drawer Header */}
        <div className={`px-5 py-4 border-b shrink-0 ${isEdit ? 'bg-amber-50' : 'bg-blue-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isEdit ? 'bg-amber-100' : 'bg-blue-100'}`}>
                {isEdit ? <Edit2 size={16} className="text-amber-600" /> : <Plus size={16} className="text-blue-600" />}
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">{isEdit ? 'Edit Expense' : 'Record Expense'}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isEdit ? `Voucher: ${editing?.voucher_number ?? 'N/A'}` : 'Voucher auto-assigned on save'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/60 transition"><X size={17} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {err && (
            <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> {err}
            </div>
          )}

          <Field label="Date" name="date" type="date" required value={form.date} onChange={set('date')} maxDate={today()} />

          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Cost Center" name="costCenter" required value={form.costCenter} onChange={set('costCenter')} options={COST_CENTERS} />
            <SelectField label="Category" name="category" required value={form.category} onChange={set('category')} options={CATEGORIES} />
          </div>

          <Field label="Payee Name" name="payee" value={form.payee} onChange={set('payee')} placeholder="e.g. Reliance Smart" />

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Amount (₹)<span className="text-rose-400 ml-0.5">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₹</span>
              <input type="number" value={form.amount} onChange={e => set('amount')(e.target.value)}
                placeholder="0.00" required min="0.01" step="0.01"
                onWheel={e => e.currentTarget.blur()}
                className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2.5 text-sm text-slate-800 font-semibold outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Payment Mode" name="paymentMode" required value={form.paymentMode} onChange={set('paymentMode')} options={PAYMENT_MODES} />
            {form.paymentMode !== 'Cash' && (
              <Field label="Ref / UTR / Cheque No." name="txnRef" value={form.txnRef} onChange={set('txnRef')} placeholder="e.g. UTR123" />
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => set('description')(e.target.value)}
              rows={3} placeholder="Optional notes…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white resize-none transition"
            />
          </div>

          {/* Bills Section */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt size={14} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Bills & Receipts</span>
              </div>
              {existingBillCount > 0 && (
                <button onClick={handleViewExistingBills} disabled={viewingBills}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg transition">
                  {viewingBills ? <Loader2 size={11} className="animate-spin" /> : <Eye size={11} />}
                  View {existingBillCount} saved bill{existingBillCount > 1 ? 's' : ''}
                </button>
              )}
            </div>
            <div className="p-4 space-y-3">
              {form.newFiles.length > 0 && (
                <div className="space-y-1.5">
                  {form.newFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={13} className="text-blue-400 shrink-0" />
                        <span className="text-xs text-slate-700 font-medium truncate">{f.name}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                      </div>
                      <button onClick={() => removeNewFile(i)} className="ml-2 text-slate-300 hover:text-rose-500 transition shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 rounded-lg py-3 cursor-pointer transition group">
                <Paperclip size={14} className="text-slate-400 group-hover:text-blue-500" />
                <span className="text-xs font-medium text-slate-500 group-hover:text-blue-600">
                  {form.newFiles.length > 0 ? 'Add more files' : 'Attach bill(s)'}
                </span>
                <input ref={fileRef} type="file" multiple accept="image/*,application/pdf"
                  onChange={e => { if (e.target.files) setForm(f => ({ ...f, newFiles: [...f.newFiles, ...Array.from(e.target.files!)] })) }}
                  className="hidden"
                />
              </label>
              <p className="text-[10px] text-slate-400 text-center">PDF or image · max 5 MB each</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t bg-slate-50 shrink-0 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 border border-slate-200 bg-white text-slate-700 rounded-lg py-2.5 text-sm font-semibold hover:bg-slate-50 transition">
            Cancel
          </button>
          <button onClick={handleSubmit as any} disabled={saving}
            className={`flex-1 text-white rounded-lg py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60 ${isEdit ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {saving ? <><Loader2 size={15} className="animate-spin" />Saving…</> : (isEdit ? 'Update Expense' : 'Record Expense')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Income Drawer ────────────────────────────────────────────────────────────

function IncomeDrawer({ open, onClose, onSaved, academicYearId }: {
  open: boolean; onClose: () => void; onSaved: () => void; academicYearId: string
}) {
  const [date, setDate] = useState(today())
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { if (open) { setDate(today()); setCategory(''); setAmount(''); setDescription(''); setErr('') } }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setErr('')
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { setErr('Amount must be a positive number.'); setSaving(false); return }
    if (!category) { setErr('Please select an income source.'); setSaving(false); return }
    const result = await recordOtherIncome({ academic_year_id: academicYearId, income_category: category, amount: amt, date_received: date, description: description || undefined })
    setSaving(false)
    if (result.error) { setErr(result.error); return }
    toast.success('Capital entry recorded.'); onSaved(); onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[420px] bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-250">
        <div className="px-5 py-4 border-b bg-emerald-50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <TrendingUp size={16} className="text-emerald-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Add Capital / Income</h2>
                <p className="text-xs text-slate-500 mt-0.5">Non-fee capital inflows for this year</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/60 transition"><X size={17} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {err && (
            <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> {err}
            </div>
          )}
          <Field label="Date" name="date" type="date" required value={date} onChange={setDate} maxDate={today()} />
          <SelectField label="Income Source" name="category" required value={category} onChange={setCategory} options={INCOME_CATEGORIES} />
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Amount (₹)<span className="text-rose-400 ml-0.5">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₹</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required min="0.01" step="0.01"
                onWheel={e => e.currentTarget.blur()}
                className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2.5 text-sm text-slate-800 font-semibold outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
              placeholder="e.g. Personal loan from Chairman for new buses…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white resize-none transition"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t bg-slate-50 shrink-0 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 border border-slate-200 bg-white text-slate-700 rounded-lg py-2.5 text-sm font-semibold hover:bg-slate-50 transition">
            Cancel
          </button>
          <button onClick={handleSubmit as any} disabled={saving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <><Loader2 size={15} className="animate-spin" />Saving…</> : 'Add Capital Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Export Modal ─────────────────────────────────────────────────────────────

function ExportModal({ open, onClose, expenses, otherIncome }: {
  open: boolean; onClose: () => void; expenses: ExpenseRow[]; otherIncome: OtherIncomeRow[]
}) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(today())

  const filtered = useMemo(() => ({
    expenses: expenses.filter(e => (!from || e.date_incurred >= from) && (!to || e.date_incurred <= to)),
    income:   otherIncome.filter(i => (!from || i.date_received >= from) && (!to || i.date_received <= to)),
  }), [expenses, otherIncome, from, to])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <Download size={16} className="text-slate-500" />
            <h2 className="text-base font-bold text-slate-800">Export Data</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 transition"><X size={17} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Date Range</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">From</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">To</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} max={today()}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {filtered.expenses.length} expense(s) · {filtered.income.length} capital entrie(s) in range
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <button onClick={() => { downloadCsv('expenses.csv', ['Voucher No.', 'Date', 'Cost Center', 'Payee', 'Category', 'Mode', 'Ref', 'Amount', 'Description', 'Logged By', 'Updated By'], filtered.expenses.map(e => [e.voucher_number, e.date_incurred, e.cost_center, e.payee_name, e.category, e.payment_mode, e.transaction_reference, e.amount, e.description, e.staff_name, e.updated_by_name])); toast.success('Expenses CSV downloaded.') }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition">
              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
                <TrendingDown size={16} className="text-rose-500" />
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-semibold text-rose-700">Expenses CSV</div>
                <div className="text-xs text-rose-400">{filtered.expenses.length} records</div>
              </div>
              <Download size={15} className="text-rose-300" />
            </button>

            <button onClick={() => { downloadCsv('capital_income.csv', ['Date', 'Source', 'Amount', 'Description', 'Logged By'], filtered.income.map(i => [i.date_received, i.income_category, i.amount, i.description, i.staff_name])); toast.success('Capital CSV downloaded.') }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <TrendingUp size={16} className="text-emerald-500" />
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-semibold text-emerald-700">Capital CSV</div>
                <div className="text-xs text-emerald-400">{filtered.income.length} entries</div>
              </div>
              <Download size={15} className="text-emerald-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Expenses Tab ─────────────────────────────────────────────────────────────

function ExpensesTab({ expenses, onAdd, onEdit }: {
  expenses: ExpenseRow[]; onAdd: () => void; onEdit: (row: ExpenseRow) => void
}) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [costCenter, setCostCenter] = useState('All')
  const [category, setCategory] = useState('All')

  const filtered = useMemo(() => expenses.filter(e => {
    if (dateFrom && e.date_incurred < dateFrom) return false
    if (dateTo && e.date_incurred > dateTo) return false
    if (costCenter !== 'All' && e.cost_center !== costCenter) return false
    if (category !== 'All' && e.category !== category) return false
    return true
  }), [expenses, dateFrom, dateTo, costCenter, category])

  const total = filtered.reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
            <span className="text-xs text-slate-400 shrink-0">From</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="text-sm outline-none text-slate-700 bg-transparent" />
            <span className="text-xs text-slate-300">—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="text-sm outline-none text-slate-700 bg-transparent" />
          </div>

          <div className="relative">
            <select value={costCenter} onChange={e => setCostCenter(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-400 shadow-sm cursor-pointer">
              <option value="All">All Cost Centers</option>
              {COST_CENTERS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-400 shadow-sm cursor-pointer">
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <button onClick={onAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm">
          <Plus size={15} /> Record Expense
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Voucher</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost Center</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Payee / Category</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Mode</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Bills</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <BookOpen size={20} className="text-slate-300" />
                      </div>
                      <p className="text-slate-400 text-sm">No expenses match the current filters.</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(row => {
                const isEdited = !!row.updated_at
                const ccColor = COST_CENTER_COLORS[row.cost_center ?? ''] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                return (
                  <tr key={row.id} className={`hover:bg-slate-50/70 transition-colors group ${isEdited ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-semibold">
                        {row.voucher_number ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{fmtDate(row.date_incurred)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ccColor}`}>
                        {row.cost_center ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-800">{row.payee_name || <span className="text-slate-400 font-normal">—</span>}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{row.category}</div>
                      {isEdited && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                            <Edit2 size={9} /> Edited{row.updated_by_name ? ` by ${row.updated_by_name}` : ''}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-600">{row.payment_mode ?? '—'}</div>
                      {row.transaction_reference && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[80px]">{row.transaction_reference}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-bold text-slate-800">{fmtINR(Number(row.amount))}</span>
                      {row.description && (
                        <div className="text-[10px] text-slate-400 mt-0.5 max-w-[100px] truncate text-right">{row.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ViewBillsButton fileKeys={row.receipt_object_keys ?? []} />
                      {(!row.receipt_object_keys || row.receipt_object_keys.length === 0) && (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => onEdit(row)}
                        className="p-2 rounded-lg hover:bg-amber-50 hover:text-amber-600 text-slate-400 transition border border-transparent hover:border-amber-200 group-hover:text-slate-600">
                        <Edit2 size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total — {filtered.length} record{filtered.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 text-base">{fmtINR(total)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Capital Tab ──────────────────────────────────────────────────────────────

function CapitalTab({ income, onAdd }: { income: OtherIncomeRow[]; onAdd: () => void }) {
  const total = income.reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg text-xs font-semibold">
          <Shield size={13} /> Restricted · Admin &amp; Accountant only
        </div>
        <button onClick={onAdd}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm">
          <Plus size={15} /> Add Capital / Income
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Income Source</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Logged By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {income.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <IndianRupee size={20} className="text-slate-300" />
                      </div>
                      <p className="text-slate-400 text-sm">No capital entries recorded yet.</p>
                    </div>
                  </td>
                </tr>
              ) : income.map(row => {
                const catColor = INCOME_CAT_COLORS[row.income_category] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                return (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{fmtDate(row.date_received)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${catColor}`}>
                        {row.income_category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-bold text-emerald-700">{fmtINR(Number(row.amount))}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-xs">
                      <p className="line-clamp-2">{row.description ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{row.staff_name ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            {income.length > 0 && (
              <tfoot>
                <tr className="bg-emerald-50/50 border-t-2 border-slate-200">
                  <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total Capital — {income.length} entr{income.length !== 1 ? 'ies' : 'y'}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700 text-base">{fmtINR(total)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Audit Logs Tab ───────────────────────────────────────────────────────────

function AuditLogsTab({ logs }: { logs: AuditLogRow[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 bg-slate-100 border border-slate-300 text-slate-600 px-4 py-2.5 rounded-lg text-xs font-semibold">
        <Shield size={13} className="text-slate-500 shrink-0" />
        Read-only immutable record. This log cannot be modified or deleted. Every financial edit is captured here.
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-200/60 border-b border-slate-300">
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Date Changed</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Voucher</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Changed By</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <Shield size={20} className="text-slate-300" />
                      </div>
                      <p className="text-slate-400 text-sm">No edits recorded yet.</p>
                      <p className="text-slate-300 text-xs">When an expense is modified, the original values will appear here.</p>
                    </div>
                  </td>
                </tr>
              ) : logs.map(log => {
                const amtChanged = Number(log.old_amount) !== Number(log.new_amount)
                const catChanged = log.old_category !== log.new_category
                const amtUp = Number(log.new_amount) > Number(log.old_amount)
                return (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {new Date(log.changed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-semibold">
                        {log.voucher_number ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-slate-700">{log.changed_by_name ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {amtChanged ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 line-through">{fmtINR(Number(log.old_amount))}</span>
                          <ArrowRight size={11} className="text-slate-300 shrink-0" />
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${amtUp ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {fmtINR(Number(log.new_amount))}
                          </span>
                        </div>
                      ) : <span className="text-slate-300 text-xs">unchanged</span>}
                    </td>
                    <td className="px-4 py-3">
                      {catChanged ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 line-through">{log.old_category}</span>
                          <ArrowRight size={11} className="text-slate-300 shrink-0" />
                          <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{log.new_category}</span>
                        </div>
                      ) : <span className="text-slate-300 text-xs">unchanged</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Root Component ───────────────────────────────────────────────────────────

type Tab = 'expenses' | 'capital' | 'audit'

export function ExpenseLedgerClient({
  expenses: initialExpenses, otherIncome: initialIncome, auditLogs,
  totalExpenses, totalCapital, academicYearId, academicYearName, userRole,
}: {
  expenses: ExpenseRow[]; otherIncome: OtherIncomeRow[]; auditLogs: AuditLogRow[]
  totalExpenses: number; totalCapital: number
  academicYearId: string; academicYearName: string; userRole: 'Admin' | 'Accountant'
}) {
  const [activeTab, setActiveTab] = useState<Tab>('expenses')
  const [expenses, setExpenses] = useState(initialExpenses)
  const [income, setIncome] = useState(initialIncome)
  const [logs, setLogs] = useState(auditLogs)
  const [summaryExpenses, setSummaryExpenses] = useState(totalExpenses)
  const [summaryCapital, setSummaryCapital] = useState(totalCapital)
  const [expenseDrawerOpen, setExpenseDrawerOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null)
  const [incomeDrawerOpen, setIncomeDrawerOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const [e, i, a] = await Promise.all([
        fetch(`/api/expenses?yearId=${academicYearId}&type=expenses`).then(r => r.json()),
        fetch(`/api/expenses?yearId=${academicYearId}&type=income`).then(r => r.json()),
        fetch(`/api/expenses?yearId=${academicYearId}&type=audit`).then(r => r.json()),
      ])
      if (e.data) { setExpenses(e.data); setSummaryExpenses(e.data.reduce((s: number, r: ExpenseRow) => s + Number(r.amount), 0)) }
      if (i.data) { setIncome(i.data); setSummaryCapital(i.data.reduce((s: number, r: OtherIncomeRow) => s + Number(r.amount), 0)) }
      if (a.data) setLogs(a.data)
    } catch { /* silent — server revalidation handles hard reload */ }
    finally { setRefreshing(false) }
  }, [academicYearId])

  const net = summaryCapital - summaryExpenses

  const TABS = [
    { key: 'expenses' as Tab, label: 'General Expenses', icon: TrendingDown, count: expenses.length },
    { key: 'capital'  as Tab, label: 'Capital & Ledger',  icon: TrendingUp,   count: income.length },
    { key: 'audit'    as Tab, label: 'Audit Logs',         icon: Shield,       count: logs.length },
  ]

  return (
    <>
      <ExpenseDrawer
        open={expenseDrawerOpen}
        onClose={() => { setExpenseDrawerOpen(false); setEditingExpense(null) }}
        onSaved={async () => { await refresh() }}
        academicYearId={academicYearId}
        editing={editingExpense}
      />
      <IncomeDrawer
        open={incomeDrawerOpen}
        onClose={() => setIncomeDrawerOpen(false)}
        onSaved={async () => { await refresh() }}
        academicYearId={academicYearId}
      />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} expenses={expenses} otherIncome={income} />

      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Expenses &amp; Ledger</h1>
              {refreshing && <Loader2 size={16} className="animate-spin text-blue-400" />}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{academicYearName} · Cash-book, capital entries, and audit trail</p>
          </div>
          <button onClick={() => setExportOpen(true)}
            className="flex items-center gap-2 border border-slate-200 bg-white text-slate-700 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-50 transition shadow-sm">
            <Download size={15} className="text-slate-500" /> Export <ChevronDown size={13} className="text-slate-400" />
          </button>
        </div>

        {/* Summary Strip — 3 cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-rose-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center">
                <TrendingDown size={18} className="text-rose-500" />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Expenses</span>
            </div>
            <div className="text-2xl font-bold text-rose-600">{fmtINR(summaryExpenses)}</div>
            <div className="text-xs text-slate-400 mt-1">{expenses.length} entries this year</div>
          </div>

          <div className="bg-white rounded-xl border border-emerald-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                <TrendingUp size={18} className="text-emerald-500" />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Capital Injected</span>
            </div>
            <div className="text-2xl font-bold text-emerald-600">{fmtINR(summaryCapital)}</div>
            <div className="text-xs text-slate-400 mt-1">{income.length} entries this year</div>
          </div>

          <div className={`rounded-xl border p-5 shadow-sm ${net >= 0 ? 'bg-white border-blue-100' : 'bg-white border-rose-100'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${net >= 0 ? 'bg-blue-50' : 'bg-rose-50'}`}>
                <IndianRupee size={18} className={net >= 0 ? 'text-blue-500' : 'text-rose-500'} />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Position</span>
            </div>
            <div className={`text-2xl font-bold ${net >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>{fmtINR(Math.abs(net))}</div>
            <div className="text-xs text-slate-400 mt-1">{net >= 0 ? 'Capital surplus' : 'Deficit — expenses exceed capital'}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}>
              <tab.icon size={15} />
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'expenses' && (
          <ExpensesTab expenses={expenses} onAdd={() => { setEditingExpense(null); setExpenseDrawerOpen(true) }} onEdit={row => { setEditingExpense(row); setExpenseDrawerOpen(true) }} />
        )}
        {activeTab === 'capital' && (
          <CapitalTab income={income} onAdd={() => setIncomeDrawerOpen(true)} />
        )}
        {activeTab === 'audit' && (
          <AuditLogsTab logs={logs} />
        )}
      </div>
    </>
  )
}
