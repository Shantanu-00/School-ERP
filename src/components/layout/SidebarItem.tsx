import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { YearSelector } from './YearSelector'

export async function Sidebar() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const currentYearId = cookieStore.get('academic_year_id')?.value

  // Fetch available academic years for the dropdown
  const { data: academicYears } = await supabase
    .from('academic_years')
    .select('id, name')
    .order('start_date', { ascending: false })

  const userRole = 'Admin' 

  const navLinks = [
    { name: 'Dashboard', href: '/dashboard', roles: ['Admin', 'Accountant', 'Teacher'] },
    { name: 'Active Students', href: '/students', roles: ['Admin', 'Accountant', 'Teacher'] },
    { name: 'Alumni', href: '/students/alumni', roles: ['Admin', 'Accountant', 'Teacher'] },
    { name: 'Fee Invoices', href: '/finance/invoices', roles: ['Admin', 'Accountant'] },
    { name: 'Staff Payroll', href: '/staff/payroll', roles: ['Admin', 'Accountant'] },
  ]

  return (
    <aside className="w-64 bg-white border-r h-screen flex flex-col fixed left-0 top-0">
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold text-gray-800">EduERP</h2>
      </div>

      <YearSelector 
        years={academicYears || []} 
        currentYearId={currentYearId} 
      />

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navLinks
          .filter(link => link.roles.includes(userRole))
          .map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors"
            >
              {link.name}
            </Link>
          ))}
      </nav>
    </aside>
  )
}