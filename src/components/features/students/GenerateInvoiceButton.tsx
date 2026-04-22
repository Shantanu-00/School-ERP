'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FilePlus2, Loader2 } from 'lucide-react'
import { generateInvoiceForEnrollment } from '@/actions/finance.actions'

export function GenerateInvoiceButton({ enrollmentId }: { enrollmentId: string }) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const router = useRouter()

  const handleGenerate = () => {
    setFeedback(null)
    startTransition(async () => {
      const result = await generateInvoiceForEnrollment(enrollmentId)
      if (result.error) {
        setFeedback({ type: 'error', message: result.error })
        return
      }

      const amount = typeof result.amount === 'number'
        ? result.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : null
      const suffix = amount ? ` (INR ${amount})` : ''
      const titlePrefix = result.invoiceTitle ? `${result.invoiceTitle} - ` : ''
      setFeedback({ type: 'success', message: `${titlePrefix}invoice generated successfully${suffix}.` })
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isPending}
        className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-emerald-700 transition flex items-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isPending ? <Loader2 size={18} className="animate-spin" /> : <FilePlus2 size={18} />}
        {isPending ? 'Generating Invoice...' : 'Generate Invoice'}
      </button>

      {feedback && (
        <p
          className={`text-xs max-w-sm text-right ${
            feedback.type === 'success' ? 'text-emerald-700' : 'text-red-600'
          }`}
        >
          {feedback.message}
        </p>
      )}
    </div>
  )
}
