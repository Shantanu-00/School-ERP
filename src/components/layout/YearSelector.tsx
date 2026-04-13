'use client'

import { useTransition } from 'react'
import { setGlobalAcademicYear } from '@/actions/settings.action'

interface AcademicYear {
  id: string;
  name: string;
}

export function YearSelector({ 
  years, 
  currentYearId 
}: { 
  years: AcademicYear[]; 
  currentYearId?: string;
}) {
  const [isPending, startTransition] = useTransition()

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value
    startTransition(() => {
      setGlobalAcademicYear(selectedId)
    })
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