'use client'

import { useTransition } from 'react'
import { setGlobalAcademicYear } from '@/actions/settings.action'
import Link from 'next/link'

interface AcademicYear {
  id: string;
  name: string;
}

export function YearSelector({ 
  years, 
  currentYearId,
  isAdmin
}: { 
  years: AcademicYear[]; 
  currentYearId?: string;
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition()

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value
    startTransition(() => {
      setGlobalAcademicYear(selectedId)
    })
  }

  if (years.length === 0) {
    return (
      <div className="px-4 py-3 border-b bg-amber-50">
        <p className="text-xs font-medium text-amber-800 mb-2">No Academic Years Found</p>
        {isAdmin ? (
          <Link href="/settings" className="px-3 py-1.5 bg-amber-600 text-white text-xs rounded shadow-sm hover:bg-amber-700 block text-center font-medium">
            Configure Academic Year
          </Link>
        ) : (
          <p className="text-xs text-amber-600">Please contact an Admin to start an academic session.</p>
        )}
      </div>
    )
  }

  return (
    <div className="px-4 py-3 border-b">
      <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
        Academic Year
      </label>
      <select 
        value={currentYearId || ''}
        onChange={handleYearChange}
        disabled={isPending}
        className="w-full bg-gray-50 border-gray-200 text-sm rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
      >
        <option value="" disabled>Select Year...</option>
        {years.map((year) => (
          <option key={year.id} value={year.id}>
            {year.name}
          </option>
        ))}
      </select>
    </div>
  )
}