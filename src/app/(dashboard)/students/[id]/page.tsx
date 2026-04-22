import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { Wallet, FileText, GraduationCap, Calendar, User, Clock, ChevronLeft, MapPin, Users, Edit, IndianRupee, AlertCircle, CheckCircle, ChevronRight, Phone } from 'lucide-react'
import { RecordPaymentModal } from '@/components/features/students/RecordPaymentModal'
import { GenerateInvoiceButton } from '@/components/features/students/GenerateInvoiceButton'

export default async function StudentProfilePage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params
  const studentId = resolvedParams.id
  
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  let userRole = 'Teacher'
  if (user) {
    const { data: staff } = await supabase
      .from('staff')
      .select('role')
      .eq('auth_id', user.id)
      .maybeSingle()
    if (staff?.role) userRole = staff.role
  }
  const canViewFinancials = ['Admin', 'Accountant'].includes(userRole)

  const cookieStore = await cookies()
  const selectedYearId = cookieStore.get('academic_year_id')?.value

  const { data: student, error } = await supabase
    .from('students')
    .select(`
      id, admission_number, first_name, last_name, dob, status,
      primary_contact_number, secondary_contact_number, gender,
      blood_group, mother_tongue, social_category, minority_status,
      aadhaar_number, name_on_aadhaar, apaar_id,
      mother_full_name, father_full_name, guardian_name_and_relation, parent_aadhaar_number,
      date_of_admission, previous_school_attended, tc_number,
      current_address_line1, current_address_landmark, current_city_district, current_state, current_pincode,
      permanent_address_line1, permanent_address_landmark, permanent_city_district, permanent_state, permanent_pincode,
      is_permanent_same_as_current,
      student_enrollments (
        id,
        roll_number,
        classes (grade_level, section),
        academic_years (id, name, is_active)
      )
    `)
    .eq('id', studentId)
    .single()

  if (error || !student) {
    notFound()
  }

  // Get correct CURRENT year globally
  const { data: sysAcademicYears } = await supabase
    .from('academic_years')
    .select('id, is_active')
    .order('created_at', { ascending: false })
  const globalActiveYearId = sysAcademicYears?.find((y: any) => y.is_active)?.id

  // Find enrollment for specifically selected year, fallback to system active, or first available
  const activeEnrollment = student.student_enrollments?.find((e: any) => {
    const ay = Array.isArray(e.academic_years) ? e.academic_years[0] : e.academic_years;
    return ay && ay.id === selectedYearId;
  }) || student.student_enrollments?.find((e: any) => {
    const ay = Array.isArray(e.academic_years) ? e.academic_years[0] : e.academic_years;
    return ay && ay.id === globalActiveYearId;
  }) || student.student_enrollments?.[0]

  const ayData = (activeEnrollment as any)?.academic_years;
  const resolvedAy = Array.isArray(ayData) ? ayData[0] : ayData;
  const isPastYear = activeEnrollment && resolvedAy?.id !== globalActiveYearId && resolvedAy?.id === selectedYearId

  let shouldShowGenerateInvoiceButton = false
  if (canViewFinancials && activeEnrollment?.id) {
    const { data: existingInvoice } = await supabase
      .from('fee_invoices')
      .select('id')
      .eq('enrollment_id', activeEnrollment.id)
      .limit(1)
      .maybeSingle()

    shouldShowGenerateInvoiceButton = !existingInvoice
  }


  let pendingFeesCurrent = 0
  let pendingFeesPast = 0
  let pendingFeesTotal = 0
  let pocketMoneyBalance = 0
  let feeInvoices: any[] = []
  let pocketTransactions: any[] = []
  
  if (canViewFinancials) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [{ data: allEnrollments }, { data: pocketMoneyData }, { data: pocketTxData }] = await Promise.all([
      supabase
        .from('student_enrollments')
        .select(`id, academic_years(id, name)`)
        .eq('student_id', studentId),
        
      supabase
        .from('pocket_money_balances')
        .select('current_balance')
        .eq('student_id', studentId)
        .maybeSingle(),
        
      supabase
        .from('pocket_money_transactions')
        .select('id, amount, description, transaction_type, created_at, staff(name)')
        .eq('student_id', studentId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
    ])

    const enrollmentIds = allEnrollments?.map(e => e.id) || []
    
    let invoiceData: any[] = []
    
    // Fetch invoices by enrollment_id or student_id explicitly to count for arrears
    let invoiceQuery = supabase
      .from('fee_invoices')
      .select(`
        id, invoice_title, total_amount, status, due_date, created_at, enrollment_id, student_id,
        fee_payments(id, amount_paid, payment_date, payment_method, created_at, staff(name))
      `)
      .order('created_at', { ascending: false })

    if (enrollmentIds.length > 0) {
      invoiceQuery = invoiceQuery.or(`enrollment_id.in.(${enrollmentIds.join(',')}),student_id.eq.${studentId}`)
    } else {
      invoiceQuery = invoiceQuery.eq('student_id', studentId)
    }

    const { data: invs } = await invoiceQuery

    invoiceData = (invs || []).map((inv: any) => {
      const enr = allEnrollments?.find(e => e.id === inv.enrollment_id)
      const ayId = Array.isArray(enr?.academic_years) ? enr?.academic_years[0]?.id : (enr?.academic_years as any)?.id
      const ayName = Array.isArray(enr?.academic_years) ? enr?.academic_years[0]?.name : ((enr?.academic_years as any)?.name || 'Previous Arrears')
      return {
        ...inv,
        academic_year: ayName,
        academic_year_id: ayId || 'arrears'
      }
    })

    feeInvoices = invoiceData || []
    pocketTransactions = pocketTxData || []

    invoiceData.forEach((inv) => {
      const paid = inv.fee_payments?.reduce((pAcc: number, p: any) => pAcc + Number(p.amount_paid), 0) || 0
      const pending = Math.max(0, Number(inv.total_amount) - paid)
      
      pendingFeesTotal += pending
      
      if (inv.academic_year_id === globalActiveYearId) {
        pendingFeesCurrent += pending
      } else {
        pendingFeesPast += pending
      }
    })

    pocketMoneyBalance = pocketMoneyData?.current_balance || 0
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6 p-4 md:p-6">
      {/* Top Header: Back & Title */}
      <div className="flex flex-col sm:flex-row justify-between flex-wrap gap-4 items-start sm:items-center">
        <div className="flex items-center gap-3">
          <Link href="/students" className="p-2 border border-slate-200 text-slate-500 rounded-md hover:bg-slate-50 hover:text-slate-800 transition">
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Student Profile</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <Link 
            href={`/students/${studentId}/edit`}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg hover:bg-slate-50 font-medium text-sm transition shadow-sm"
          >
            <Edit size={16} />
            Edit Profile
          </Link>
          {canViewFinancials && (
            <>
              {shouldShowGenerateInvoiceButton && activeEnrollment?.id && (
                <GenerateInvoiceButton enrollmentId={activeEnrollment.id} />
              )}
              <RecordPaymentModal studentId={studentId} />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Main Profile Info Header */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row items-center md:items-start p-6 md:p-8 gap-6 md:gap-8">
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-slate-100 rounded-full flex items-center justify-center text-4xl shadow-inner border border-slate-200 text-slate-400 shrink-0">
              <User size={48} className="sm:w-16 sm:h-16" />
            </div>
            <div className="flex-1 text-center md:text-left w-full">
              <div className="flex flex-col md:flex-row items-center md:items-end justify-center md:justify-start gap-4 mb-4">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-0 mt-0 wrap-break-words">
                  {student.first_name} {student.last_name}
                </h2>
                <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
                  student.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                  student.status === 'Alumni' ? 'bg-blue-100 text-blue-800' : 
                  'bg-red-100 text-red-800'
                }`}>
                  {student.status || 'Unknown'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm text-slate-600 font-medium bg-slate-50 p-4 rounded-xl border border-slate-100 w-full mt-2">
                <span className="flex items-center justify-center md:justify-start gap-2"><GraduationCap size={16} className="text-slate-400 shrink-0"/> <span className="text-slate-500">Adm No:</span> <span className="text-slate-900 font-semibold">{student.admission_number || 'N/A'}</span></span>
                <span className="flex items-center justify-center md:justify-start gap-2"><Calendar size={16} className="text-slate-400 shrink-0"/> <span className="text-slate-500">DOB:</span> <span className="text-slate-900 font-semibold">{student.dob ? new Date(student.dob).toLocaleDateString() : 'N/A'}</span></span>
                <span className="flex items-center justify-center md:justify-start gap-2"><User size={16} className="text-slate-400 shrink-0"/> <span className="text-slate-500">Gender:</span>  <span className="text-slate-900 font-semibold">{student.gender || 'N/A'}</span></span>
                <span className="flex items-center justify-center md:justify-start gap-2"><Users size={16} className="text-slate-400 shrink-0"/> <span className="text-slate-500">Blood Group:</span> <span className="text-slate-900 font-semibold">{student.blood_group || 'N/A'}</span></span>
                <span className="flex items-center justify-center md:justify-start gap-2"><FileText size={16} className="text-slate-400 shrink-0"/> <span className="text-slate-500">Aadhaar:</span> <span className="text-slate-900 font-semibold">{student.aadhaar_number || 'Not Provided'}</span></span>
                <span className="flex items-center justify-center md:justify-start gap-2"><FileText size={16} className="text-slate-400 shrink-0"/> <span className="text-slate-500">APAAR:</span> <span className="text-slate-900 font-semibold">{student.apaar_id || 'Not Provided'}</span></span>
              </div>
            </div>
          </div>

          {canViewFinancials && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Outstanding Fees Card */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transform transition-all hover:shadow-md flex flex-col">
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <IndianRupee className="text-red-500 w-4 h-4" />
                        <h3 className="text-slate-500 text-xs font-bold tracking-widest uppercase">Pending Fees</h3>
                      </div>
                      <span className="text-3xl font-black text-slate-900 tracking-tight leading-none text-left">
                        ₹{pendingFeesTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 border shadow-sm ${pendingFeesTotal > 0 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                      {pendingFeesTotal > 0 ? (
                        <><AlertCircle size={12} /> Action Required</>
                      ) : (
                        <><CheckCircle size={12} /> All Cleared</>
                      )}
                    </span>
                  </div>
                  
                  <div className="w-full bg-slate-50 rounded-lg border border-slate-100 p-2.5 grid grid-cols-2 gap-3 mt-5">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Current Year</p>
                      <p className="text-xs font-semibold text-slate-800">₹{pendingFeesCurrent.toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Past Years</p>
                      <p className={`text-xs font-semibold ${pendingFeesPast > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        ₹{pendingFeesPast.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 py-2.5 px-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium flex items-center"><ChevronRight size={14} className="mr-1"/> Manage Payments</span>
                  <Link href={`/students/${studentId}/fees`} className="text-xs bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-100 font-medium transition">
                    View Fee History
                  </Link>
                </div>
              </div>

              {/* Pocket Money Card */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transform transition-all hover:shadow-md flex flex-col">
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Wallet className="text-blue-500 w-4 h-4" />
                        <h3 className="text-slate-500 text-xs font-bold tracking-widest uppercase">Pocket Money</h3>
                      </div>
                      <span className="text-3xl font-black text-slate-900 tracking-tight leading-none text-left">
                        ₹{pocketMoneyBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 border shadow-sm ${pocketMoneyBalance < 500 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                      {pocketMoneyBalance < 500 ? (
                        <><Clock size={12} /> Low Balance</>
                      ) : (
                        <><CheckCircle size={12} /> Healthy</>
                      )}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-50 py-2.5 px-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium flex items-center"><ChevronRight size={14} className="mr-1"/> Manage Pocket Money</span>
                  <Link href={`/students/${studentId}/pocket-money`} className="text-xs bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-100 font-medium transition">
                    View Ledger
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Personal & Demographic Info */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
              <User className="text-slate-400" size={20} />
              <h2 className="text-lg font-bold text-slate-800 m-0">Personal & Demographic Info</h2>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-8">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Name on Aadhaar</p>
                <p className="text-slate-800 font-medium">{student.name_on_aadhaar || 'Not Provided'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Mother Tongue</p>
                <p className="text-slate-800 font-medium">{student.mother_tongue || 'Not Provided'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Social Category</p>
                <p className="text-slate-800 font-medium">{student.social_category || 'Not Provided'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Minority Status</p>
                <p className="text-slate-800 font-medium">{student.minority_status || 'Not Provided'}</p>
              </div>
            </div>
          </div>

          {/* Parent & Contact Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
              <Users className="text-slate-400" size={20} />
              <h2 className="text-lg font-bold text-slate-800 m-0">Family & Contact Details</h2>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Father&apos;s Name</p>
                <p className="text-slate-800 font-medium">{student.father_full_name || 'Not Provided'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Mother&apos;s Name</p>
                <p className="text-slate-800 font-medium">{student.mother_full_name || 'Not Provided'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1"><span className="flex items-center gap-1.5"><Phone size={14} className="text-slate-400" /> Primary Contact</span></p>
                <p className="text-slate-800 font-medium">{student.primary_contact_number || 'Not Provided'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1"><span className="flex items-center gap-1.5"><Phone size={14} className="text-slate-400" /> Secondary Contact</span></p>
                <p className="text-slate-800 font-medium">{student.secondary_contact_number || 'Not Provided'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Guardian & Relation</p>
                <p className="text-slate-800 font-medium">{student.guardian_name_and_relation || 'Not Provided'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1"><span className="flex items-center gap-1.5"><FileText size={14} className="text-slate-400" /> Parent Aadhaar</span></p>
                <p className="text-slate-800 font-medium">{student.parent_aadhaar_number || 'Not Provided'}</p>
              </div>
            </div>
          </div>

          {/* Address Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
              <MapPin className="text-slate-400" size={20} />
              <h2 className="text-lg font-bold text-slate-800 m-0">Address Information</h2>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2 pb-1 border-b border-slate-100">Current Address</p>
                <div className="text-slate-800 font-medium text-sm leading-relaxed whitespace-pre-wrap">
                  {student.current_address_line1 ? (
                    <>
                      {student.current_address_line1}
                      {student.current_address_landmark && <br />}
                      {student.current_address_landmark && <span className="text-slate-500 text-xs">Landmark: {student.current_address_landmark}</span>}
                      <br />
                      {student.current_city_district}, {student.current_state} - {student.current_pincode}
                    </>
                  ) : 'Not Provided'}
                </div>
              </div>

              {!student.is_permanent_same_as_current ? (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2 pb-1 border-b border-slate-100">Permanent Address</p>
                  <div className="text-slate-800 font-medium text-sm leading-relaxed whitespace-pre-wrap">
                    {student.permanent_address_line1 ? (
                      <>
                        {student.permanent_address_line1}
                        {student.permanent_address_landmark && <br />}
                        {student.permanent_address_landmark && <span className="text-slate-500 text-xs">Landmark: {student.permanent_address_landmark}</span>}
                        <br />
                        {student.permanent_city_district}, {student.permanent_state} - {student.permanent_pincode}
                      </>
                    ) : 'Not Provided'}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2 pb-1 border-b border-slate-100">Permanent Address</p>
                  <p className="text-slate-500 text-sm italic font-medium flex items-center h-full pb-4">Same as Current Address</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Academic / Demographics) */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Academic Record */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
              <GraduationCap className="text-slate-400" size={20} />
              <h2 className="text-lg font-bold text-slate-800 m-0">Academic Record</h2>
            </div>
            <div className="p-5">
              {activeEnrollment ? (
                <div className="space-y-4">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">
                      {isPastYear ? 'Class (Historical Record)' : 'Current Class'}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-semibold text-lg ${isPastYear ? 'text-slate-600' : 'text-slate-900'}`}>
                        {(activeEnrollment as any)?.classes?.grade_level || 'N/A'} - {(activeEnrollment as any)?.classes?.section || ''} 
                        <span className="ml-1.5 text-slate-400 font-normal">
                          [{resolvedAy?.name || ''}]
                        </span>
                      </span>
                      {isPastYear && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-slate-100 text-slate-500 border border-slate-200" title="This class reflects the student's status during a past academic year.">
                          <Clock size={12} />
                          Past Year Data
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-row gap-6 border-t border-slate-100 pt-4 mt-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Roll Number</span>
                      <span className="font-medium text-slate-900">{(activeEnrollment as any)?.roll_number || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Academic Year</span>
                      <span className="font-medium text-slate-900">{resolvedAy?.name || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  <Calendar size={32} className="mb-3 opacity-30" />
                  <p className="text-sm italic font-medium">No active enrollment found.</p>
                </div>
              )}
            </div>
          </div>

          {/* Admission Details */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
              <FileText className="text-slate-400" size={20} />
              <h2 className="text-lg font-bold text-slate-800 m-0">Admission Info</h2>
            </div>
            <div className="p-6 flex flex-col gap-5">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Date of Admission</p>
                <p className="text-slate-800 font-medium">{student.date_of_admission ? new Date(student.date_of_admission).toLocaleDateString() : 'Not Provided'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Previous School</p>
                <p className="text-slate-800 font-medium">{student.previous_school_attended || 'Not Provided'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">TC Number</p>
                <p className="text-slate-800 font-medium">{student.tc_number || 'Not Provided'}</p>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}
