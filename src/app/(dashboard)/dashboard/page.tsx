import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { resolveAcademicYear, getDashboardStudentData, getAllFormerStudentsData, getDashboardStaffData, getDashboardExpenseData, getFeeLogs, getPocketMoneyLogs, getCashflowData } from '@/actions/dashboard.actions'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: staffData } = await supabase
    .from('staff')
    .select('role, name')
    .eq('auth_id', user.id)
    .maybeSingle()

  const userRole = staffData?.role ?? 'Teacher'
  const userName = staffData?.name ?? 'User'

  const { resolvedId, current, allYears } = await resolveAcademicYear()

  if (!resolvedId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">No academic year configured. Please set one in Settings.</p>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]

  const [studentData, formerData, payrollData, expenseData, feeLogs, pocketMoneyLogs, cashflowData] = await Promise.all([
    getDashboardStudentData(resolvedId),
    getAllFormerStudentsData(),
    getDashboardStaffData('current'),
    getDashboardExpenseData(resolvedId),
    getFeeLogs(today, today, 0, 10),
    getPocketMoneyLogs(today, today, 0, 10),
    getCashflowData(today, today, 0, 20),
  ])

  return (
    <DashboardClient
      academicYear={{
        id: resolvedId,
        name: current?.name || '',
        startDate: current?.start_date || '',
        endDate: current?.end_date || '',
      }}
      allYears={allYears.map(y => ({ id: y.id, name: y.name, isActive: y.is_active }))}
      studentData={studentData.data}
      formerData={formerData.data}
      staffData={payrollData.data}
      expenseData={expenseData.data}
      initialFeeLogs={feeLogs.data || []}
      initialFeeLogsHasMore={feeLogs.hasMore || false}
      initialPocketMoneyLogs={pocketMoneyLogs.data || []}
      initialPocketMoneyLogsHasMore={pocketMoneyLogs.hasMore || false}
      initialCashflow={cashflowData.data}
      userRole={userRole as 'Admin' | 'Accountant' | 'Teacher'}
      userName={userName}
    />
  )
}
