import { updateStudent } from '@/actions/student.actions'
import EditStudentForm from './EditStudentForm'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'

export default async function EditStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const resolvedParams = await params
  const studentId = resolvedParams.id
  
  const resolvedSearchParams = await searchParams
  const errorMessage = resolvedSearchParams?.error?.trim()

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

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select(`
      *,
      student_enrollments (
        id,
        roll_number,
        class_id,
        academic_year_id,
        discount_type,
        discount_value,
        discount_mode,
        fee_invoices (status)
      )
    `)
    .eq('id', studentId)
    .single()

  if (studentError || !student) {
    notFound()
  }

  // Active Enrollment -> we want to allow editing the current active one, but usually editing a student edits their general data. If we want to edit their enrollment, we need the active year's enrollment.
  const globalActiveYearId = activeYears.find((y: any) => y.is_active)?.id || activeYears[0]?.id
  // Or grab the latest enrollment or by a selected year. For simplicity, just grab the one for the most recently active year in 'activeYears'
  const activeEnrollment = student.student_enrollments?.find((e: any) => e.academic_year_id === globalActiveYearId) || student.student_enrollments?.[0] || null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit Student</h1>
          <p className="text-slate-500 text-sm mt-1">Update permanent records and enrollment details.</p>
        </div>
        <Link 
          href={`/students/${studentId}`} 
          className="flex items-center text-slate-500 hover:text-slate-700 text-sm font-medium"
        >
          &larr; Back to Profile
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {errorMessage ? (
          <div className="mx-6 mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-8 sm:mt-8">
            {errorMessage}
          </div>
        ) : null}
        <EditStudentForm 
          activeYears={activeYears} 
          classes={classes || []} 
          student={student}
          activeEnrollment={activeEnrollment}
          updateStudentAction={updateStudent} 
        />
      </div>
    </div>
  )
}