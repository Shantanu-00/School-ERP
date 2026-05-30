'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import {
  Settings,
  Loader2,
  RefreshCw,
  Send,
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getFeeReminderStudents,
  sendFeeRemindersAction,
  type FeeReminderStudent,
  type FeeReminderGroup,
  type SendFeeRemindersResult,
} from '@/actions/whatsapp.actions'

// ─── WhatsApp SVG Icon ────────────────────────────────────────────────────────
function WhatsAppIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="16" cy="16" r="16" fill="#25D366" />
      <path
        d="M22.5 9.4C20.8 7.7 18.5 6.7 16 6.7c-5.2 0-9.4 4.2-9.4 9.4 0 1.7.4 3.3 1.2 4.7L6.6 25.3l4.6-1.2c1.4.7 2.9 1.1 4.5 1.1h.1c5.2 0 9.4-4.2 9.4-9.4-.1-2.5-1.1-4.8-2.7-6.4zm-6.5 14.4c-1.4 0-2.8-.4-4-1.1l-.3-.2-2.9.8.8-2.8-.2-.3c-.8-1.2-1.2-2.6-1.2-4.1 0-4.2 3.4-7.6 7.6-7.6 2 0 3.9.8 5.4 2.2 1.4 1.4 2.2 3.3 2.2 5.3.1 4.2-3.3 7.8-7.4 7.8zm4.2-5.7c-.2-.1-1.3-.6-1.5-.7-.2-.1-.3-.1-.5.1-.1.2-.5.7-.7.8-.1.1-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.4c.1-.1.2-.3.2-.4.1-.1 0-.3 0-.4-.1-.1-.5-1.2-.7-1.6-.2-.4-.4-.4-.5-.4h-.4c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2 1 2.4c.1.2 1.7 2.6 4.1 3.6.6.2 1 .4 1.4.5.6.2 1.1.2 1.5.1.5-.1 1.3-.5 1.5-1s.2-1 .1-1.1c0-.2-.2-.3-.4-.4z"
        fill="white"
      />
    </svg>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

type PageState = 'idle' | 'loading' | 'ready' | 'confirming' | 'sending' | 'done'

// ─── Props ────────────────────────────────────────────────────────────────────
interface MessagesClientProps {
  classes: { id: string; grade_level: string; section: string }[]
  currentYearId: string | null
  currentYearName: string | null
  isAdmin: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────
export function MessagesClient({
  classes,
  currentYearId,
  currentYearName,
  isAdmin,
}: MessagesClientProps) {
  const [pageState, setPageState] = useState<PageState>('idle')
  const [selectedGroup, setSelectedGroup] = useState<FeeReminderGroup | null>(null)
  const [students, setStudents] = useState<FeeReminderStudent[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [minAmount, setMinAmount] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [result, setResult] = useState<SendFeeRemindersResult | null>(null)
  const [, startTransition] = useTransition()

  // ─── Derived: filtered students ───────────────────────────────────────────
  const displayedStudents = students.filter((s) => {
    const minVal = parseFloat(minAmount)
    if (!isNaN(minVal) && minVal > 0 && s.outstanding_amount < minVal) return false
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase()
      if (!fullName.includes(q) && !s.admission_number.toLowerCase().includes(q)) return false
    }
    return true
  })

  // ─── Prune selectedIds when displayedStudents changes ────────────────────
  useEffect(() => {
    const displayedIdSet = new Set(displayedStudents.map((s) => s.id))
    setSelectedIds((prev) => {
      const pruned = new Set<string>()
      prev.forEach((id) => {
        if (displayedIdSet.has(id)) pruned.add(id)
      })
      return pruned
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedStudents.map((s) => s.id).join(',')])

  // ─── Derived stats ────────────────────────────────────────────────────────
  const studentsWithPhone = students.filter((s) => s.primary_contact_number)
  const studentsWithoutPhone = students.filter((s) => !s.primary_contact_number)
  const totalOutstanding = students.reduce((sum, s) => sum + s.outstanding_amount, 0)

  const selectedStudents = displayedStudents.filter((s) => selectedIds.has(s.id))
  const selectedWithPhone = selectedStudents.filter((s) => s.primary_contact_number)
  const selectedWithoutPhone = selectedStudents.filter((s) => !s.primary_contact_number)
  const selectedOutstanding = selectedStudents.reduce((sum, s) => sum + s.outstanding_amount, 0)

  // Master checkbox state
  const displayedWithPhone = displayedStudents.filter((s) => s.primary_contact_number)
  const allDisplayedSelected =
    displayedWithPhone.length > 0 &&
    displayedWithPhone.every((s) => selectedIds.has(s.id))
  const someDisplayedSelected =
    displayedWithPhone.some((s) => selectedIds.has(s.id)) && !allDisplayedSelected

  // ─── Group button handler ─────────────────────────────────────────────────
  function handleGroupSelect(group: FeeReminderGroup) {
    if (!currentYearId || pageState === 'loading') return
    setSelectedGroup(group)
    setPageState('loading')
    setMinAmount('')
    setSearchQuery('')
    setResult(null)

    startTransition(async () => {
      const res = await getFeeReminderStudents(group, currentYearId)
      if (res.error) {
        toast.error(res.error)
        setPageState('idle')
        return
      }
      const data = res.data
      setStudents(data)
      setSelectedIds(
        new Set(data.filter((s) => s.primary_contact_number).map((s) => s.id))
      )
      setPageState('ready')
    })
  }

  // ─── Checkbox handlers ────────────────────────────────────────────────────
  function toggleStudent(id: string, hasPhone: boolean) {
    if (!hasPhone) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleMasterCheckbox() {
    if (allDisplayedSelected) {
      // deselect all displayed students with phone
      setSelectedIds((prev) => {
        const next = new Set(prev)
        displayedWithPhone.forEach((s) => next.delete(s.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        displayedWithPhone.forEach((s) => next.add(s.id))
        return next
      })
    }
  }

  function removeStudent(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  // ─── Send handler ─────────────────────────────────────────────────────────
  function handleSendConfirm() {
    if (!currentYearId || !selectedGroup) return
    setPageState('sending')
    startTransition(async () => {
      // Build records with outstanding_amount for the edge function
      const records = displayedStudents
        .filter((s) => selectedIds.has(s.id))
        .map((s) => ({ student_id: s.id, outstanding_amount: s.outstanding_amount }))

      const res = await sendFeeRemindersAction(records)
      if (res.error && res.sent === 0 && res.failed === 0 && res.skipped === 0) {
        toast.error(res.error)
        setPageState('ready')
        return
      }
      setResult(res)
      setPageState('done')
    })
  }

  // ─── Reset ────────────────────────────────────────────────────────────────
  function handleReset() {
    setPageState('idle')
    setSelectedGroup(null)
    setStudents([])
    setSelectedIds(new Set())
    setMinAmount('')
    setSearchQuery('')
    setResult(null)
  }

  // ─── Determine if a group button is currently selected ────────────────────
  function isGroupSelected(group: FeeReminderGroup): boolean {
    if (!selectedGroup) return false
    return (
      selectedGroup.student_status === group.student_status &&
      (selectedGroup.class_id ?? null) === (group.class_id ?? null)
    )
  }

  // ─── Group button definitions ─────────────────────────────────────────────
  const groupButtons: { label: string; group: FeeReminderGroup }[] = [
    { label: 'All Active Students', group: { student_status: 'Active', class_id: null } },
    ...classes.map((c) => ({
      label: `${c.grade_level} – ${c.section}`,
      group: { student_status: 'Active' as const, class_id: c.id },
    })),
    { label: 'Alumni', group: { student_status: 'Alumni', class_id: null } },
    { label: 'Dropouts', group: { student_status: 'Dropout', class_id: null } },
  ]

  // ─── Pending amount colour ─────────────────────────────────────────────────
  function pendingColor(amount: number): string {
    if (amount > 5000) return 'text-red-600 font-semibold'
    if (amount >= 1000) return 'text-amber-600 font-semibold'
    return 'text-slate-600'
  }

  const showFloatingBar =
    selectedIds.size > 0 && pageState === 'ready'

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-32">

      {/* ── PAGE HEADER ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <WhatsAppIcon size={32} />
          <div>
            <h1 className="text-2xl font-bold text-slate-800 leading-tight">Fee Reminders</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Send pending fee reminders via WhatsApp to parents
            </p>
          </div>
        </div>
        {isAdmin && (
          <Link
            href="/messages/settings"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
          >
            <Settings size={15} />
            Settings
          </Link>
        )}
      </div>

      {/* ── NO ACTIVE YEAR BANNER ─────────────────────────────────────────── */}
      {!currentYearId && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-5 py-4 text-sm">
          <AlertTriangle size={18} className="shrink-0 text-amber-500" />
          <span>
            No active academic year found. Please configure one in{' '}
            <Link href="/settings" className="font-semibold underline underline-offset-2">
              Settings
            </Link>
            .
          </span>
        </div>
      )}

      {/* ── STEP 1 — GROUP SELECTOR ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-1">
          Step 1 — Select a student group
        </h2>
        <p className="text-sm text-slate-500 mb-5">
          Tap a group to load students with pending fees
        </p>

        <div className="flex flex-wrap gap-2.5">
          {groupButtons.map(({ label, group }) => {
            const isSelected = isGroupSelected(group)
            const isLoadingThis = isSelected && pageState === 'loading'

            return (
              <button
                key={`${group.student_status}-${group.class_id ?? 'all'}`}
                onClick={() => handleGroupSelect(group)}
                disabled={!currentYearId || pageState === 'loading'}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  isSelected
                    ? 'bg-[#25D366] text-white border-[#1ebe5d] shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-[#25D366] hover:text-[#25D366]'
                }`}
              >
                {isLoadingThis && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── STEP 2 — STATS BANNER ─────────────────────────────────────────── */}
      {pageState !== 'idle' && pageState !== 'loading' && (
        <div className="bg-white rounded-2xl border border-slate-200 px-6 py-5 space-y-3">
          <div className="flex flex-wrap items-end gap-4 justify-between">
            <div>
              <p className="text-slate-500 text-sm mb-1">Students with pending fees</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-slate-800">{students.length}</span>
                <span className="text-base text-slate-500">students with pending fees</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Total outstanding:{' '}
                <span className="font-semibold text-slate-800">{fmt(totalOutstanding)}</span>
              </p>
            </div>
            {currentYearName && (
              <span className="inline-flex items-center px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                {currentYearName}
              </span>
            )}
          </div>

          {studentsWithoutPhone.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-700 rounded-lg px-4 py-2.5 text-sm">
              <AlertTriangle size={15} className="shrink-0" />
              <span>
                <strong>{studentsWithoutPhone.length}</strong> student
                {studentsWithoutPhone.length > 1 ? 's have' : ' has'} no phone number and will be
                automatically skipped
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3 — FILTERS ─────────────────────────────────────────────── */}
      {pageState !== 'idle' && pageState !== 'loading' && (
        <div className="bg-white rounded-2xl border border-slate-200 px-6 py-5">
          <div className="flex flex-wrap gap-5 items-end">
            {/* Min amount filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Only include students owing more than:
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium select-none">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition"
                />
              </div>
            </div>

            {/* Search filter */}
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or admission no."
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition"
              />
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-4">
            Showing{' '}
            <span className="font-semibold text-slate-700">{displayedStudents.length}</span> of{' '}
            <span className="font-semibold text-slate-700">{students.length}</span> students
            {' · '}
            <span className="font-semibold text-slate-700">{selectedIds.size}</span> selected
          </p>
        </div>
      )}

      {/* ── STEP 4 — STUDENT TABLE ────────────────────────────────────────── */}
      {pageState !== 'idle' && pageState !== 'loading' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {displayedStudents.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <RefreshCw size={28} className="text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500 mb-2">
                No students match your current filters.
              </p>
              <button
                onClick={() => {
                  setMinAmount('')
                  setSearchQuery('')
                }}
                className="text-sm text-[#25D366] hover:underline font-medium"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={allDisplayedSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someDisplayedSelected
                        }}
                        onChange={toggleMasterCheckbox}
                        className="w-4 h-4 rounded border-slate-300 text-[#25D366] cursor-pointer accent-[#25D366]"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Class
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Phone
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Pending Fees
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-16">
                      Remove
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayedStudents.map((s) => {
                    const hasPhone = !!s.primary_contact_number
                    const isChecked = selectedIds.has(s.id)

                    return (
                      <tr
                        key={s.id}
                        onClick={() => toggleStudent(s.id, hasPhone)}
                        className={`transition-colors ${
                          hasPhone
                            ? 'hover:bg-slate-50 cursor-pointer'
                            : 'opacity-60 cursor-default'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!hasPhone}
                            onChange={() => toggleStudent(s.id, hasPhone)}
                            className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-[#25D366] disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </td>

                        {/* Name */}
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-slate-800">
                            {s.first_name} {s.last_name}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{s.admission_number}</p>
                        </td>

                        {/* Class */}
                        <td className="px-4 py-3.5 text-slate-600">
                          {s.grade_level && s.section
                            ? `${s.grade_level} ${s.section}`
                            : '—'}
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-3.5">
                          {hasPhone ? (
                            <span className="text-slate-600 font-mono text-xs">
                              {s.primary_contact_number}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-xs font-medium">
                              <AlertTriangle size={11} />
                              No phone · will be skipped
                            </span>
                          )}
                        </td>

                        {/* Pending */}
                        <td className={`px-4 py-3.5 text-right ${pendingColor(s.outstanding_amount)}`}>
                          {fmt(s.outstanding_amount)}
                        </td>

                        {/* Remove */}
                        <td
                          className="px-4 py-3.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => removeStudent(s.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Remove from selection"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── DONE STATE ───────────────────────────────────────────────────── */}
      {pageState === 'done' && result && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Send Results</h3>

          {result.sent > 0 && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl px-4 py-3 text-sm">
              <CheckCircle2 size={18} className="shrink-0" />
              <span>
                <strong>{result.sent}</strong> message{result.sent > 1 ? 's' : ''} sent successfully
              </span>
            </div>
          )}

          {result.failed > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">
              <XCircle size={18} className="shrink-0" />
              <span>
                <strong>{result.failed}</strong> message{result.failed > 1 ? 's' : ''} failed — check{' '}
                <Link href="/messages/settings" className="underline font-medium">
                  Message Log in Settings
                </Link>
              </span>
            </div>
          )}

          {result.skipped > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 text-amber-700 rounded-xl px-4 py-3 text-sm">
              <AlertTriangle size={18} className="shrink-0" />
              <span>
                <strong>{result.skipped}</strong> student{result.skipped > 1 ? 's' : ''} skipped — no
                phone number on file
              </span>
            </div>
          )}

          {result.error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">
              <XCircle size={18} className="shrink-0" />
              <span>{result.error}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
            >
              <RefreshCw size={15} />
              Reset — send to another group
            </button>
          </div>
        </div>
      )}

      {/* ── FLOATING ACTION BAR ───────────────────────────────────────────── */}
      {showFloatingBar && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-white border border-slate-200 rounded-2xl shadow-xl px-6 py-4">
          <div className="text-sm">
            <span className="font-bold text-slate-800">{selectedIds.size}</span>
            <span className="text-slate-500"> parents selected · </span>
            <span className="font-bold text-slate-800">{fmt(selectedOutstanding)}</span>
            <span className="text-slate-500"> total</span>
          </div>
          <button
            onClick={() => setPageState('confirming')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold rounded-xl transition-colors shadow-sm whitespace-nowrap"
          >
            <Send size={15} />
            Send Reminders via WhatsApp
          </button>
        </div>
      )}

      {/* ── CONFIRMATION MODAL ───────────────────────────────────────────── */}
      {(pageState === 'confirming' || pageState === 'sending') && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
              <WhatsAppIcon size={28} />
              <h2 className="text-lg font-bold text-slate-800">Confirm Send</h2>
            </div>

            {/* Stats */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Students selected</span>
                <span className="font-semibold text-slate-800">{selectedIds.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Messages to be sent</span>
                <span className="font-semibold text-emerald-700">{selectedWithPhone.length}</span>
              </div>
              {selectedWithoutPhone.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Will be skipped (no phone)</span>
                  <span className="font-semibold text-amber-600">{selectedWithoutPhone.length}</span>
                </div>
              )}
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 text-amber-800 rounded-xl px-4 py-3 text-sm leading-relaxed">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />
              <span>
                This will immediately dispatch WhatsApp messages to{' '}
                <strong>{selectedWithPhone.length}</strong> parent
                {selectedWithPhone.length !== 1 ? 's' : ''}. Once sent, this cannot be undone. You
                can monitor delivery in{' '}
                <strong>Messages → Settings → Message Log</strong>.
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={() => setPageState('ready')}
                disabled={pageState === 'sending'}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSendConfirm}
                disabled={pageState === 'sending'}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-70 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
              >
                {pageState === 'sending' ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    Send {selectedWithPhone.length} Message{selectedWithPhone.length !== 1 ? 's' : ''} Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
