'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition, useEffect, useState, useRef } from 'react'

export function SearchInput({ placeholder = "Search..." }: { placeholder?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  
  const initialQuery = searchParams.get('query') || ''
  const [inputValue, setInputValue] = useState(initialQuery)
  
  // Fixed: Added undefined as the initial argument
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    // Only trigger a navigation if the input value actually differs from the URL parameters
    const currentQuery = searchParams.get('query') || ''
    if (inputValue === currentQuery) return

    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    timeoutRef.current = setTimeout(() => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString())
        if (inputValue) {
          params.set('query', inputValue)
          params.set('page', '1') 
        } else {
          params.delete('query')
        }
        router.replace(`${pathname}?${params.toString()}`)
      })
    }, 400) 

    return () => clearTimeout(timeoutRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]) // Removed pathname, router, searchParams to stop the infinite render loop

  return (
    <div className="relative flex-1 max-w-md">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        disabled={isPending}
      />
      {isPending && (
        <span className="absolute right-3 top-2.5 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      )}
    </div>
  )
}