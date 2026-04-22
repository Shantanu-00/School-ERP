import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { addClass } from '@/actions/settings.action'
import { Plus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function ClassesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staffData } = await supabase.from('staff').select('role').eq('auth_id', user.id).maybeSingle()
  if (staffData?.role !== 'Admin') redirect('/dashboard')

  const { data: classes } = await supabase.from('classes').select('*').order('grade_level', { ascending: true }).order('section', { ascending: true })

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 p-4">
      <Link href="/settings" className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 w-fit mb-4">
        <ArrowLeft size={16} /> Back to Settings
      </Link>
      
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Classes Master</h1>
        <p className="text-slate-500 text-sm mt-1">Configure grade levels and sections for the entire school.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-fit">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Add New Class</h2>
          <form action={async (formData) => {
            'use server';
            await addClass(formData);
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
              <input type="text" name="grade_level" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition text-sm" placeholder="e.g. Grade 10" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
              <input type="text" name="section" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition text-sm" placeholder="e.g. A" />
            </div>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium w-full hover:bg-blue-700 transition mt-4">
              <Plus size={16} /> Add Class
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-semibold text-slate-800">Master Class List</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 max-h-125 overflow-y-auto">
            {classes?.map((cls) => (
              <div key={cls.id} className="border border-slate-200 rounded-lg p-4 flex items-center justify-center bg-slate-50 hover:bg-white transition shadow-sm">
                <p className="font-semibold text-slate-800">{cls.grade_level} - {cls.section}</p>
              </div>
            ))}
            {classes?.length === 0 && (
              <div className="col-span-full p-8 text-center text-slate-500 text-sm">No classes configured yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
