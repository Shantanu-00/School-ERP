'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export function StatusFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  
  const currentStatus = searchParams.get('status') || 'Active'

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('status', newStatus)
      params.set('page', '1') // Reset page on filter change
      router.replace(`${pathname}?${params.toString()}`)
    })
  }

  return (
    <select
      value={currentStatus}
      onChange={handleStatusChange}
      disabled={isPending}
      className="px-4 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
    >
      <option value="All">All Statuses</option>
      <option value="Active">Active</option>
      <option value="Alumni">Alumni</option>
      <option value="Dropout">Dropout</option>
    </select>
  )
}