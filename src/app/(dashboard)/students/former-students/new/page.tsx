import { addFormerStudent } from '@/actions/student.actions'
import { AddFormerStudentForm } from './AddFormerStudentForm'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AddFormerStudentPage({
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
    redirect('/students/former-students')
  }

  // All academic years already in the system
  const { data: dbYears } = await supabase
    .from('academic_years')
    .select('id, name, start_date, end_date, is_active')
    .order('start_date', { ascending: false })

  // Generate historical year names 2008-2009 → current year, then filter out names
  // already present in the DB so the two groups never duplicate.
  const dbYearNames = new Set((dbYears || []).map((y: any) => y.name.trim()))
  const currentYear = new Date().getFullYear()
  // Go up to currentYear-currentYear+1 to cover schools that start in April of current year
  const historicYears: string[] = []
  for (let start = 2008; start <= currentYear; start++) {
    const name = `${start}-${start + 1}`
    if (!dbYearNames.has(name)) historicYears.push(name)
  }
  // Most recent first
  historicYears.reverse()

  const { data: classes } = await supabase
    .from('classes')
    .select('id, grade_level, section')
    .order('grade_level', { ascending: true })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add Former Student</h1>
          <p className="text-slate-500 text-sm mt-1">
            Create a historical record for an Alumni or Dropout with their last known enrollment details.
          </p>
        </div>
        <Link
          href="/students/former-students"
          className="flex items-center text-slate-500 hover:text-slate-700 text-sm font-medium"
        >
          &larr; Back to Former Students
        </Link>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <AddFormerStudentForm
        dbYears={dbYears || []}
        historicYearNames={historicYears}
        classes={classes || []}
        addFormerStudentAction={addFormerStudent}
      />
    </div>
  )
}
