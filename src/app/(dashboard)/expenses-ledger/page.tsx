import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  getExpenseBills,
  getOtherIncome,
  getExpenseLedgerSummary,
  getLoans,
} from '@/actions/expenses.actions'
import { ExpenseLedgerClient } from './ExpenseLedgerClient'

export default async function ExpenseLedgerPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staffData } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle()

  const userRole = staffData?.role ?? 'Teacher'
  if (!['Admin', 'Accountant'].includes(userRole)) {
    redirect('/dashboard')
  }

  const currentYearId = cookieStore.get('academic_year_id')?.value

  const { data: academicYears } = await supabase
    .from('academic_years')
    .select('id, name, is_active')
    .order('start_date', { ascending: false })

  const activeYear = academicYears?.find(y => y.is_active) ?? academicYears?.[0]
  const resolvedYearId = currentYearId || activeYear?.id || ''

  if (!resolvedYearId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">No academic year configured. Please set one in Settings.</p>
      </div>
    )
  }

  const [
    { data: bills },
    { data: otherIncome },
    { data: loans },
    summary,
  ] = await Promise.all([
    getExpenseBills(resolvedYearId),
    getOtherIncome(resolvedYearId),
    getLoans(resolvedYearId),
    getExpenseLedgerSummary(resolvedYearId),
  ])

  const currentYear = academicYears?.find(y => y.id === resolvedYearId)

  return (
    <ExpenseLedgerClient
      bills={bills ?? []}
      otherIncome={otherIncome ?? []}
      loans={loans ?? []}
      totalExpenses={summary.totalExpenses}
      totalCapital={summary.totalCapital}
      academicYearId={resolvedYearId}
      academicYearName={currentYear?.name ?? ''}
      userRole={userRole as 'Admin' | 'Accountant'}
    />
  )
}
