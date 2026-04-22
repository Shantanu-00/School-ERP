import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { addFeeConfiguration } from '@/actions/settings.action'
import { Plus, Filter, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function FeeConfigsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams;
  const filterYearId = (resolvedSearchParams.year_id as string) || '';

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staffData } = await supabase.from('staff').select('role').eq('auth_id', user.id).maybeSingle()
  if (staffData?.role !== 'Admin') redirect('/dashboard')

  const { data: academicYears } = await supabase.from('academic_years').select('*').order('start_date', { ascending: false })
  const { data: classes } = await supabase.from('classes').select('*').order('grade_level', { ascending: true }).order('section', { ascending: true })

  let feeConfigsQuery = supabase.from('fee_configurations').select(`*, academic_years(name), classes(grade_level, section)`).order('created_at', { ascending: false })
  if (filterYearId) feeConfigsQuery = feeConfigsQuery.eq('academic_year_id', filterYearId)
  const { data: feeConfigs } = await feeConfigsQuery

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 p-4">
      <Link href="/settings" className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 w-fit mb-4">
        <ArrowLeft size={16} /> Back to Settings
      </Link>
      
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Fee Configurations</h1>
        <p className="text-slate-500 text-sm mt-1">Set up fee structures based on class, gender, and course stream.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-fit">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Set Fee Configuration</h2>
          <form action={async (formData) => {
            'use server';
            await addFeeConfiguration(formData);
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
              <select name="academic_year_id" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition text-sm bg-white">
                <option value="">-- Select Year --</option>
                {academicYears?.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class & Section</label>
              <select name="class_id" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition text-sm bg-white">
                <option value="">-- Select Class --</option>
                {classes?.map(c => <option key={c.id} value={c.id}>{c.grade_level} - {c.section}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select name="gender" defaultValue="All" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition text-sm bg-white">
                  <option value="All">All</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stream</label>
                <select name="course_stream" defaultValue="General" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition text-sm bg-white">
                  <option value="General">General</option>
                  <option value="Science">Science</option>
                  <option value="Commerce">Commerce</option>
                  <option value="Arts">Arts</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base Fee Amount (₹)</label>
              <input type="number" step="0.01" name="base_fee_amount" required min="0" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition text-sm" placeholder="e.g. 50000" />
            </div>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium w-full hover:bg-blue-700 transition mt-4">
              <Plus size={16} /> Save Fee Strategy
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Fee Rules Grid</h3>
            <form className="flex items-center gap-2" action="/settings/fee-configs" method="GET">
              <Filter size={14} className="text-slate-500" />
              <select name="year_id" className="text-sm border-slate-300 rounded-md py-1 px-2 pr-8 text-slate-700 focus:ring-blue-500 focus:border-blue-500" defaultValue={filterYearId}>
                <option value="">All Years</option>
                {academicYears?.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
              <button type="submit" className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded-md font-medium text-slate-600 transition">Apply</button>
            </form>
          </div>
          <div className="overflow-x-auto basis-full">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Academic Year</th>
                  <th className="px-4 py-3 font-medium">Class / Section</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium text-right">Fee (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {feeConfigs?.map((fc: { id: string, academic_years: { name: string }, classes: { grade_level: string, section: string }, gender: string, course_stream: string, base_fee_amount: number | string }) => (
                  <tr key={fc.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-medium text-slate-800">{fc.academic_years?.name}</td>
                    <td className="px-4 py-3 text-slate-600">{fc.classes?.grade_level} - {fc.classes?.section}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{fc.gender === 'All' ? 'All Genders' : fc.gender} / {fc.course_stream}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 text-right">{Number(fc.base_fee_amount).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
                {feeConfigs?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">{filterYearId ? 'No configs for this year.' : 'No configs added.'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
