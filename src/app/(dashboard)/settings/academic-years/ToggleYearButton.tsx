'use client'

import { useState, useTransition } from 'react'
import { toggleAcademicYearStatus } from '@/actions/settings.action'
import { Check, PowerOff } from 'lucide-react'

export function ToggleYearButton({ yearId, isActive }: { yearId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useState(isActive)

  const handleClick = () => {
    const next = !optimistic
    setOptimistic(next)
    startTransition(async () => {
      const result = await toggleAcademicYearStatus(yearId, next)
      if (result?.error) {
        // Revert on failure
        setOptimistic(!next)
        alert(result.error)
      }
    })
  }

  if (optimistic) {
    return (
      <div className="flex items-center gap-2">
        <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full flex items-center gap-1 border border-emerald-200">
          <Check size={12} /> Active
        </span>
        <button
          onClick={handleClick}
          disabled={isPending}
          title="Deactivate this academic year"
          className="px-2 py-1 text-xs font-medium rounded-full border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition disabled:opacity-50 flex items-center gap-1"
        >
          <PowerOff size={11} />
          {isPending ? '...' : 'Deactivate'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs font-medium rounded-full border border-slate-200">
        Inactive
      </span>
      <button
        onClick={handleClick}
        disabled={isPending}
        title="Activate this academic year"
        className="px-2 py-1 text-xs font-medium rounded-full border border-slate-200 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition disabled:opacity-50 flex items-center gap-1"
      >
        <Check size={11} />
        {isPending ? '...' : 'Activate'}
      </button>
    </div>
  )
}
