'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export function FilterForm({ 
  status, 
  limit, 
  query, 
  sortBy, 
  sortOrder,
  feesStatus
}: { 
  status: string; 
  limit: number; 
  query: string; 
  sortBy: string; 
  sortOrder: string; 
  feesStatus: string;
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (e.target.name === 'sortCombo') {
      const [col, order] = e.target.value.split('-')
      params.set('sortBy', col)
      params.set('sortOrder', order)
    } else {
      params.set(e.target.name, e.target.value)
    }
    
    params.set('page', '1') // Reset to page 1 on filter change
    router.push(`${pathname}?${params.toString()}`)
  }

  const sortCombo = `${sortBy}-${sortOrder}`

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select 
        name="status" 
        value={status}
        onChange={onChange}
        className="border rounded-md px-3 py-2 text-sm bg-white outline-none cursor-pointer text-gray-700"
      >
        <option value="Both">All Former Students</option>
        <option value="Alumni">Alumni Only</option>
        <option value="Dropout">Dropouts Only</option>
      </select>

      <select 
        name="feesStatus" 
        value={feesStatus}
        onChange={onChange}
        className="border rounded-md px-3 py-2 text-sm bg-white outline-none cursor-pointer text-gray-700"
      >
        <option value="All">All Fees Status</option>
        <option value="Pending">Has Pending Fees</option>
        <option value="Cleared">No Pending Fees (Cleared)</option>
      </select>

      <select 
        name="sortCombo" 
        value={sortCombo}
        onChange={onChange}
        className="border rounded-md px-3 py-2 text-sm bg-white outline-none cursor-pointer text-gray-700"
      >
        <option value="name-asc">Sort Name (A-Z)</option>
        <option value="name-desc">Sort Name (Z-A)</option>
        <option value="dues-desc">Highest Pending Fees</option>
        <option value="dues-asc">Lowest Pending Fees</option>
        <option value="passout_year-desc">Recent Passouts</option>
        <option value="passout_year-asc">Oldest Passouts</option>
      </select>

      <select 
        name="limit" 
        value={limit.toString()}
        onChange={onChange}
        className="border rounded-md px-3 py-2 text-sm bg-white outline-none cursor-pointer text-gray-700"
      >
        <option value="10">10 per page</option>
        <option value="20">20 per page</option>
        <option value="50">50 per page</option>
        <option value="100">100 per page</option>
      </select>
    </div>
  )
}
