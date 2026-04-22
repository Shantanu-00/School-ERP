'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface FinanceFiltersProps {
  sortBy: string
  sortOrder: string
  discount: string
  feesStatus: string
  canViewFees: boolean
}

export function FinanceFilters({
  sortBy,
  sortOrder,
  discount,
  feesStatus,
  canViewFees,
}: FinanceFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    const [newSortBy, newSortOrder] = e.target.value.split('-')
    params.set('sortBy', newSortBy)
    params.set('sortOrder', newSortOrder)
    router.push(`?${params.toString()}`)
  }

  const handleDiscountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('discount', e.target.value)
    router.push(`?${params.toString()}`)
  }

  const handleFeesStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('feesStatus', e.target.value)
    router.push(`?${params.toString()}`)
  }

  return (
    <>
      <div className="relative">
        <select
          name="sortBy"
          className="border rounded-md px-3 py-2 text-sm bg-white outline-none focus:border-blue-500"
          defaultValue={`${sortBy}-${sortOrder}`}
          onChange={handleSortChange}
        >
          <option value="first_name-asc">Name (A-Z)</option>
          <option value="first_name-desc">Name (Z-A)</option>
          <option value="roll_number-asc">Roll No (Asc)</option>
          <option value="roll_number-desc">Roll No (Desc)</option>
        </select>
      </div>

      {canViewFees && (
        <>
          <div className="relative">
            <select
              name="discount"
              defaultValue={discount}
              onChange={handleDiscountChange}
              className="border rounded-md px-3 py-2 text-sm bg-white outline-none focus:border-blue-500"
            >
              <option value="All">All Discounts</option>
              <option value="None">None</option>
              <option value="RTE">RTE</option>
              <option value="Staff Child">Staff Child</option>
              <option value="Sibling">Sibling</option>
              <option value="Management Discount">Management Discount</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="relative">
            <select
              name="feesStatus"
              defaultValue={feesStatus}
              onChange={handleFeesStatusChange}
              className="border rounded-md px-3 py-2 text-sm bg-white outline-none focus:border-blue-500"
            >
              <option value="All">All Dues</option>
              <option value="Pending">Pending Dues</option>
              <option value="Clear">No Dues</option>
            </select>
          </div>
        </>
      )}
    </>
  )
}
