import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Users, IndianRupee, ArrowUpRight } from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staffData } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (staffData?.role !== 'Admin') {
    redirect('/dashboard') // Or an "Unauthorized" page
  }

  const settingsCards = [
    {
      id: 'academic-years',
      title: 'Academic Years',
      description: 'Manage academic sessions, start/end dates, and active status.',
      icon: Calendar,
      href: '/settings/academic-years',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      id: 'classes',
      title: 'Classes',
      description: 'Configure grade levels and sections for the entire school.',
      icon: Users,
      href: '/settings/classes',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    },
    {
      id: 'fee-configs',
      title: 'Fee Configurations',
      description: 'Set up fee structures based on class, gender, and course stream.',
      icon: IndianRupee,
      href: '/settings/fee-configs',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      id: 'promotions',
      title: 'Promotion Wizard',
      description: 'Promote students to the next academic year systematically.',
      icon: ArrowUpRight,
      href: '/settings/promotions',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    }
  ]

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 p-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Configure global ERP variables and run major system operations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {settingsCards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.id} href={card.href} className="group">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-full flex flex-col hover:shadow-md hover:border-slate-300 transition-all cursor-pointer relative overflow-hidden">
                <div className={`w-12 h-12 rounded-lg ${card.bgColor} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
                  <Icon size={24} className={card.color} />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">{card.title}</h3>
                <p className="text-sm text-slate-500 grow">{card.description}</p>
                <div className="mt-4 text-blue-600 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                  Manage 
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
