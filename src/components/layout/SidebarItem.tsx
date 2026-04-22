import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { YearSelector } from './YearSelector'
import { logout } from '@/actions/auth.actions'
import { LayoutDashboard, Users, GraduationCap, CircleDollarSign, Settings } from 'lucide-react'

export async function Sidebar() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const currentYearId = cookieStore.get('academic_year_id')?.value

  // Fetch available academic years for the dropdown
  const { data: academicYears } = await supabase
    .from('academic_years')
    .select('id, name')
    .order('start_date', { ascending: false })

  // Fetch the logged-in user from Supabase session
  const { data: { user } } = await supabase.auth.getUser()

  let userRole = 'Teacher' // Fallback role for security
  if (user) {
    const { data: staffData } = await supabase
      .from('staff')
      .select('role')
      .eq('auth_id', user.id)
      .maybeSingle()
      
    if (staffData?.role) {
      userRole = staffData.role;
    }
  }

  const isAdmin = userRole === 'Admin'

  const navLinks = [
    { name: 'Dashboard', href: '/dashboard', roles: ['Admin', 'Accountant', 'Teacher'], icon: LayoutDashboard },
    { name: 'Students', href: '/students', roles: ['Admin', 'Accountant', 'Teacher'], icon: Users },
    { name: 'Former Students', href: '/students/former-students', roles: ['Admin', 'Accountant', 'Teacher'], icon: GraduationCap },
    { name: 'Staff Payroll', href: '/staff/payroll', roles: ['Admin', 'Accountant'], icon: CircleDollarSign },
    { name: 'System Settings', href: '/settings', roles: ['Admin'], icon: Settings },
  ]

  return (
    <div className="h-full bg-white flex flex-col w-full">
      <div className="p-4 border-b shrink-0 flex items-center justify-center group-data-[state=expanded]:justify-start mt-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-lg leading-none -mt-0.5">E</span>
        </div>
        <h2 className="ml-3 text-xl font-bold text-gray-800 whitespace-nowrap overflow-hidden hidden group-data-[state=expanded]:block">EduERP</h2>
      </div>

      <div className="shrink-0 overflow-hidden group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:h-0 transition-all duration-300">
        <YearSelector 
          years={academicYears || []} 
          currentYearId={currentYearId} 
          isAdmin={isAdmin}
        />
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-2 group-data-[state=collapsed]:px-2">
        {navLinks
          .filter(link => link.roles.includes(userRole))
          .map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.name}
                href={link.href}
                className="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors overflow-hidden whitespace-nowrap group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-0"
                title={link.name}
              >
                <Icon size={20} strokeWidth={2} className="shrink-0" />
                <span className="ml-3 hidden group-data-[state=expanded]:block">{link.name}</span>
              </Link>
            )
          })}
      </nav>

      {/* Logout Button Pinned to Bottom */}
      <div className="p-4 border-t shrink-0 group-data-[state=collapsed]:px-2">
        <form action={logout}>
          <button 
            type="submit" 
            title="Logout"
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center overflow-hidden whitespace-nowrap group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            <span className="ml-3 hidden group-data-[state=expanded]:block">Logout</span>
          </button>
        </form>
      </div>
    </div>
  )
}