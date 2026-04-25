import { getStudents } from '@/actions/student.actions'
import { SearchInput } from '@/components/ui/SearchInput'
import { StatusFilter } from '@/components/ui/StatusFilter'
import { ClassFilter } from '@/components/ui/ClassFilter'
import { FinanceFilters } from '@/components/ui/FinanceFilters'
import { RecordPaymentModal } from '@/components/features/students/RecordPaymentModal'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; page?: string; status?: string; class_id?: string; sortBy?: string; sortOrder?: 'asc' | 'desc'; discount?: string; feesStatus?: string }>
}) {
  const resolvedParams = await searchParams
  const query = resolvedParams?.query || ''
  const currentPage = Number(resolvedParams?.page) || 1
  const status = resolvedParams?.status || 'Active'
  const class_id = resolvedParams?.class_id || 'All'
  const sortBy = resolvedParams?.sortBy || 'first_name'
  const sortOrder = resolvedParams?.sortOrder || 'asc'
  const discount = resolvedParams?.discount || 'All'
  const feesStatus = resolvedParams?.feesStatus || 'All'
  const supabase = await createClient()

  // Get the most recent active year (used as the single "current" year for UI status display)
  const { data: sysAcademicYears } = await supabase
    .from('academic_years')
    .select('id, is_active, start_date')
    .order('start_date', { ascending: false })
  
  const activeAcademicYears = (sysAcademicYears || []).filter((y: any) => y.is_active)
  const activeAcademicYearIds = new Set(activeAcademicYears.map((y: any) => y.id))
  const globalActiveYearId = activeAcademicYears[0]?.id
  const { students, error } = await getStudents({ 
    query, 
    page: currentPage, 
    status,
    class_id,
    sortBy,
    sortOrder,
    discount,
    feesStatus
  })

  const { data: { user } } = await supabase.auth.getUser()

  const { data: classes } = await supabase
    .from('classes')
    .select('id, grade_level, section')
    .order('grade_level', { ascending: true })

  let userRole = 'Teacher'
  if (user) {
    const { data: staff } = await supabase
      .from('staff')
      .select('role')
      .eq('auth_id', user.id)
      .maybeSingle()
    if (staff?.role) userRole = staff.role
  }

  const isTeacher = userRole === 'Teacher'
  const isAccountant = userRole === 'Accountant'
  const isAdmin = userRole === 'Admin'
  const canViewFees = isAdmin || isAccountant
  const canAddStudent = isAdmin || isAccountant

  if (error && error !== "No Academic Year Selected") {
    // Only return error if it's a real failure, else show the academic year message below.
  }

  if (error === "No Academic Year Selected") {
    return (
      <div className="p-6 text-center text-red-500">
        <h2 className="text-lg font-semibold">Please select an Academic Year from the Sidebar.</h2>
      </div>
    )
  }

  const latestEnrollmentYearByStudent = new Map<string, string>()
  const studentsOnPageIds = (students || []).map((s: any) => s.id).filter(Boolean)

  if (studentsOnPageIds.length > 0) {
    const { data: allStudentEnrollments } = await supabase
      .from('student_enrollments')
      .select('student_id, academic_years(id, start_date)')
      .in('student_id', studentsOnPageIds)

    const latestEnrollmentTsByStudent = new Map<string, number>()

    for (const enrollment of allStudentEnrollments || []) {
      const studentId = enrollment.student_id as string | undefined
      const yearData = Array.isArray((enrollment as any).academic_years)
        ? (enrollment as any).academic_years[0]
        : (enrollment as any).academic_years

      const yearId = yearData?.id as string | undefined
      if (!studentId || !yearId) continue

      const parsedTs = yearData?.start_date ? Date.parse(yearData.start_date) : Number.NaN
      const enrollmentTs = Number.isFinite(parsedTs) ? parsedTs : Number.NEGATIVE_INFINITY
      const currentLatest = latestEnrollmentTsByStudent.get(studentId)

      if (currentLatest === undefined || enrollmentTs > currentLatest) {
        latestEnrollmentTsByStudent.set(studentId, enrollmentTs)
        latestEnrollmentYearByStudent.set(studentId, yearId)
      }
    }
  }

  // Calculate stats for finance
  const getPocketMoneyBal = (transactions: any[]) => {
    if (!transactions) return 0;
    return transactions.reduce((acc, tx) => acc + (tx.transaction_type === 'CREDIT' ? tx.amount : -tx.amount), 0)
  }

  // Only tuition fee invoices (title starts with "Tuition Fee |") count toward the
  // displayed fee status. Manually-issued invoices (field trips, etc.) are excluded.
  const isTuitionFeeInvoice = (inv: any) =>
    typeof inv.invoice_title === 'string' && inv.invoice_title.startsWith('Tuition Fee |')

  const getTotalDues = (invoices: any[]) => {
    if (!invoices) return { paid: 0, total: 0, pending: 0, hasTuitionInvoice: false };
    const tuition = invoices.filter(isTuitionFeeInvoice)
    return tuition.reduce((acc, inv) => {
      const paid = inv.fee_payments?.reduce((pAcc: number, p: any) => pAcc + p.amount_paid, 0) || 0
      return {
        paid: acc.paid + paid,
        total: acc.total + inv.total_amount,
        pending: acc.pending + (inv.total_amount - paid),
        hasTuitionInvoice: true,
      }
    }, { paid: 0, total: 0, pending: 0, hasTuitionInvoice: tuition.length > 0 })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="text-sm text-gray-500">Manage all student records and enrollment.</p>
        </div>
        {canAddStudent && (
          <Link 
            href="/students/new" 
            className="bg-blue-600 text-white px-4 py-2 text-sm font-medium rounded-md hover:bg-blue-700 transition"
          >
            + Add Student
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <SearchInput placeholder="Search name, admission no..." />
        <ClassFilter classes={classes || []} />
        <StatusFilter />
        
        {/* Sort options & Admin / Accountant additional filters */}
        <FinanceFilters 
          sortBy={sortBy}
          sortOrder={sortOrder}
          discount={discount}
          feesStatus={feesStatus}
          canViewFees={canViewFees}
        />
      </div>

      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {isTeacher && <th className="p-4 font-medium text-gray-500">Roll No</th>}
              <th className="p-4 font-medium text-gray-500">Student</th>
              <th className="p-4 font-medium text-gray-500 whitespace-nowrap">
                Class
                {students?.length > 0 && (() => {
                  const firstEnrollment = students[0].student_enrollments?.[0];
                  const ayData = firstEnrollment?.academic_years;
                  const academicYear = Array.isArray(ayData) ? ayData[0] : ayData;
                  if (!academicYear) return null;
                  
                  const isCurrent = academicYear.id === globalActiveYearId;

                  return (
                    <div className="flex flex-col items-start gap-1 mt-1">
                      <span className="text-[11px] text-gray-500 font-semibold">{academicYear.name}</span>
                      {isCurrent ? (
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded flex items-center font-bold tracking-widest uppercase" title="Displaying current academic year data">
                          Current Year
                        </span>
                      ) : (
                        <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded flex items-center font-bold tracking-widest uppercase shadow-sm" title="Warning: Displaying historical data from a past session">
                          Historical Data
                        </span>
                      )}
                    </div>
                  );
                })()}
              </th>
              
              {isTeacher && (
                <>
                  <th className="p-4 font-medium text-gray-500">Parent Contact</th>
                  <th className="p-4 font-medium text-gray-500">Status</th>
                </>
              )}

              {(isAccountant || isAdmin) && (() => {
                const _ay0 = students?.[0]?.student_enrollments?.[0]?.academic_years as any;
                const yearName = students?.length > 0 ? (Array.isArray(_ay0) ? _ay0[0]?.name : _ay0?.name) : 'Year';
                const isCurrent = students?.length > 0 && ((Array.isArray(_ay0) ? _ay0[0]?.id : _ay0?.id) === globalActiveYearId);
                
                return (
                  <>
                    <th className="p-4 font-medium text-gray-500 whitespace-nowrap">
                      {isCurrent ? 'Current Fees' : `Fees [${yearName || 'Selected'}]`}
                    </th>
                    <th className="p-4 font-medium text-gray-500 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span>Past Arrear</span>
                        <span className="text-[10px] text-gray-400 font-normal">
                          {isCurrent ? 'Before Current' : `Before ${yearName || 'Selected'}`}
                        </span>
                      </div>
                    </th>
                    <th className="p-4 font-medium text-gray-500 whitespace-nowrap">Total Actionable</th>
                    <th className="p-4 font-medium text-gray-500 whitespace-nowrap">Wallet</th>
                  </>
                )
              })()}

              <th className="p-4 font-medium text-gray-500 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students?.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">No students found.</td>
              </tr>
            ) : (
              students?.map((student: any) => {
                const enrollment = student.student_enrollments[0];
                const grade = enrollment?.classes?.grade_level;
                const section = enrollment?.classes?.section;
                // Handle both single object and array format from supabase
                const ayData = enrollment?.academic_years;
                const academicYear = Array.isArray(ayData) ? ayData[0] : ayData;
                
                const dues = getTotalDues(enrollment?.fee_invoices);
                const pastDues = student.previousDues || 0;
                const totalAction = student.absoluteTotalDues || 0;
                const wallet = getPocketMoneyBal(student.pocket_money_transactions);
                
                const viewedYearId = academicYear?.id as string | undefined;
                const latestEnrollmentYearId = latestEnrollmentYearByStudent.get(student.id);
                const isLatestEnrollment = Boolean(viewedYearId && latestEnrollmentYearId === viewedYearId);
                const isViewedYearActive = Boolean(viewedYearId && activeAcademicYearIds.has(viewedYearId));
                const shouldShowAsCurrentActive =
                  isViewedYearActive &&
                  (activeAcademicYears.length === 1 || viewedYearId === globalActiveYearId);

                let displayStatus = student.status || 'Active';

                if (student.status === 'Active') {
                    if (shouldShowAsCurrentActive) {
                        displayStatus = student.isRepeater ? 'Active-Repeater' : 'Active';
                    } else {
                        displayStatus = 'Active-Old';
                    }
                } else if (student.status === 'Dropout') {
                    displayStatus = !latestEnrollmentYearId || isLatestEnrollment ? 'Dropout' : 'Active-Dropout';
                } else if (student.status === 'Alumni') {
                    displayStatus = !latestEnrollmentYearId || isLatestEnrollment ? 'Alumni' : 'Active-Alumni';
                }

                const getStatusBadge = (status: string) => {
                  let bg = 'bg-gray-100 text-gray-700 border-gray-200';
                  if (status === 'Active') bg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  else if (status === 'Active-Repeater') bg = 'bg-violet-50 text-violet-700 border-violet-200';
                  else if (status === 'Active-Old') bg = 'bg-slate-50 text-slate-600 border-slate-200';
                  else if (status === 'Dropout') bg = 'bg-rose-50 text-rose-700 border-rose-200';
                  else if (status === 'Active-Dropout') bg = 'bg-amber-50 text-amber-700 border-amber-200';
                  else if (status === 'Alumni') bg = 'bg-blue-50 text-blue-700 border-blue-200';
                  else if (status === 'Active-Alumni') bg = 'bg-sky-50 text-sky-700 border-sky-200';
                  
                  return (
                    <span className={`px-1.5 py-0.5 mt-1 rounded text-[9px] font-bold shadow-sm uppercase tracking-wider border w-max ${bg}`} title="Student System Status">
                      {status}
                    </span>
                  );
                }

                return (
                  <tr key={student.id} className="border-b hover:bg-gray-50 transition">
                    {isTeacher && <td className="p-4 text-gray-600 align-middle">{enrollment?.roll_number}</td>}
                    
                    <td className="p-4 align-middle w-1/5">
                      <div className="flex flex-col items-start gap-0.5 justify-center">
                        <Link href={`/students/${student.id}`} className="font-bold text-[16px] leading-tight text-gray-900 hover:text-blue-600 transition-colors">
                          {student.first_name} {student.last_name}
                        </Link>
                        {(isAdmin || isAccountant) && student.admission_number && (
                          <span className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">
                            #{student.admission_number}
                          </span>
                        )}
                        {(isAdmin || isAccountant) && enrollment?.discount_type && enrollment.discount_type !== 'None' && (
                          <span className="px-1.5 py-0.5 mt-1 rounded bg-violet-50 text-violet-700 text-[9px] font-bold uppercase tracking-wider border border-violet-100 w-max cursor-help shadow-sm" title="Discount applied on annual fee">
                            {enrollment.discount_type === 'Management Discount' ? 'Mgmt' : enrollment.discount_type} • {enrollment.discount_mode === 'Percentage' ? `${Number(enrollment.discount_value || 0)}%` : `₹${Number(enrollment.discount_value || 0).toLocaleString('en-IN')}`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-gray-600 align-middle">
                      <div className="flex flex-col items-start justify-center">
                        <span className="font-medium text-slate-800 leading-tight">{grade} - {section}</span>
                        {(isAdmin || isAccountant) && getStatusBadge(displayStatus)}
                      </div>
                    </td>

                    {/* Teacher Specific */}
                    {isTeacher && (
                      <>
                        <td className="p-4 text-gray-600 align-middle">{student.primary_contact_number || 'N/A'}</td>
                        <td className="p-4 align-middle">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${student.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {student.status}
                          </span>
                        </td>
                      </>
                    )}

                    {/* Finance Specific (Accountant & Admin) */}
                    {(isAccountant || isAdmin) && (
                      <>
                        <td className="p-4 align-middle" title="View Transaction History">
                          <Link href={`/students/${student.id}/fees`} className="hover:bg-gray-50 p-2 -ml-2 rounded-lg transition-colors flex flex-col justify-center h-full gap-1 border border-transparent hover:border-gray-200">
                            {!dues.hasTuitionInvoice ? (
                              <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 mt-1 rounded-md text-[10px] w-max font-bold tracking-widest uppercase shadow-sm">
                                NO INVOICE
                              </span>
                            ) : dues.pending > 0 ? (
                              <>
                                <span className="text-gray-900 font-bold tracking-tight text-[13px]">
                                  ₹{dues.paid.toLocaleString('en-IN')} <span className="text-gray-400 font-medium text-[11px]">/ ₹{dues.total.toLocaleString('en-IN')}</span>
                                </span>
                                <span className="text-[11px] items-center flex gap-1.5 text-red-600 font-semibold tracking-wide bg-red-50 px-2 py-0.5 rounded-md w-max border border-red-100">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                  Left: ₹{dues.pending.toLocaleString('en-IN')}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-gray-900 font-bold tracking-tight text-[13px]">
                                  ₹{dues.paid.toLocaleString('en-IN')} <span className="text-gray-400 font-medium text-[11px]">/ ₹{dues.total.toLocaleString('en-IN')}</span>
                                </span>
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md text-[10px] w-max font-bold tracking-widest uppercase shadow-sm">
                                  PAID
                                </span>
                              </>
                            )}
                          </Link>
                        </td>
                        <td className="p-4 align-middle" title="View Transaction History">
                          <Link href={`/students/${student.id}/fees`} className="hover:bg-gray-50 p-2 -ml-2 rounded-lg transition-colors flex flex-col justify-center h-full border border-transparent hover:border-gray-200">
                            {pastDues > 0 ? (
                              <span className="text-rose-600 font-bold tracking-tight text-[14px]">₹{pastDues.toLocaleString('en-IN')}</span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-widest uppercase w-max">
                                PAID
                              </span>
                            )}
                          </Link>
                        </td>
                        <td className="p-4 align-middle" title="Total Pending Dues Across All Time">
                          <Link href={`/students/${student.id}/fees`} className="hover:bg-gray-50 p-2 -ml-2 rounded-lg transition-colors flex flex-col justify-center h-full border border-transparent hover:border-gray-200">
                            {totalAction > 0 ? (
                              <span className="text-red-600 font-extrabold tracking-tight text-[15px]">₹{totalAction.toLocaleString('en-IN')}</span>
                            ) : (
                              <span className="text-gray-400 font-semibold tracking-tight text-[14px]">₹0</span>
                            )}
                          </Link>
                        </td>
                        <td className="p-4 align-middle" title="View Wallet History">
                          <Link href={`/students/${student.id}/pocket-money`} className="hover:bg-gray-50 p-2 -ml-2 rounded-lg transition-colors flex flex-col justify-center h-full border border-transparent hover:border-gray-200">
                            <span className={`font-bold tracking-tight text-[15px] ${wallet > 300 ? 'text-emerald-600' : wallet >= 0 ? 'text-amber-500' : 'text-red-600'}`}>
                              ₹{wallet.toLocaleString('en-IN')}
                            </span>
                          </Link>
                        </td>
                      </>
                    )}

                    {/* Actions Column */}
                    <td className="p-4 text-center align-middle">
                      <div className="flex gap-2 justify-center">
                        {(isAccountant || isAdmin) ? (
                          <RecordPaymentModal studentId={student.id} variant="small" />
                        ) : (
                          <Link href={`/students/${student.id}`} className="text-sm border border-gray-300 px-3 py-1 rounded hover:bg-gray-50 font-medium text-gray-700">
                            View Profile
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
