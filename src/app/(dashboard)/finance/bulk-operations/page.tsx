import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getBulkStudentsAction } from '@/actions/bulk-operations.actions'
import { BulkOperationsClient } from './BulkOperationsClient'
import { Toaster } from 'react-hot-toast'
import { cookies } from 'next/headers'

export const metadata = { title: 'Bulk Operations' }

export default async function BulkOperationsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staffData } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!staffData || !['Admin', 'Accountant'].includes(staffData.role)) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <p className="text-lg font-bold text-red-600">Access Denied</p>
          <p className="text-sm text-slate-500 mt-1">Only Admins and Accountants can access Bulk Operations.</p>
        </div>
      </div>
    )
  }

  const cookieStore = await cookies()
  const cookieYearId = cookieStore.get('academic_year_id')?.value || null

  const [{ students, yearId: resolvedYearId, error }, classesRes, yearsRes] = await Promise.all([
    getBulkStudentsAction(),
    supabase.from('classes').select('id, grade_level, section').order('grade_level'),
    supabase.from('academic_years').select('id, name, is_active').eq('is_active', true).order('start_date', { ascending: false }),
  ])

  if (error === 'No Academic Year selected. Please select one from the sidebar.') {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <p className="text-lg font-bold text-amber-600">No Academic Year Selected</p>
          <p className="text-sm text-slate-500 mt-1">Please select an Academic Year from the sidebar first.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <BulkOperationsClient
        initialStudents={students}
        classes={classesRes.data || []}
        academicYears={yearsRes.data || []}
        initialYearId={resolvedYearId || cookieYearId}
      />
    </>
  )
}
