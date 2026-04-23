import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPayrollForMonth } from '@/actions/payroll.actions'
import PayrollClient from './PayrollClient'
import { Toaster } from 'react-hot-toast'

function currentMonthYear() {
  const d = new Date()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getMonth()]}-${d.getFullYear()}`
}

export default async function StaffPayrollPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: staffData } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle()

  const userRole = staffData?.role
  if (userRole !== 'Admin' && userRole !== 'Accountant') {
    redirect('/students')
  }

  const month = currentMonthYear()
  const { teachers, payrollRecords, error } = await getPayrollForMonth(month)

  if (error) {
    return (
      <div className="p-6 text-red-600 text-sm">
        Error loading payroll data: {error}
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-right" />
      <PayrollClient
        initialTeachers={teachers}
        initialRecords={payrollRecords}
        initialMonth={month}
        userRole={userRole as 'Admin' | 'Accountant'}
      />
    </>
  )
}
