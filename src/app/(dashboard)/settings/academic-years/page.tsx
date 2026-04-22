import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { addAcademicYear } from '@/actions/settings.action'
import { Plus, Check, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function AcademicYearsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staffData } = await supabase.from('staff').select('role').eq('auth_id', user.id).maybeSingle()
  if (staffData?.role !== 'Admin') redirect('/dashboard')

  const { data: academicYears } = await supabase.from('academic_years').select('*').order('start_date', { ascending: false })

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 p-4">
      <Link href="/settings" className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 w-fit mb-4">
        <ArrowLeft size={16} /> Back to Settings
      </Link>
      
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Academic Years</h1>
        <p className="text-slate-500 text-sm mt-1">Manage academic sessions, start/end dates, and active status.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-fit">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Start New Academic Year</h2>
          <form action={async (formData) => {
            'use server';
            await addAcademicYear(formData);
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Session Name</label>
              <input type="text" name="name" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition text-sm" placeholder="e.g. 2024-2025" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input type="date" name="start_date" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input type="date" name="end_date" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition text-sm" />
              </div>
            </div>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium w-full hover:bg-blue-700 transition mt-4">
              <Plus size={16} /> Create Academic Session
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-semibold text-slate-800">Existing Academic Years</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-125 overflow-y-auto">
            {academicYears?.map((year) => (
              <div key={year.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                <div>
                  <p className="font-medium text-slate-900">{year.name}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(year.start_date).toLocaleDateString()} - {new Date(year.end_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  {year.is_active ? (
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full flex items-center gap-1 border border-emerald-200">
                      <Check size={12} /> Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full cursor-default">
                      Inactive
                    </span>
                  )}
                </div>
              </div>
            ))}
            {academicYears?.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm">No academic sessions configured yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
