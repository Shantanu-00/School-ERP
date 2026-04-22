import { addStudent } from '@/actions/student.actions'
import { NewStudentForm } from './NewStudentForm'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function NewStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const resolvedParams = await searchParams
  const errorMessage = resolvedParams?.error?.trim()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (staff?.role !== 'Admin' && staff?.role !== 'Accountant') {
    redirect('/students')
  }

  // Fetch only ACTIVE academic years as per your constraint
  const { data: activeYears } = await supabase
    .from('academic_years')
    .select('id, name')
    .eq('is_active', true)
    
  if (!activeYears || activeYears.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 text-center py-12">
        <h1 className="text-2xl font-bold text-slate-900">No Active Academic Year</h1>
        <p className="text-slate-500">You must have an active academic year to enroll a new student.</p>
        <Link href="/settings" className="text-blue-600 block mt-4 hover:underline">Go to Settings to create one</Link>
      </div>
    )
  }

  const { data: classes } = await supabase
    .from('classes')
    .select('id, grade_level, section')
    .order('grade_level', { ascending: true })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add & Enroll Student</h1>
          <p className="text-slate-500 text-sm mt-1">Create a permanent record and enroll them for an active academic year.</p>
        </div>
        <Link 
          href="/students" 
          className="flex items-center text-slate-500 hover:text-slate-700 text-sm font-medium"
        >
          &larr; Back to Directory
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {errorMessage ? (
          <div className="mx-6 mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-8 sm:mt-8">
            {errorMessage}
          </div>
        ) : null}
        <NewStudentForm 
          activeYears={activeYears} 
          classes={classes || []} 
          addStudentAction={addStudent} 
        />
      </div>
    </div>
  )
}