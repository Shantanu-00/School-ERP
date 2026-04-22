import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import PromotionWizard from '@/components/features/dashboard/PromotionWizard'

export default async function PromotionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staffData } = await supabase.from('staff').select('role').eq('auth_id', user.id).maybeSingle()
  if (staffData?.role !== 'Admin') redirect('/dashboard')

  const { data: academicYears } = await supabase.from('academic_years').select('*').order('start_date', { ascending: false })
  const { data: classes } = await supabase.from('classes').select('*').order('grade_level', { ascending: true }).order('section', { ascending: true })

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 p-4">
      <Link href="/settings" className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 w-fit mb-4">
        <ArrowLeft size={16} /> Back to Settings
      </Link>
      
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Promotion Wizard</h1>
        <p className="text-slate-500 text-sm mt-1">Safely rollover students from one academic year to the next.</p>
      </div>

      <PromotionWizard academicYears={academicYears || []} classes={classes || []} />
    </div>
  )
}