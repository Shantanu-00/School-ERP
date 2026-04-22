'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export function ClassFilter({ classes }: { classes: { id: string, grade_level: string, section: string }[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  
  const currentClass = searchParams.get('class_id') || 'All'

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newClass = e.target.value
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (newClass && newClass !== 'All') {
        params.set('class_id', newClass)
      } else {
        params.delete('class_id')
      }
      params.set('page', '1') // Reset page on filter change
      router.replace(`${pathname}?${params.toString()}`)
    })
  }

  return (
    <select
      value={currentClass}
      onChange={handleClassChange}
      disabled={isPending}
      className="px-4 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
    >
      <option value="All">All Standard</option>
      {classes?.map((c) => (
        <option key={c.id} value={c.id}>
          {c.grade_level} - {c.section}
        </option>
      ))}
    </select>
  )
}
