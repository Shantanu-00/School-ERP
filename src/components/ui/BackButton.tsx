'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import React from 'react'

interface BackButtonProps {
  label?: string
}

export function BackButton({ label = 'Back' }: BackButtonProps) {
  const router = useRouter()

  return (
    <button 
      onClick={() => router.back()} 
      className="group flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition shadow-sm"
    >
      <ChevronLeft size={18} className="text-slate-500 group-hover:text-slate-700 transition" />
      <span className="font-bold text-sm">{label}</span>
    </button>
  )
}
