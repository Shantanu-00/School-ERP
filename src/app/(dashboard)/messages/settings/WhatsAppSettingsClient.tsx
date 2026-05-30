'use client'

import { useState, useTransition, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Wifi,
  BellRing,
  ScrollText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react'
import {
  saveWhatsappCredentials,
  savePocketMoneyConfig,
  type WhatsAppSettingsRow,
  type PocketMoneyConfigRow,
  type WhatsAppLogRow,
} from '@/actions/whatsapp.actions'

// ─── WhatsApp SVG logo ────────────────────────────────────────────────────────
function WhatsAppIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#25D366" />
      <path
        d="M22.5 9.4C20.8 7.7 18.5 6.7 16 6.7c-5.2 0-9.4 4.2-9.4 9.4 0 1.7.4 3.3 1.2 4.7L6.6 25.3l4.6-1.2c1.4.7 2.9 1.1 4.5 1.1h.1c5.2 0 9.4-4.2 9.4-9.4-.1-2.5-1.1-4.8-2.7-6.4zm-6.5 14.4c-1.4 0-2.8-.4-4-1.1l-.3-.2-2.9.8.8-2.8-.2-.3c-.8-1.2-1.2-2.6-1.2-4.1 0-4.2 3.4-7.6 7.6-7.6 2 0 3.9.8 5.4 2.2 1.4 1.4 2.2 3.3 2.2 5.3.1 4.2-3.3 7.8-7.4 7.8zm4.2-5.7c-.2-.1-1.3-.6-1.5-.7-.2-.1-.3-.1-.5.1-.1.2-.5.7-.7.8-.1.1-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.4c.1-.1.2-.3.2-.4.1-.1 0-.3 0-.4-.1-.1-.5-1.2-.7-1.6-.2-.4-.4-.4-.5-.4h-.4c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2 1 2.4c.1.2 1.7 2.6 4.1 3.6.6.2 1 .4 1.4.5.6.2 1.1.2 1.5.1.5-.1 1.3-.5 1.5-1s.2-1 .1-1.1c0-.2-.2-.3-.4-.4z"
        fill="white"
      />
    </svg>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; icon: React.ReactNode }> = {
    Sent:      { color: 'bg-blue-50 text-blue-700',    icon: <CheckCircle2 size={12} /> },
    Delivered: { color: 'bg-emerald-50 text-emerald-700', icon: <CheckCircle2 size={12} /> },
    Read:      { color: 'bg-purple-50 text-purple-700', icon: <CheckCircle2 size={12} /> },
    Failed:    { color: 'bg-red-50 text-red-600',       icon: <XCircle size={12} /> },
  }
  const s = map[status] ?? { color: 'bg-slate-100 text-slate-600', icon: null }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.icon}
      {status}
    </span>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'connection' | 'alerts' | 'logs'

interface Props {
  settings: WhatsAppSettingsRow | null
  pmConfig: PocketMoneyConfigRow | null
  logs: WhatsAppLogRow[]
}

// ─── Component ────────────────────────────────────────────────────────────────
export function WhatsAppSettingsClient({ settings, pmConfig, logs }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('connection')

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'connection', label: 'Connection',   icon: <Wifi size={16} /> },
    { id: 'alerts',     label: 'Alert Rules',  icon: <BellRing size={16} /> },
    { id: 'logs',       label: 'Message Log',  icon: <ScrollText size={16} /> },
  ]

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link href="/messages" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2.5">
          <WhatsAppIcon size={28} />
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-none">WhatsApp Settings</h1>
            <p className="text-xs text-slate-400 mt-0.5">Configure Meta Business API credentials and alert rules</p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {activeTab === 'connection' && <ConnectionTab settings={settings} />}
      {activeTab === 'alerts'     && <AlertsTab pmConfig={pmConfig} />}
      {activeTab === 'logs'       && <LogsTab logs={logs} />}
    </div>
  )
}

// ─── Tab 1: Connection ────────────────────────────────────────────────────────
function ConnectionTab({ settings }: { settings: WhatsAppSettingsRow | null }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null)
  const [showToken, setShowToken] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setResult(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await saveWhatsappCredentials(fd)
      setResult(res)
      if (res.success) {
        // Clear the token field so it's not re-submitted accidentally
        const tokenInput = formRef.current?.querySelector<HTMLInputElement>('[name="access_token"]')
        if (tokenInput) tokenInput.value = ''
      }
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Status banner */}
      <div className={`px-6 py-3 flex items-center gap-2 text-sm font-medium border-b ${
        settings?.has_token
          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
          : 'bg-amber-50 text-amber-700 border-amber-100'
      }`}>
        {settings?.has_token ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
        {settings?.has_token
          ? `Connected · ${settings.display_phone_number} · Last updated ${settings.updated_at ? new Date(settings.updated_at).toLocaleDateString('en-IN') : '—'}`
          : 'Not configured — enter your Meta Business API credentials below'}
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* WABA ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
              WABA ID
            </label>
            <input
              name="waba_id"
              defaultValue={settings?.waba_id ?? ''}
              placeholder="e.g. 123456789012345"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition"
            />
            <p className="text-xs text-slate-400 mt-1">WhatsApp Business Account ID from Meta Business Manager</p>
          </div>

          {/* Phone Number ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
              Phone Number ID
            </label>
            <input
              name="phone_number_id"
              defaultValue={settings?.phone_number_id ?? ''}
              placeholder="e.g. 987654321098765"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition"
            />
            <p className="text-xs text-slate-400 mt-1">Found under WhatsApp → Phone Numbers in Meta</p>
          </div>

          {/* Display Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
              Display Phone Number
            </label>
            <input
              name="display_phone_number"
              defaultValue={settings?.display_phone_number ?? ''}
              placeholder="+919876543210"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition"
            />
            <p className="text-xs text-slate-400 mt-1">The number parents will see messages from</p>
          </div>

          {/* Access Token */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
              System User Access Token
              {settings?.has_token && (
                <span className="ml-2 normal-case font-normal text-slate-400">(leave blank to keep existing)</span>
              )}
            </label>
            <div className="relative">
              <input
                name="access_token"
                type={showToken ? 'text' : 'password'}
                placeholder={settings?.has_token ? '••••••••••••••••' : 'Paste your token here'}
                className="w-full px-3 py-2.5 pr-10 text-sm border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition"
              />
              <button
                type="button"
                onClick={() => setShowToken(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">Encrypted with AES-256 (pgcrypto). Never stored in plain text.</p>
          </div>
        </div>

        {/* Feedback */}
        {result?.error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            <XCircle size={16} className="mt-0.5 shrink-0" />
            {result.error}
          </div>
        )}
        {result?.success && (
          <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 text-sm">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            Credentials saved successfully.
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
          >
            {isPending && <Loader2 size={15} className="animate-spin" />}
            {isPending ? 'Saving…' : 'Save Credentials'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Tab 2: Alert Rules ───────────────────────────────────────────────────────
function AlertsTab({ pmConfig }: { pmConfig: PocketMoneyConfigRow | null }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null)
  const [isEnabled, setIsEnabled] = useState(pmConfig?.is_automated_alerts_enabled ?? true)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setResult(null)
    const fd = new FormData(e.currentTarget)
    fd.set('is_automated_alerts_enabled', String(isEnabled))
    startTransition(async () => {
      const res = await savePocketMoneyConfig(fd)
      setResult(res)
    })
  }

  return (
    <div className="space-y-4">
      {/* Master toggle card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-0.5">Automated Low-Balance Alerts</h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              When a student's pocket money balance drops below the threshold after a debit transaction, a WhatsApp alert is automatically sent to the parent's registered number.
            </p>
          </div>
          {/* Toggle switch */}
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            onClick={() => setIsEnabled(v => !v)}
            className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/30 ${
              isEnabled ? 'bg-[#25D366]' : 'bg-slate-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                isEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {!isEnabled && (
          <div className="mt-4 flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-700 rounded-lg px-4 py-3 text-xs">
            <AlertCircle size={14} className="shrink-0" />
            Automated alerts are currently <strong>disabled</strong>. No notifications will be sent even if the balance is low.
          </div>
        )}
      </div>

      {/* Threshold & Cap card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <h3 className="text-sm font-semibold text-slate-800">Threshold & Anti-Spam Rules</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Low balance threshold */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
              Low Balance Threshold (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₹</span>
              <input
                name="low_balance_threshold"
                type="number"
                min="0"
                step="0.01"
                defaultValue={pmConfig?.low_balance_threshold ?? 100}
                className="w-full pl-7 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">Alert triggers when balance falls below this amount after a debit</p>
          </div>

          {/* Max notifications per drop */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
              Max Alerts Per Balance Drop
            </label>
            <input
              name="max_notifications_per_drop"
              type="number"
              min="1"
              max="10"
              defaultValue={pmConfig?.max_notifications_per_drop ?? 3}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition"
            />
            <p className="text-xs text-slate-400 mt-1">
              After the balance is topped up and drops low again, the counter resets. Max is 10.
            </p>
          </div>
        </div>

        {/* Info callout */}
        <div className="bg-blue-50 border border-blue-100 text-blue-700 rounded-lg px-4 py-3 text-xs leading-relaxed">
          <strong>How the counter resets:</strong> A Supabase trigger resets the alert counter to 0 automatically whenever a
          <strong> CREDIT</strong> transaction pushes the balance back above the threshold. This prevents notification spam
          across repeated small debits.
        </div>

        {/* Feedback */}
        {result?.error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            <XCircle size={16} className="mt-0.5 shrink-0" />
            {result.error}
          </div>
        )}
        {result?.success && (
          <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 text-sm">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            Alert rules saved successfully.
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
          >
            {isPending && <Loader2 size={15} className="animate-spin" />}
            {isPending ? 'Saving…' : 'Save Rules'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Tab 3: Message Log ───────────────────────────────────────────────────────
function LogsTab({ logs }: { logs: WhatsAppLogRow[] }) {
  const messageTypeLabel: Record<string, string> = {
    LOW_BALANCE: 'Low Balance',
    FEE_REMINDER: 'Fee Reminder',
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center py-16 text-center">
        <ScrollText size={32} className="text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-500 mb-1">No messages sent yet</p>
        <p className="text-xs text-slate-400">Once alerts or fee reminders are dispatched, they will appear here.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <p className="text-sm font-semibold text-slate-800">Delivery Log</p>
          <p className="text-xs text-slate-400">Showing the last {logs.length} messages</p>
        </div>
        <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sent At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-5 py-3.5 font-medium text-slate-700">
                  {log.students
                    ? `${log.students.first_name} ${log.students.last_name}`
                    : <span className="text-slate-400 italic text-xs">Deleted student</span>}
                </td>
                <td className="px-5 py-3.5 text-slate-500 font-mono text-xs">{log.recipient_phone}</td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    log.message_type === 'LOW_BALANCE'
                      ? 'bg-orange-50 text-orange-700'
                      : 'bg-blue-50 text-blue-700'
                  }`}>
                    {messageTypeLabel[log.message_type] ?? log.message_type}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={log.delivery_status} />
                  {log.error_message && (
                    <p className="text-xs text-red-500 mt-0.5 max-w-[180px] truncate" title={log.error_message}>
                      {log.error_message}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
