import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Toaster } from 'react-hot-toast'
import { MessagesClient } from './MessagesClient'

export const metadata = { title: 'Messages' }

export default async function MessagesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staffData } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle()

  const userRole = staffData?.role ?? 'Teacher'
  if (!['Admin', 'Accountant'].includes(userRole)) redirect('/dashboard')

  const isAdmin = userRole === 'Admin'

  const cookieStore = await cookies()
  const cookieYearId = cookieStore.get('academic_year_id')?.value ?? null

  const [classesRes, yearsRes] = await Promise.all([
    supabase
      .from('classes')
      .select('id, grade_level, section')
      .order('grade_level')
      .order('section'),
    supabase
      .from('academic_years')
      .select('id, name, is_active')
      .order('start_date', { ascending: false }),
  ])

  const classes = classesRes.data ?? []
  const academicYears = yearsRes.data ?? []

  const activeYear = academicYears.find((y) => y.is_active)
  const cookieYear = cookieYearId ? academicYears.find((y) => y.id === cookieYearId) : null
  const currentYear = activeYear ?? cookieYear ?? academicYears[0] ?? null

  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <MessagesClient
        classes={classes}
        currentYearId={currentYear?.id ?? null}
        currentYearName={currentYear?.name ?? null}
        isAdmin={isAdmin}
      />
    </>
  )
}
