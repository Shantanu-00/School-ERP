'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  Loader2, X, Plus, Download, FileText, User, Edit2,
  ChevronDown, Lock, Users, IndianRupee, AlertCircle,
} from 'lucide-react'
import {
  savePayrollDrafts, markPayrollAsPaid, addStaffMember, updateStaffMember,
} from '@/actions/payroll.actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Teacher = {
  id: string
  first_name: string
  last_name: string
  base_salary: number
  status: string
  hire_date: string
  phone_number: string | null
  email: string | null
  designation: string | null
  pan_card_number: string | null
  aadhaar_number: string | null
  bank_account_name: string | null
  bank_account_number: string | null
  bank_ifsc_code: string | null
  bank_name: string | null
  profile_picture_url: string | null
}

type PayrollRecord = {
  id: string
  teacher_id: string
  month_year: string
  base_amount: number
  bonus_amount: number
  deduction_amount: number
  arrears_brought_forward: number
  net_payable: number
  amount_paid: number
  balance_carried_forward: number
  payment_date: string
  remarks: string | null
  status: string | null
  payment_mode: string | null
  transaction_reference: string | null
}

type PayrollStatus = 'Draft' | 'Pending Approval' | 'Paid'

type PayrollRow = {
  localId: string
  dbRowId?: string
  teacher: Teacher
  monthYear: string
  baseAmount: number
  bonusAmount: number
  deductionAmount: number
  arrearsAmount: number   // auto-loaded from prev month, but editable
  netPayable: number      // base + bonus - deductions + arrears
  amountPaid: number      // what the school is actually paying today
  balanceCarriedForward: number // netPayable - amountPaid
  remarks: string
  status: PayrollStatus
  isPaid: boolean
  paymentMode: string
  transactionReference: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcNetPayable(base: number, bonus: number, deduction: number, arrears: number) {
  return Math.max(0, base + bonus - deduction + arrears)
}

function calcBalance(netPayable: number, amountPaid: number) {
  return Math.max(0, netPayable - amountPaid)
}

function fmtINR(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseMonthYear(my: string): { month: number; year: number } | null {
  const parts = my.split('-')
  if (parts.length !== 2) return null
  const month = MONTH_NAMES.indexOf(parts[0])
  const year = parseInt(parts[1], 10)
  if (month === -1 || isNaN(year)) return null
  return { month, year }
}

function currentMonthYear() {
  const d = new Date()
  return `${MONTH_NAMES[d.getMonth()]}-${d.getFullYear()}`
}

function prevMonthLabel(my: string): string {
  const p = parseMonthYear(my)
  if (!p) return 'prev month'
  if (p.month === 0) return `Dec-${p.year - 1}`
  return `${MONTH_NAMES[p.month - 1]}-${p.year}`
}

function isEditablePeriod(monthYear: string): boolean {
  const now = new Date()
  const parsed = parseMonthYear(monthYear)
  if (!parsed) return false
  const target = new Date(parsed.year, parsed.month, 1)
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  const twoMonthsAhead = new Date(now.getFullYear(), now.getMonth() + 2, 1)
  return target >= twoMonthsAgo && target <= twoMonthsAhead
}

function allMonths(): string[] {
  const now = new Date()
  const result: string[] = []
  for (let i = -36; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    result.push(`${MONTH_NAMES[d.getMonth()]}-${d.getFullYear()}`)
  }
  return result.reverse()
}

// ─── Payslip Print ────────────────────────────────────────────────────────────

function buildPayslipHTML(rows: PayrollRow[], monthYear: string, schoolName = 'EduERP School'): string {
  const rowsHtml = rows.map(row => {
    const hasArrears = row.arrearsAmount > 0
    const hasBalance = row.balanceCarriedForward > 0
    return `
    <div class="slip">
      <div class="slip-header">
        <div class="school-name">${schoolName}</div>
        <div class="slip-title">SALARY SLIP — ${monthYear}</div>
      </div>
      <div class="slip-body">
        <div class="info-grid">
          <div class="info-block">
            <div class="label">Staff Name</div>
            <div class="value">${row.teacher.first_name} ${row.teacher.last_name}</div>
          </div>
          <div class="info-block">
            <div class="label">Designation</div>
            <div class="value">${row.teacher.designation || '—'}</div>
          </div>
          <div class="info-block">
            <div class="label">Month / Year</div>
            <div class="value">${monthYear}</div>
          </div>
          <div class="info-block">
            <div class="label">Status</div>
            <div class="value status-${(row.status || 'draft').toLowerCase().replace(' ', '-')}">${row.status}</div>
          </div>
        </div>

        <table class="earnings-table">
          <thead>
            <tr><th>Component</th><th>Amount</th></tr>
          </thead>
          <tbody>
            <tr><td>Base Salary</td><td>${fmtINR(row.baseAmount)}</td></tr>
            <tr class="plus"><td>Bonus / Allowance</td><td>+ ${fmtINR(row.bonusAmount)}</td></tr>
            <tr class="minus"><td>Deductions</td><td>− ${fmtINR(row.deductionAmount)}</td></tr>
            ${hasArrears ? `<tr class="arrears"><td>Arrears from ${prevMonthLabel(monthYear)}</td><td>+ ${fmtINR(row.arrearsAmount)}</td></tr>` : ''}
            <tr class="net"><td><strong>Net Payable</strong></td><td><strong>${fmtINR(row.netPayable)}</strong></td></tr>
            <tr class="paid-row"><td><strong>Amount Paid</strong></td><td><strong>${fmtINR(row.amountPaid)}</strong></td></tr>
            ${hasBalance ? `<tr class="balance"><td>Balance Carried to Next Month</td><td>${fmtINR(row.balanceCarriedForward)}</td></tr>` : ''}
          </tbody>
        </table>

        ${row.isPaid ? `
        <div class="payment-info">
          <span><strong>Mode:</strong> ${row.paymentMode || '—'}</span>
          <span><strong>Ref / UTR:</strong> ${row.transactionReference || '—'}</span>
          ${row.remarks ? `<span><strong>Remarks:</strong> ${row.remarks}</span>` : ''}
        </div>` : ''}

        <div class="bank-block">
          <div class="label">Bank Details</div>
          <div>${row.teacher.bank_name || '—'} &nbsp;|&nbsp;
            A/C: ${row.teacher.bank_account_number || '—'} &nbsp;|&nbsp;
            IFSC: ${row.teacher.bank_ifsc_code || '—'}
          </div>
        </div>
      </div>
      <div class="slip-footer">
        <span>Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        <span>This is a computer-generated document.</span>
      </div>
    </div>`
  }).join('<div class="page-break"></div>')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Payslips — ${monthYear}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; }
  .slip { width: 700px; margin: 32px auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
  .slip-header { background: linear-gradient(90deg, #2563eb, #1d4ed8); padding: 18px 24px; color: #fff; }
  .school-name { font-size: 18px; font-weight: 700; letter-spacing: 0.5px; }
  .slip-title { font-size: 11px; margin-top: 4px; opacity: 0.85; text-transform: uppercase; letter-spacing: 1px; }
  .slip-body { padding: 20px 24px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .info-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; }
  .label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; margin-bottom: 3px; }
  .value { font-size: 13px; font-weight: 600; color: #1e293b; }
  .status-paid { color: #16a34a; }
  .status-draft { color: #64748b; }
  .status-pending-approval { color: #d97706; }
  .earnings-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .earnings-table thead tr { background: #f1f5f9; }
  .earnings-table th { padding: 8px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; border-bottom: 1px solid #e2e8f0; }
  .earnings-table td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
  .earnings-table td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
  .earnings-table th:last-child { text-align: right; }
  .earnings-table tr.plus td { color: #16a34a; }
  .earnings-table tr.minus td { color: #dc2626; }
  .earnings-table tr.arrears td { color: #7c3aed; }
  .earnings-table tr.net { background: #f0fdf4; }
  .earnings-table tr.net td { font-size: 14px; padding: 11px 12px; border-bottom: 1px solid #e2e8f0; }
  .earnings-table tr.paid-row td { font-size: 13px; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #0f172a; }
  .earnings-table tr.balance { background: #fefce8; }
  .earnings-table tr.balance td { color: #92400e; font-size: 11px; border-bottom: none; }
  .payment-info { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px 14px;
    display: flex; gap: 20px; flex-wrap: wrap; font-size: 11px; color: #1e40af; margin-bottom: 14px; }
  .bank-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px;
    font-size: 11px; color: #475569; }
  .bank-block .label { margin-bottom: 4px; }
  .slip-footer { border-top: 1px solid #e2e8f0; padding: 10px 24px; background: #f8fafc;
    display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
  .page-break { page-break-after: always; margin: 0; }
  @media print {
    body { background: #fff; }
    .slip { margin: 0; border-radius: 0; border: none; box-shadow: none; }
    .page-break { page-break-after: always; }
  }
</style>
</head>
<body>${rowsHtml}</body>
</html>`
}

function printPayslips(rows: PayrollRow[], monthYear: string): void {
  const html = buildPayslipHTML(rows, monthYear)
  const win = window.open('', '_blank', 'width=800,height=900')
  if (!win) { toast.error('Pop-up blocked. Please allow pop-ups for this page.'); return }
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.focus(); win.print() }
}

// ─── Numeric Input ─────────────────────────────────────────────────────────────

function NumInput({ value, onChange, disabled, className }: {
  value: number; onChange: (v: number) => void; disabled?: boolean; className?: string
}) {
  return (
    <input
      type="number" min="0" step="0.01"
      value={value === 0 ? '' : value}
      onChange={e => { const v = parseFloat(e.target.value); onChange(isNaN(v) || v < 0 ? 0 : v) }}
      onWheel={e => e.currentTarget.blur()}
      disabled={disabled}
      placeholder="0"
      className={`w-28 border border-slate-200 rounded-md px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-slate-50 disabled:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className || ''}`}
    />
  )
}

// ─── Form Field Helper ────────────────────────────────────────────────────────

function Field({ label, name, type = 'text', required, defaultValue, placeholder }: {
  label: string; name: string; type?: string; required?: boolean
  defaultValue?: string | number | null; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}{required && ' *'}</label>
      <input name={name} type={type} required={required} defaultValue={defaultValue ?? ''} placeholder={placeholder}
        onWheel={type === 'number' ? e => e.currentTarget.blur() : undefined}
        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  )
}

// ─── Staff Form Modal ─────────────────────────────────────────────────────────

function StaffModal({ initial, onClose, onSaved }: {
  initial?: Teacher; onClose: () => void; onSaved: () => void
}) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formRef.current) return
    setSaving(true); setErr('')
    const fd = new FormData(formRef.current)
    const result = isEdit ? await updateStaffMember(initial!.id, fd) : await addStaffMember(fd)
    setSaving(false)
    if (result.error) { setErr(result.error); return }
    toast.success(isEdit ? 'Staff profile updated.' : 'Staff member added.')
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-5 border-b shrink-0">
          <h2 className="text-lg font-bold text-slate-800">{isEdit ? 'Edit Staff Profile' : 'Add Staff Member'}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition"><X size={18} /></button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-5">
          {err && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">{err}</div>}

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Basic Info</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name" name="first_name" required defaultValue={initial?.first_name} />
              <Field label="Last Name" name="last_name" required defaultValue={initial?.last_name} />
              <Field label="Designation" name="designation" defaultValue={initial?.designation} placeholder="e.g. PGT Math" />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select name="status" defaultValue={initial?.status || 'Active'}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="Active">Active</option>
                  <option value="Resigned">Resigned</option>
                  <option value="Terminated">Terminated</option>
                </select>
              </div>
              <Field label="Base Salary (₹)" name="base_salary" type="number" required defaultValue={initial?.base_salary} placeholder="e.g. 35000" />
              <Field label="Hire Date" name="hire_date" type="date" required defaultValue={initial?.hire_date} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone Number" name="phone_number" defaultValue={initial?.phone_number} placeholder="9876543210" />
              <Field label="Email" name="email" type="email" defaultValue={initial?.email} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Government IDs</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="PAN Card Number" name="pan_card_number" defaultValue={initial?.pan_card_number} placeholder="ABCDE1234F" />
              <Field label="Aadhaar Number" name="aadhaar_number" defaultValue={initial?.aadhaar_number} placeholder="12 digits" />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Banking Details</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Account Holder Name" name="bank_account_name" defaultValue={initial?.bank_account_name} />
              <Field label="Account Number" name="bank_account_number" defaultValue={initial?.bank_account_number} />
              <Field label="IFSC Code" name="bank_ifsc_code" defaultValue={initial?.bank_ifsc_code} placeholder="SBIN0001234" />
              <Field label="Bank Name" name="bank_name" defaultValue={initial?.bank_name} placeholder="e.g. SBI" />
            </div>
          </div>

          <div className="flex gap-3 pt-2 pb-1">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-700 rounded-lg py-2 text-sm font-medium hover:bg-slate-50 transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-70">
              {saving ? <><Loader2 size={15} className="animate-spin" /> Saving</> : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Payment Modal ─────────────────────────────────────────────────────────────

function PaymentModal({ row, onClose, onPaid }: {
  row: PayrollRow; onClose: () => void; onPaid: () => void
}) {
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [transactionRef, setTransactionRef] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [amountPaid, setAmountPaid] = useState(row.netPayable)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const balance = calcBalance(row.netPayable, amountPaid)
  const isPartial = balance > 0

  const handleConfirm = async () => {
    if (amountPaid <= 0) { setErr('Amount paid must be greater than zero.'); return }
    if (amountPaid > row.netPayable) { setErr('Amount paid cannot exceed net payable.'); return }
    if (paymentMode !== 'Cash' && !transactionRef.trim()) {
      setErr('Transaction reference is required for non-cash payments.'); return
    }
    setSaving(true); setErr('')
    const result = await markPayrollAsPaid({
      dbRowId: row.dbRowId, teacherId: row.teacher.id, monthYear: row.monthYear,
      baseAmount: row.baseAmount, bonusAmount: row.bonusAmount,
      deductionAmount: row.deductionAmount,
      arrearsAmount: row.arrearsAmount,
      netPayable: row.netPayable,
      amountPaid,
      balanceCarriedForward: balance,
      remarks: row.remarks, paymentDate, paymentMode,
      transactionReference: transactionRef,
    })
    setSaving(false)
    if (result.error) { setErr(result.error); return }
    toast.success(`Payment recorded for ${row.teacher.first_name} ${row.teacher.last_name}.${isPartial ? ` ${fmtINR(balance)} carried to next month.` : ''}`)
    onPaid(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-lg font-bold text-slate-800">Confirm Payment</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Summary block */}
          <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-2">
            <div className="flex justify-between"><span className="text-slate-500">Staff</span><span className="font-semibold">{row.teacher.first_name} {row.teacher.last_name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Month</span><span className="font-semibold">{row.monthYear}</span></div>
            {row.teacher.bank_account_number && (
              <div className="flex justify-between"><span className="text-slate-500">Account</span><span className="font-medium text-xs">{row.teacher.bank_name} — {row.teacher.bank_account_number}</span></div>
            )}
            <div className="border-t pt-2 mt-2 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between"><span>Base Salary</span><span>{fmtINR(row.baseAmount)}</span></div>
              {row.bonusAmount > 0 && <div className="flex justify-between text-emerald-600"><span>Bonus</span><span>+ {fmtINR(row.bonusAmount)}</span></div>}
              {row.deductionAmount > 0 && <div className="flex justify-between text-rose-600"><span>Deductions</span><span>− {fmtINR(row.deductionAmount)}</span></div>}
              {row.arrearsAmount > 0 && <div className="flex justify-between text-violet-600"><span>Arrears from {prevMonthLabel(row.monthYear)}</span><span>+ {fmtINR(row.arrearsAmount)}</span></div>}
              <div className="flex justify-between border-t pt-1.5 font-semibold text-sm text-slate-800">
                <span>Net Payable</span>
                <span className="text-emerald-700">{fmtINR(row.netPayable)}</span>
              </div>
            </div>
          </div>

          {err && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">{err}</div>}

          {/* Amount being paid — editable to allow partial */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Amount Being Paid Today (₹) *
              <span className="ml-1 font-normal text-slate-400">— enter less to carry forward balance</span>
            </label>
            <input
              type="number" min="0.01" max={row.netPayable} step="0.01"
              value={amountPaid === 0 ? '' : amountPaid}
              onChange={e => { const v = parseFloat(e.target.value); setAmountPaid(isNaN(v) || v < 0 ? 0 : v) }}
              onWheel={e => e.currentTarget.blur()}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* Live balance preview */}
          {isPartial && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm">
              <AlertCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="text-amber-700">
                <span className="font-semibold">{fmtINR(balance)}</span> will be carried forward as arrears to{' '}
                <span className="font-semibold">{/* next month label */}{(() => {
                  const p = parseMonthYear(row.monthYear)
                  if (!p) return 'next month'
                  const nm = p.month === 11 ? 0 : p.month + 1
                  const ny = p.month === 11 ? p.year + 1 : p.year
                  return `${MONTH_NAMES[nm]}-${ny}`
                })()}</span>.
              </div>
            </div>
          )}

          {amountPaid > 0 && amountPaid === row.netPayable && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 text-sm text-emerald-700">
              Full salary of {fmtINR(row.netPayable)} will be marked as paid.
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Payment Date *</label>
            <input type="date" value={paymentDate} max={new Date().toISOString().split('T')[0]}
              onChange={e => setPaymentDate(e.target.value)}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Payment Mode *</label>
            <select value={paymentMode} onChange={e => { setPaymentMode(e.target.value); if (e.target.value === 'Cash') setTransactionRef('') }}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400">
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
          {paymentMode !== 'Cash' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Transaction Reference / UTR *</label>
              <input type="text" value={transactionRef} onChange={e => setTransactionRef(e.target.value)}
                placeholder="e.g. UTR1234567890"
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-700 rounded-lg py-2 text-sm font-medium hover:bg-slate-50 transition">Cancel</button>
            <button onClick={handleConfirm} disabled={saving || amountPaid <= 0}
              className="flex-1 bg-emerald-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-emerald-700 transition flex items-center justify-center gap-2 disabled:opacity-70">
              {saving ? <><Loader2 size={15} className="animate-spin" /> Saving</> : isPartial ? 'Confirm Partial Payment' : 'Confirm & Mark Paid'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Staff List Tab ────────────────────────────────────────────────────────────

function StaffListTab({ teachers, isAdmin, onAdd, onEdit }: {
  teachers: Teacher[]; isAdmin: boolean
  onAdd: () => void; onEdit: (t: Teacher) => void
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const filtered = teachers.filter(t => {
    const matchSearch = `${t.first_name} ${t.last_name} ${t.designation || ''}`.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' || t.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name or designation..."
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 w-64"
          />
          <div className="relative">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="appearance-none border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white">
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Resigned">Resigned</option>
              <option value="Terminated">Terminated</option>
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
        {isAdmin && (
          <button onClick={onAdd} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            <Plus size={15} /> Add Staff
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Designation</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Base Salary</th>
              <th className="px-4 py-3">Hire Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-slate-400 text-sm">No staff found.</td></tr>
            ) : filtered.map(t => (
              <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3">
                  <button
                    onClick={() => router.push(`/staff/${t.id}`)}
                    className="font-semibold text-blue-700 hover:underline text-left"
                  >
                    {t.first_name} {t.last_name}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{t.designation || '—'}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  <div>{t.phone_number || '—'}</div>
                  {t.email && <div className="text-slate-400">{t.email}</div>}
                </td>
                <td className="px-4 py-3 font-medium text-slate-700">{fmtINR(t.base_salary)}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {t.hire_date ? new Date(t.hire_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${
                    t.status === 'Active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                    t.status === 'Resigned' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                    'bg-rose-100 text-rose-700 border-rose-200'
                  }`}>{t.status}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => router.push(`/staff/${t.id}`)}
                      className="text-xs border border-slate-200 px-2.5 py-1 rounded-md hover:bg-slate-50 transition font-medium text-slate-600"
                    >
                      View
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => onEdit(t)}
                        className="text-xs border border-slate-200 px-2.5 py-1 rounded-md hover:bg-slate-50 transition font-medium text-slate-600"
                      >
                        <Edit2 size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Payroll Tab ──────────────────────────────────────────────────────────────

function PayrollTab({
  initialTeachers, initialRecords, initialMonth, initialPrevBalances, isAdmin,
}: {
  initialTeachers: Teacher[]; initialRecords: PayrollRecord[]
  initialMonth: string; initialPrevBalances: Record<string, number>; isAdmin: boolean
}) {
  const months = useMemo(() => allMonths(), [])
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers)
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>(() =>
    buildRows(initialTeachers, initialRecords, initialMonth, initialPrevBalances)
  )
  const [generated, setGenerated] = useState(initialRecords.length > 0)
  const [loadingMonth, setLoadingMonth] = useState(false)
  const [saving, setSaving] = useState(false)
  const [paymentRow, setPaymentRow] = useState<PayrollRow | null>(null)

  const editable = isEditablePeriod(selectedMonth)

  function buildRows(
    ts: Teacher[],
    records: PayrollRecord[],
    month: string,
    prevBalances: Record<string, number>
  ): PayrollRow[] {
    const recMap = new Map(records.map(r => [r.teacher_id, r]))

    return ts.map(t => {
      const rec = recMap.get(t.id)
      if (rec) {
        const isPaid = rec.status === 'Paid'
        const arrears = Number(rec.arrears_brought_forward || 0)
        const netPayable = Number(rec.net_payable || calcNetPayable(Number(rec.base_amount), Number(rec.bonus_amount), Number(rec.deduction_amount), arrears))
        const amtPaid = Number(rec.amount_paid || 0)
        return {
          localId: rec.id,
          dbRowId: rec.id,
          teacher: t,
          monthYear: month,
          baseAmount: Number(rec.base_amount),
          bonusAmount: Number(rec.bonus_amount),
          deductionAmount: Number(rec.deduction_amount),
          arrearsAmount: arrears,
          netPayable,
          amountPaid: amtPaid,
          balanceCarriedForward: Number(rec.balance_carried_forward || calcBalance(netPayable, amtPaid)),
          remarks: rec.remarks || '',
          status: isPaid ? 'Paid' : rec.status === 'Pending Approval' ? 'Pending Approval' : 'Draft',
          isPaid,
          paymentMode: rec.payment_mode || '',
          transactionReference: rec.transaction_reference || '',
        } as PayrollRow
      }
      // No DB record — draft row: auto-load arrears from prev month
      const arrears = prevBalances[t.id] || 0
      const netPayable = calcNetPayable(t.base_salary, 0, 0, arrears)
      return {
        localId: crypto.randomUUID(),
        teacher: t,
        monthYear: month,
        baseAmount: t.base_salary,
        bonusAmount: 0,
        deductionAmount: 0,
        arrearsAmount: arrears,
        netPayable,
        amountPaid: netPayable,
        balanceCarriedForward: 0,
        remarks: '',
        status: 'Draft' as PayrollStatus,
        isPaid: false,
        paymentMode: '',
        transactionReference: '',
      }
    })
  }

  const handleMonthChange = useCallback(async (month: string) => {
    setSelectedMonth(month)
    setLoadingMonth(true)
    try {
      const res = await fetch(`/api/payroll?month=${encodeURIComponent(month)}`)
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      setTeachers(json.teachers)
      const rows = buildRows(json.teachers, json.payrollRecords, month, json.prevMonthBalances || {})
      setPayrollRows(rows)
      setGenerated(rows.some(r => r.dbRowId !== undefined))
    } catch {
      toast.error('Failed to load payroll data.')
    } finally {
      setLoadingMonth(false)
    }
  }, [])

  const handleGenerate = () => {
    // When generating fresh, build with current prevBalances from state
    const prevBalances: Record<string, number> = {}
    for (const r of payrollRows) {
      prevBalances[r.teacher.id] = r.arrearsAmount
    }
    setPayrollRows(buildRows(teachers, [], selectedMonth, prevBalances))
    setGenerated(true)
  }

  const updateRow = useCallback((localId: string, patch: Partial<PayrollRow>) => {
    setPayrollRows(prev => prev.map(r => {
      if (r.localId !== localId) return r
      const updated = { ...r, ...patch }
      // Recalculate net payable and balance whenever relevant fields change
      if ('baseAmount' in patch || 'bonusAmount' in patch || 'deductionAmount' in patch || 'arrearsAmount' in patch) {
        updated.netPayable = calcNetPayable(updated.baseAmount, updated.bonusAmount, updated.deductionAmount, updated.arrearsAmount)
        // Keep amountPaid capped at new netPayable
        if (updated.amountPaid > updated.netPayable) updated.amountPaid = updated.netPayable
        updated.balanceCarriedForward = calcBalance(updated.netPayable, updated.amountPaid)
      }
      if ('amountPaid' in patch) {
        const paid = Math.min(updated.amountPaid, updated.netPayable)
        updated.amountPaid = paid
        updated.balanceCarriedForward = calcBalance(updated.netPayable, paid)
      }
      return updated
    }))
  }, [])

  const handleStatusChange = useCallback((row: PayrollRow, newStatus: string) => {
    if (row.isPaid || !editable) return
    if (newStatus === 'Paid') { setPaymentRow(row) }
    else { updateRow(row.localId, { status: newStatus as PayrollStatus }) }
  }, [updateRow, editable])

  const handleSave = async () => {
    if (!editable) { toast.error('This period is locked for editing.'); return }
    const toSave = payrollRows.filter(r => !r.isPaid)
    if (!toSave.length) { toast('Nothing to save.'); return }
    setSaving(true)
    const result = await savePayrollDrafts(toSave.map(r => ({
      teacherId: r.teacher.id, monthYear: r.monthYear,
      baseAmount: r.baseAmount, bonusAmount: r.bonusAmount,
      deductionAmount: r.deductionAmount,
      arrearsAmount: r.arrearsAmount,
      netPayable: r.netPayable,
      amountPaid: r.amountPaid,
      balanceCarriedForward: r.balanceCarriedForward,
      remarks: r.remarks, status: r.status, dbRowId: r.dbRowId,
    })))
    setSaving(false)
    if (result.error) { toast.error(result.error); return }
    if (result.insertedRows?.length) {
      setPayrollRows(prev => prev.map(r => {
        const match = result.insertedRows!.find(ir => ir.teacherId === r.teacher.id && !r.dbRowId)
        return match ? { ...r, dbRowId: match.dbRowId, localId: match.dbRowId } : r
      }))
    }
    toast.success('Changes saved.')
  }

  const summary = useMemo(() => {
    const totalPayable = payrollRows.reduce((s, r) => s + r.netPayable, 0)
    const totalPaid = payrollRows.filter(r => r.isPaid).reduce((s, r) => s + r.amountPaid, 0)
    const totalCarried = payrollRows.reduce((s, r) => s + r.balanceCarriedForward, 0)
    const totalArrears = payrollRows.reduce((s, r) => s + r.arrearsAmount, 0)
    return { totalPayable, totalPaid, totalCarried, totalArrears }
  }, [payrollRows])

  const paidRows = payrollRows.filter(r => r.isPaid)
  const hasAnyArrears = payrollRows.some(r => r.arrearsAmount > 0)

  return (
    <>
      {paymentRow && (
        <PaymentModal
          row={paymentRow}
          onClose={() => setPaymentRow(null)}
          onPaid={() => { setPaymentRow(null); handleMonthChange(selectedMonth) }}
        />
      )}

      <div className="space-y-5">
        {/* Controls row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <select value={selectedMonth} onChange={e => handleMonthChange(e.target.value)} disabled={loadingMonth}
                className="appearance-none border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-400 bg-white shadow-sm cursor-pointer">
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {!editable && (
              <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg font-medium">
                <Lock size={12} /> View only — outside edit window (±2 months)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {generated && paidRows.length > 0 && (
              <button onClick={() => printPayslips(paidRows, selectedMonth)}
                className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition">
                <FileText size={15} /> Print Payslips ({paidRows.length})
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        {generated && (
          <div className={`grid gap-4 ${hasAnyArrears ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'}`}>
            <div className="bg-white rounded-xl border p-4 shadow-sm">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Net Payable</div>
              <div className="text-xl font-bold text-slate-800">{fmtINR(summary.totalPayable)}</div>
            </div>
            <div className="bg-white rounded-xl border p-4 shadow-sm">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Disbursed</div>
              <div className="text-xl font-bold text-emerald-600">{fmtINR(summary.totalPaid)}</div>
            </div>
            {hasAnyArrears && (
              <div className="bg-violet-50 rounded-xl border border-violet-200 p-4 shadow-sm">
                <div className="text-xs text-violet-600 font-medium uppercase tracking-wider mb-1">Arrears Included</div>
                <div className="text-xl font-bold text-violet-700">{fmtINR(summary.totalArrears)}</div>
              </div>
            )}
            <div className={`rounded-xl border p-4 shadow-sm ${summary.totalCarried > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white'}`}>
              <div className={`text-xs font-medium uppercase tracking-wider mb-1 ${summary.totalCarried > 0 ? 'text-amber-600' : 'text-slate-500'}`}>Carry Forward</div>
              <div className={`text-xl font-bold ${summary.totalCarried > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{fmtINR(summary.totalCarried)}</div>
            </div>
          </div>
        )}

        {loadingMonth && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        )}

        {!loadingMonth && !generated && editable && (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border shadow-sm gap-4">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
              <IndianRupee size={28} className="text-blue-400" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-700">No payroll for {selectedMonth}</p>
              <p className="text-sm text-slate-400 mt-1">Generate payroll for all active staff.</p>
            </div>
            <button onClick={handleGenerate}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
              Generate Payroll for {selectedMonth}
            </button>
          </div>
        )}

        {!loadingMonth && !generated && !editable && (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border shadow-sm gap-3">
            <Lock size={28} className="text-slate-300" />
            <p className="text-slate-500 text-sm">No payroll records for {selectedMonth}.</p>
          </div>
        )}

        {/* Payroll Table */}
        {!loadingMonth && generated && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Staff</th>
                    <th className="px-4 py-3">Base</th>
                    <th className="px-4 py-3">Bonus (₹)</th>
                    <th className="px-4 py-3">Deduction (₹)</th>
                    <th className="px-4 py-3 text-violet-600">Arrears (₹)</th>
                    <th className="px-4 py-3 text-emerald-700">Net Payable</th>
                    <th className="px-4 py-3">Amount Paid (₹)</th>
                    <th className="px-4 py-3 text-amber-600">Carry Fwd</th>
                    <th className="px-4 py-3">Remarks</th>
                    <th className="px-4 py-3 w-44">Status</th>
                    <th className="px-4 py-3 w-16 text-center">Print</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payrollRows.map(row => {
                    const locked = row.isPaid || !editable
                    const hasBalance = row.balanceCarriedForward > 0

                    return (
                      <tr key={row.localId} className={`transition-colors ${row.isPaid ? 'bg-emerald-50/40' : 'hover:bg-slate-50/50'}`}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{row.teacher.first_name} {row.teacher.last_name}</div>
                          {row.teacher.designation && <div className="text-[10px] text-slate-400 mt-0.5">{row.teacher.designation}</div>}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{fmtINR(row.baseAmount)}</td>
                        <td className="px-4 py-3">
                          <NumInput value={row.bonusAmount} onChange={v => updateRow(row.localId, { bonusAmount: v })} disabled={locked} />
                        </td>
                        <td className="px-4 py-3">
                          <NumInput value={row.deductionAmount} onChange={v => updateRow(row.localId, { deductionAmount: v })} disabled={locked} />
                        </td>
                        <td className="px-4 py-3">
                          {locked ? (
                            <span className={`text-sm font-medium ${row.arrearsAmount > 0 ? 'text-violet-700' : 'text-slate-400'}`}>
                              {row.arrearsAmount > 0 ? fmtINR(row.arrearsAmount) : '—'}
                            </span>
                          ) : (
                            <div className="relative">
                              <NumInput
                                value={row.arrearsAmount}
                                onChange={v => updateRow(row.localId, { arrearsAmount: v })}
                                className="border-violet-200 focus:ring-violet-400"
                              />
                              {row.arrearsAmount > 0 && (
                                <div className="text-[9px] text-violet-500 mt-0.5 whitespace-nowrap">from {prevMonthLabel(row.monthYear)}</div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-emerald-700 whitespace-nowrap">{fmtINR(row.netPayable)}</span>
                        </td>
                        <td className="px-4 py-3">
                          {locked ? (
                            <span className="font-semibold text-slate-800 whitespace-nowrap">{fmtINR(row.amountPaid)}</span>
                          ) : (
                            <NumInput
                              value={row.amountPaid}
                              onChange={v => updateRow(row.localId, { amountPaid: Math.min(v, row.netPayable) })}
                              className="border-slate-300"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {hasBalance ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 whitespace-nowrap">
                              {fmtINR(row.balanceCarriedForward)}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {locked ? (
                            <div className="text-xs text-slate-500 space-y-0.5">
                              {row.remarks && <div>{row.remarks}</div>}
                              {row.paymentMode && (
                                <div className="text-[10px] text-slate-400">
                                  {row.paymentMode}{row.transactionReference ? ` • ${row.transactionReference}` : ''}
                                </div>
                              )}
                            </div>
                          ) : (
                            <input type="text" value={row.remarks}
                              onChange={e => updateRow(row.localId, { remarks: e.target.value })}
                              placeholder="Optional notes"
                              className="w-full min-w-[120px] border border-slate-200 rounded-md px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {row.isPaid ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">Paid</span>
                              {row.balanceCarriedForward > 0 && (
                                <div className="text-[9px] text-amber-600 font-medium">{fmtINR(row.balanceCarriedForward)} carried</div>
                              )}
                            </div>
                          ) : !editable ? (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              row.status === 'Pending Approval' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>{row.status}</span>
                          ) : (
                            <div className="relative">
                              <select value={row.status} onChange={e => handleStatusChange(row, e.target.value)}
                                className="appearance-none border border-slate-200 rounded-md px-2 py-1 pr-6 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer">
                                <option value="Draft">Draft</option>
                                <option value="Pending Approval">Pending Approval</option>
                                <option value="Paid">Mark as Paid</option>
                              </select>
                              <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {row.isPaid ? (
                            <button onClick={() => printPayslips([row], selectedMonth)} title="Print Payslip"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition text-xs font-medium">
                              <Download size={13} />
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {editable && (
              <div className="flex justify-end items-center gap-3 px-4 py-3 border-t bg-slate-50">
                <span className="text-xs text-slate-500 mr-auto">
                  {payrollRows.filter(r => !r.isPaid).length} pending row(s)
                </span>
                <button onClick={handleSave}
                  disabled={saving || payrollRows.every(r => r.isPaid)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Root Component ───────────────────────────────────────────────────────────

export default function PayrollClient({
  initialTeachers,
  initialRecords,
  initialMonth,
  initialPrevBalances,
  userRole,
}: {
  initialTeachers: Teacher[]
  initialRecords: PayrollRecord[]
  initialMonth: string
  initialPrevBalances: Record<string, number>
  userRole: 'Admin' | 'Accountant'
}) {
  const isAdmin = userRole === 'Admin'
  const [activeTab, setActiveTab] = useState<'payroll' | 'staff'>('payroll')
  const [addStaffOpen, setAddStaffOpen] = useState(false)
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null)
  const [staffList, setStaffList] = useState<Teacher[]>(initialTeachers)

  const refreshStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/payroll?list=teachers')
      const json = await res.json()
      if (!json.error) setStaffList(json.teachers)
    } catch { /* ignore */ }
  }, [])

  return (
    <div className="flex flex-col gap-6 p-6">
      {(addStaffOpen || editTeacher) && (
        <StaffModal
          initial={editTeacher || undefined}
          onClose={() => { setAddStaffOpen(false); setEditTeacher(null) }}
          onSaved={() => { setAddStaffOpen(false); setEditTeacher(null); refreshStaff() }}
        />
      )}

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Staff Payroll</h1>
          <p className="text-sm text-gray-500">Manage monthly compensation and staff profiles</p>
        </div>
        {isAdmin && activeTab === 'staff' && (
          <button onClick={() => setAddStaffOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            <Plus size={15} /> Add Staff
          </button>
        )}
      </div>

      <div className="flex border-b border-slate-200">
        {([
          { key: 'payroll', label: 'Payroll', icon: IndianRupee },
          { key: 'staff', label: 'Staff List', icon: Users },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}>
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'payroll' && (
        <PayrollTab
          initialTeachers={initialTeachers}
          initialRecords={initialRecords}
          initialMonth={initialMonth}
          initialPrevBalances={initialPrevBalances}
          isAdmin={isAdmin}
        />
      )}

      {activeTab === 'staff' && (
        <StaffListTab
          teachers={staffList}
          isAdmin={isAdmin}
          onAdd={() => setAddStaffOpen(true)}
          onEdit={t => setEditTeacher(t)}
        />
      )}
    </div>
  )
}
