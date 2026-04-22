import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { addAcademicYear } from '@/actions/settings.action'
import { Plus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { ToggleYearButton } from './ToggleYearButton'

export default async function AcademicYearsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staffData } = await supabase.from('staff').select('role').eq('auth_id', user.id).maybeSingle()
  if (staffData?.role !== 'Admin') redirect('/settings')

  const { data: academicYears } = await supabase
    .from('academic_years')
    .select('*')
    .order('start_date', { ascending: false })

  const activeCount = academicYears?.filter((y) => y.is_active).length ?? 0

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 p-4">
      <Link href="/settings" className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 w-fit mb-4">
        <ArrowLeft size={16} /> Back to Settings
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Academic Years</h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage academic sessions, start/end dates, and active status.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Create form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-fit">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Start New Academic Year</h2>
          <form
            action={async (formData) => {
              'use server'
              await addAcademicYear(formData)
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Session Name</label>
              <input
                type="text"
                name="name"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition text-sm"
                placeholder="e.g. 2025-2026"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  name="start_date"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  name="end_date"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium w-full hover:bg-blue-700 transition mt-4"
            >
              <Plus size={16} /> Create Academic Session
            </button>
          </form>
        </div>

        {/* Year list */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Existing Academic Years</h3>
            {activeCount > 0 && (
              <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-full">
                {activeCount} active
              </span>
            )}
          </div>

          {activeCount > 1 && (
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700 font-medium">
              ⚠️ Multiple years are active. Typically only one year should be active at a time.
            </div>
          )}

          <div className="divide-y divide-slate-100 max-h-120 overflow-y-auto">
            {academicYears?.map((year) => (
              <div
                key={year.id}
                className="p-4 flex items-center justify-between hover:bg-slate-50 transition gap-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">{year.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(year.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' – '}
                    {new Date(year.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="shrink-0">
                  <ToggleYearButton yearId={year.id} isActive={year.is_active} />
                </div>
              </div>
            ))}
            {!academicYears?.length && (
              <div className="p-8 text-center text-slate-500 text-sm">
                No academic sessions configured yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
