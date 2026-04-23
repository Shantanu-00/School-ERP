'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { calculateFeeAction } from '@/actions/finance.actions'
import { buildInvoiceTitle } from '@/lib/invoice'

interface GetStudentsParams {
  query?: string;
  status?: string;
  class_id?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  discount?: string;
  feesStatus?: string;
}

export async function getStudents({
  query = '',
  status = 'Active',
  class_id,
  page = 1,
  limit = 10,
  sortBy = 'first_name',
  sortOrder = 'asc',
  discount,
  feesStatus
}: GetStudentsParams) {
  // Await the client if your server.ts implementation requires it, otherwise just call it.
  const supabase = await createClient() 
  const cookieStore = await cookies()
  const yearId = cookieStore.get('academic_year_id')?.value

  if (!yearId) {
    return { students: [], totalPages: 0, error: "No Academic Year Selected" }
  }

  const from = (page - 1) * limit
  const to = from + limit - 1

  let feesFilterStudentIds: string[] | null = null;
  if (feesStatus && feesStatus !== 'All') {
    // "Pending" / "Paid" are based solely on Tuition Fee invoices (title starts with "Tuition Fee |").
    // Manually-issued invoices (field trips, etc.) are excluded so they don't skew the fee status.
    const { data: pendingInvoices } = await supabase
      .from('fee_invoices')
      .select('student_enrollments!inner(student_id)')
      .in('status', ['Unpaid', 'Partial'])
      .like('invoice_title', 'Tuition Fee |%');

    const studentsWithPendingDues = Array.from(new Set(
      (pendingInvoices || []).map((inv: any) => inv.student_enrollments?.student_id).filter(Boolean)
    ));

    if (feesStatus === 'Pending') {
      feesFilterStudentIds = studentsWithPendingDues as string[];
    } else if (feesStatus === 'Paid') {
      // Paid = enrolled this year AND no pending Tuition Fee invoice
      const { data: currentEnrollments } = await supabase
        .from('student_enrollments')
        .select('student_id')
        .eq('academic_year_id', yearId);

      const currentStudentIds = (currentEnrollments || []).map((enc: any) => enc.student_id);
      feesFilterStudentIds = currentStudentIds.filter((id: string) => !studentsWithPendingDues.includes(id));
    }

    if (!feesFilterStudentIds || feesFilterStudentIds.length === 0) {
      return { students: [], totalPages: 0 }
    }
  }

  let dbQuery = supabase
    .from('students')
    .select(`
      id, admission_number, first_name, last_name, dob, status, primary_contact_number,
      student_enrollments!inner (
        id,
        roll_number,
        academic_year_id,
        class_id,
        classes (grade_level, section),
        academic_years (id, name, is_active),
        discount_type,
        discount_mode,
        discount_value,
        fee_invoices (
          total_amount,
          status,
          due_date,
          invoice_title,
          fee_payments (amount_paid)
        )
      ),
      pocket_money_transactions (
        transaction_type, 
        amount
      )
    `, { count: 'exact' })
    .eq('student_enrollments.academic_year_id', yearId)
    
  if (status && status !== 'All') {
    dbQuery = dbQuery.eq('status', status)
  }

  if (class_id && class_id !== 'All') {
    dbQuery = dbQuery.eq('student_enrollments.class_id', class_id)
  }
  
  if (discount && discount !== 'All') {
    dbQuery = dbQuery.eq('student_enrollments.discount_type', discount)
  }

  if (query) {
    dbQuery = dbQuery.or(
      `first_name.ilike.%${query}%,last_name.ilike.%${query}%,admission_number.ilike.%${query}%`
    )
  }

  if (feesFilterStudentIds && feesFilterStudentIds.length > 0) {
    dbQuery = dbQuery.in('id', feesFilterStudentIds)
  }

  const { data, count, error } = await dbQuery
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(from, to)

  if (error) {
    console.error('Error fetching students:', error.message)
    throw new Error('Failed to fetch students')
  }

  // Compute previousDues and absoluteTotalDues.
  // The main query only returns fee_invoices nested inside the current-year enrollment.
  // Arrears invoices (enrollment_id = null) and invoices from past-year enrollments are
  // only reachable via the student_id FK on fee_invoices — so we fetch them separately.
  const studentIds = (data || []).map((s: any) => s.id as string)
  const currentEnrollmentIds = new Set(
    (data || []).map((s: any) => s.student_enrollments?.[0]?.id as string).filter(Boolean)
  )

  const { data: allInvoices } = await supabase
    .from('fee_invoices')
    .select('student_id, enrollment_id, total_amount, fee_payments(amount_paid)')
    .in('student_id', studentIds)

  const duesMap: Record<string, { previous: number; current: number }> = {}
  for (const inv of (allInvoices || []) as any[]) {
    const sid = inv.student_id as string
    if (!sid) continue
    if (!duesMap[sid]) duesMap[sid] = { previous: 0, current: 0 }
    const paid = ((inv.fee_payments || []) as any[]).reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0)
    const pending = Math.max(0, Number(inv.total_amount) - paid)
    if (currentEnrollmentIds.has(inv.enrollment_id)) {
      duesMap[sid].current += pending
    } else {
      duesMap[sid].previous += pending
    }
  }

  const enriched = (data || []).map((s: any) => ({
    ...s,
    previousDues: duesMap[s.id]?.previous || 0,
    absoluteTotalDues: (duesMap[s.id]?.previous || 0) + (duesMap[s.id]?.current || 0),
  }))

  return { students: enriched, totalPages: Math.ceil((count || 0) / limit) }
}

export async function addStudent(formData: FormData): Promise<void> {
  const normalizeOptional = (value: FormDataEntryValue | null): string | null => {
    if (typeof value !== 'string') return null
    const normalized = value.trim()
    return normalized.length ? normalized : null
  }

  const fail = (message: string): never => {
    redirect(`/students/new?error=${encodeURIComponent(message)}`)
  }

  const admission_number = normalizeOptional(formData.get('admission_number'))
  const first_name = normalizeOptional(formData.get('first_name'))
  const last_name = normalizeOptional(formData.get('last_name'))
  const dob = normalizeOptional(formData.get('dob'))
  const status = normalizeOptional(formData.get('status')) || 'Active'
  const aadhaar_number = normalizeOptional(formData.get('aadhaar_number'))
  const name_on_aadhaar = normalizeOptional(formData.get('name_on_aadhaar'))
  const apaar_id = normalizeOptional(formData.get('apaar_id'))
  const blood_group = normalizeOptional(formData.get('blood_group'))
  const gender = normalizeOptional(formData.get('gender'))
  const mother_tongue = normalizeOptional(formData.get('mother_tongue'))
  const social_category = normalizeOptional(formData.get('social_category'))
  const minority_status = normalizeOptional(formData.get('minority_status'))
  const mother_full_name = normalizeOptional(formData.get('mother_full_name'))
  const father_full_name = normalizeOptional(formData.get('father_full_name'))
  const guardian_name_and_relation = normalizeOptional(formData.get('guardian_name_and_relation'))
  const parent_aadhaar_number = normalizeOptional(formData.get('parent_aadhaar_number'))
  const primary_contact_number = normalizeOptional(formData.get('primary_contact_number'))
  const secondary_contact_number = normalizeOptional(formData.get('secondary_contact_number'))
  const date_of_admission = normalizeOptional(formData.get('date_of_admission'))
  const previous_school_attended = normalizeOptional(formData.get('previous_school_attended'))
  const tc_number = normalizeOptional(formData.get('tc_number'))

  const current_address_line1 = normalizeOptional(formData.get('current_address_line1'))
  const current_address_landmark = normalizeOptional(formData.get('current_address_landmark'))
  const current_city_district = normalizeOptional(formData.get('current_city_district'))
  const current_state = normalizeOptional(formData.get('current_state'))
  const current_pincode = normalizeOptional(formData.get('current_pincode'))

  const is_permanent_same_as_current = formData.get('is_permanent_same_as_current') === 'true'

  const permanent_address_line1 = is_permanent_same_as_current ? current_address_line1 : normalizeOptional(formData.get('permanent_address_line1'))
  const permanent_address_landmark = is_permanent_same_as_current ? current_address_landmark : normalizeOptional(formData.get('permanent_address_landmark'))
  const permanent_city_district = is_permanent_same_as_current ? current_city_district : normalizeOptional(formData.get('permanent_city_district'))
  const permanent_state = is_permanent_same_as_current ? current_state : normalizeOptional(formData.get('permanent_state'))
  const permanent_pincode = is_permanent_same_as_current ? current_pincode : normalizeOptional(formData.get('permanent_pincode'))

  const academic_year_id = normalizeOptional(formData.get('academic_year_id'))
  const class_id = normalizeOptional(formData.get('class_id'))
  const roll_number = parseInt(formData.get('roll_number') as string, 10)

  const discount_type = normalizeOptional(formData.get('discount_type')) || 'None'
  const discount_mode = normalizeOptional(formData.get('discount_mode')) || 'Percentage'
  const discount_value_str = formData.get('discount_value')
  const discount_value = discount_value_str ? parseFloat(discount_value_str as string) : 0

  const pocket_money_initial_amount = parseFloat(formData.get('pocket_money_initial_amount') as string) || 0
  const registration_type = formData.get('registration_type') as string || 'new'
  const opening_balance = parseFloat(formData.get('opening_balance') as string) || 0

  if (!admission_number || !first_name || !last_name || !dob) {
    fail('All core student fields are required.')
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.id) return fail('Please login and try again.')

  const { data: staffData } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  
  if (staffData?.role !== 'Admin' && staffData?.role !== 'Accountant') {
    fail('Unauthorized to add students.')
  }

  // DUPLICATE CHECK: Name + DOB combination
  const { data: existingStudent } = await supabase
    .from('students')
    .select('id')
    .ilike('first_name', first_name as string)
    .ilike('last_name', last_name as string)
    .eq('dob', dob as string)
    .maybeSingle()

  if (existingStudent) {
    fail('A student with the exact same first name, last name, and date of birth already exists in the system.')
  }

  // 1. Insert Student Record 
  // (We use a transaction-like logic manually, rollback student if enrollment fails)
  const { data: studentRecord, error: studentError } = await supabase
    .from('students')
    .insert([
      {
        admission_number,
        first_name,
        last_name,
        dob,
        status,
        aadhaar_number,
        name_on_aadhaar,
        apaar_id,
        blood_group,
        gender,
        mother_tongue,
        social_category,
        minority_status,
        mother_full_name,
        father_full_name,
        guardian_name_and_relation,
        parent_aadhaar_number,
        primary_contact_number,
        secondary_contact_number,
        date_of_admission,
        previous_school_attended,
        tc_number,
        current_address_line1,
        current_address_landmark,
        current_city_district,
        current_state,
        current_pincode,
        is_permanent_same_as_current,
        permanent_address_line1,
        permanent_address_landmark,
        permanent_city_district,
        permanent_state,
        permanent_pincode
      }
    ])
    .select()
    .single()

  if (studentError) {
    console.error("Student insert failed:", studentError)
    if (studentError.code === '23505') { // Postgres Unique Violation
      fail('Admission Number, Aadhaar Number, or APAAR ID already exists.')
    }
    fail(studentError.message)
  }

  // 2. Insert corresponding Student Enrollment Profile
  const { data: enrollmentRecord, error: enrollmentError } = await supabase
    .from('student_enrollments')
    .insert([
      {
        student_id: studentRecord.id,
        academic_year_id,
        class_id,
        roll_number,
        discount_type,
        discount_mode,
        discount_value
      }
    ])
    .select()
    .single()

  if (enrollmentError) {
    console.error("Enrollment failed. Rolling back profile creation:", enrollmentError.message)
    // Manually rollback the student if enrollment insert failed to keep state consistent
    await supabase.from('students').delete().eq('id', studentRecord.id)
    
    if (enrollmentError.code === '23505') {
      fail('A student is already enrolled with this configuration. Enrollment reverted.')
    }
    fail(`Enrollment initialization failed: ${enrollmentError.message}`)
  }

  // 2.5 Generate Initial Pocket Money if > 0
  if (pocket_money_initial_amount > 0) {
    const { error: pocketMoneyError } = await supabase
      .from('pocket_money_transactions')
      .insert({
        student_id: studentRecord.id,
        transaction_type: 'CREDIT',
        amount: pocket_money_initial_amount,
        description: 'Initial Deposit on Admission',
        logged_by: staffData ? staffData.id : null
      })

    if (pocketMoneyError) {
      console.error("Pocket money deposit failed:", pocketMoneyError.message)
      // Continue anyway, this can be logged later
    }
  }

  // 2.6 Generate Previous Year Arrears Invoice
  if (registration_type === 'existing' && opening_balance > 0) {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    const { error: arrearsError } = await supabase
      .from('fee_invoices')
      .insert({
        student_id: studentRecord.id,
        enrollment_id: null,
        invoice_title: 'Previous Year Arrears',
        total_amount: opening_balance,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'Unpaid',
        created_by: staffData ? staffData.id : null
      })

    if (arrearsError) {
      console.error("Arrears invoice generation failed:", arrearsError.message)
    }
  }

  // 3. Generate Invoice if requested
  const action_type = formData.get('action_type')
  if (action_type === 'enroll_and_invoice') {
    const feeCalculation = await calculateFeeAction({
      academic_year_id: academic_year_id as string,
      class_id: class_id as string,
      gender: gender ? gender as string : 'All',
      discount_mode: discount_mode as string,
      discount_value: discount_value as number
    })

    if (feeCalculation.error) {
      fail(`Enrollment successful, but invoice failed: ${feeCalculation.error}`)
    }

    // Load classes/years for the invoice title matching logic
    const { data: yData } = await supabase.from('academic_years').select('name').eq('id', academic_year_id).single()
    const { data: cData } = await supabase.from('classes').select('grade_level, section').eq('id', class_id).single()

    const invoiceTitle = buildInvoiceTitle({
      invoiceType: 'Tuition Fee',
      academicYearName: yData?.name || null,
      gradeLevel: cData?.grade_level || null,
      section: cData?.section || null,
      courseStream: 'General'
    })

    // Insert Invoice
    // In postgres, date can be handled natively. We set due date 30 days from now
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    const { error: invoiceError } = await supabase
      .from('fee_invoices')
      .insert({
        student_id: studentRecord.id,
        enrollment_id: enrollmentRecord.id,
        invoice_title: invoiceTitle,
        total_amount: feeCalculation.finalFee || 0,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'Unpaid',
        created_by: staffData ? staffData.id : null // Assuming staff table has matching auth_id
      })

    if (invoiceError) {
      console.error("Invoice Generation failed:", invoiceError.message)
      // We do not rollback enrollment here, just report error, as student is officially enrolled
      fail(`Enrollment successful, but invoice generation failed: ${invoiceError.message}`)
    }
  }

  revalidatePath('/students')
  redirect('/students')
}

export async function updateStudent(formData: FormData): Promise<void> {
  const normalizeOptional = (value: FormDataEntryValue | null): string | null => {
    if (typeof value !== 'string') return null
    const normalized = value.trim()
    return normalized.length ? normalized : null
  }

  const student_id = formData.get('student_id') as string
  if (!student_id) {
    redirect(`/students?error=${encodeURIComponent('Student ID is missing.')}`)
  }

  const fail = (message: string): never => {
    redirect(`/students/${student_id}/edit?error=${encodeURIComponent(message)}`)
  }

  const admission_number = normalizeOptional(formData.get('admission_number'))
  const first_name = normalizeOptional(formData.get('first_name'))
  const last_name = normalizeOptional(formData.get('last_name'))
  const dob = normalizeOptional(formData.get('dob'))
  const status = normalizeOptional(formData.get('status')) || 'Active'
  const aadhaar_number = normalizeOptional(formData.get('aadhaar_number'))
  const name_on_aadhaar = normalizeOptional(formData.get('name_on_aadhaar'))
  const apaar_id = normalizeOptional(formData.get('apaar_id'))
  const blood_group = normalizeOptional(formData.get('blood_group'))
  const gender = normalizeOptional(formData.get('gender'))
  const mother_tongue = normalizeOptional(formData.get('mother_tongue'))
  const social_category = normalizeOptional(formData.get('social_category'))
  const minority_status = normalizeOptional(formData.get('minority_status'))
  const mother_full_name = normalizeOptional(formData.get('mother_full_name'))
  const father_full_name = normalizeOptional(formData.get('father_full_name'))
  const guardian_name_and_relation = normalizeOptional(formData.get('guardian_name_and_relation'))
  const parent_aadhaar_number = normalizeOptional(formData.get('parent_aadhaar_number'))
  const primary_contact_number = normalizeOptional(formData.get('primary_contact_number'))
  const secondary_contact_number = normalizeOptional(formData.get('secondary_contact_number'))
  const date_of_admission = normalizeOptional(formData.get('date_of_admission'))
  const previous_school_attended = normalizeOptional(formData.get('previous_school_attended'))
  const tc_number = normalizeOptional(formData.get('tc_number'))

  const current_address_line1 = normalizeOptional(formData.get('current_address_line1'))
  const current_address_landmark = normalizeOptional(formData.get('current_address_landmark'))
  const current_city_district = normalizeOptional(formData.get('current_city_district'))
  const current_state = normalizeOptional(formData.get('current_state'))
  const current_pincode = normalizeOptional(formData.get('current_pincode'))
  
  const is_permanent_same_as_current = formData.get('is_permanent_same_as_current') === 'true'
  
  const permanent_address_line1 = is_permanent_same_as_current ? current_address_line1 : normalizeOptional(formData.get('permanent_address_line1'))
  const permanent_address_landmark = is_permanent_same_as_current ? current_address_landmark : normalizeOptional(formData.get('permanent_address_landmark'))
  const permanent_city_district = is_permanent_same_as_current ? current_city_district : normalizeOptional(formData.get('permanent_city_district'))
  const permanent_state = is_permanent_same_as_current ? current_state : normalizeOptional(formData.get('permanent_state'))
  const permanent_pincode = is_permanent_same_as_current ? current_pincode : normalizeOptional(formData.get('permanent_pincode'))

  const enrollment_id = formData.get('enrollment_id') as string | null
  const academic_year_id = normalizeOptional(formData.get('academic_year_id'))
  const class_id = normalizeOptional(formData.get('class_id'))
  const roll_number = parseInt(formData.get('roll_number') as string, 10)
  
  const discount_type = normalizeOptional(formData.get('discount_type'))
  const discount_mode = normalizeOptional(formData.get('discount_mode'))
  const discount_value_str = formData.get('discount_value')
  const discount_value = discount_value_str ? parseFloat(discount_value_str as string) : undefined

  if (!admission_number || !first_name || !last_name || !dob) {
    fail('All core student fields are required.')
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.id) return fail('Please login and try again.')

  const { data: staffData } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (staffData?.role !== 'Admin' && staffData?.role !== 'Accountant') {
    fail('Unauthorized to edit students.')
  }

  const { data: existingStudent } = await supabase
    .from('students')
    .select('id')
    .ilike('first_name', first_name as string)
    .ilike('last_name', last_name as string)
    .eq('dob', dob as string)
    .neq('id', student_id)
    .maybeSingle()

  if (existingStudent) {
    fail('A student with the exact same first name, last name, and date of birth already exists in the system.')
  }

  const { error: studentError } = await supabase
    .from('students')
    .update({
      admission_number, first_name, last_name, dob, status,
      aadhaar_number, name_on_aadhaar, apaar_id, blood_group, gender,
      mother_tongue, social_category, minority_status, mother_full_name,
      father_full_name, guardian_name_and_relation, parent_aadhaar_number,
      primary_contact_number, secondary_contact_number, date_of_admission,
      previous_school_attended, tc_number, current_address_line1,
      current_address_landmark, current_city_district, current_state,
      current_pincode, is_permanent_same_as_current, permanent_address_line1,
      permanent_address_landmark, permanent_city_district, permanent_state,
      permanent_pincode
    })
    .eq('id', student_id)

  if (studentError) {
    if (studentError.code === '23505') fail('Admission Number, Aadhaar Number, or APAAR ID already exists.')
    fail(studentError.message)
  }

  if (enrollment_id && academic_year_id && class_id && !isNaN(roll_number)) {
    const updateData: any = { academic_year_id, class_id, roll_number }
    
    if (discount_type) updateData.discount_type = discount_type
    if (discount_mode) updateData.discount_mode = discount_mode
    if (discount_value !== undefined) updateData.discount_value = discount_value

    const { error: enrollmentError } = await supabase
      .from('student_enrollments')
      .update(updateData)
      .eq('id', enrollment_id)

    if (enrollmentError) {
      if (enrollmentError.code === '23505') fail('A student is already enrolled with this configuration.')
      fail(`Enrollment update failed: ${enrollmentError.message}`)
    }
  }

  const action_type = formData.get('action_type')
  if (action_type === 'enroll_and_invoice' && enrollment_id && class_id && academic_year_id && discount_mode && discount_value !== undefined) {
    const feeCalculation = await calculateFeeAction({
      academic_year_id: academic_year_id as string,
      class_id: class_id as string,
      gender: gender ? gender as string : 'All',
      discount_mode: discount_mode as string,
      discount_value: discount_value as number
    })

    if (!feeCalculation.error) {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 30)

      const { data: yData } = await supabase.from('academic_years').select('name').eq('id', academic_year_id).single()
      const { data: cData } = await supabase.from('classes').select('grade_level, section').eq('id', class_id).single()
  
      const invoiceTitle = buildInvoiceTitle({
        invoiceType: 'Tuition Fee',
        academicYearName: yData?.name || null,
        gradeLevel: cData?.grade_level || null,
        section: cData?.section || null,
        courseStream: 'General'
      })

      await supabase
        .from('fee_invoices')
        .insert({
          student_id: student_id,
          enrollment_id: enrollment_id,
          invoice_title: invoiceTitle,
          total_amount: feeCalculation.finalFee || 0,
          due_date: dueDate.toISOString().split('T')[0],
          status: 'Unpaid',
          created_by: staffData ? staffData.id : null
        })
    }
  }

  revalidatePath('/students')
  revalidatePath(`/students/${student_id}`)
  redirect(`/students/${student_id}`)
}

export async function getFormerStudents({
  query = '',
  status = 'Both',
  page = 1,
  limit = 20,
  sortBy = 'name',
  sortOrder = 'asc',
  feesStatus = 'All'
}: {
  query?: string,
  status?: string,
  page?: number,
  limit?: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc',
  feesStatus?: string
} = {}) {
  const supabase = await createClient()

  let dbQuery = supabase
    .from('students')
    .select(`
      id, admission_number, first_name, last_name, status,
      student_enrollments (
        classes (grade_level, section),
        academic_years (id, name, start_date)
      ),
      fee_invoices (
        total_amount,
        fee_payments (amount_paid)
      ),
      pocket_money_transactions (
        transaction_type,
        amount
      )
    `)
    
  if (status && status !== 'Both') {
    dbQuery = dbQuery.eq('status', status)
  } else {
    dbQuery = dbQuery.in('status', ['Alumni', 'Dropout'])
  }

  if (query) {
    dbQuery = dbQuery.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,admission_number.ilike.%${query}%`)
  }

  const { data, error } = await dbQuery
  
  if (error) {
    console.error('Error fetching former students:', error.message)
    return { students: [], totalPages: 0, totalCount: 0, error: error.message }
  }

  const formerStudents = (data || []).map((student: any) => {
    let pendingDues = 0;
    
    // Calculate pending dues from all invoices attached to this student
    if (student.fee_invoices && student.fee_invoices.length > 0) {
      student.fee_invoices.forEach((inv: any) => {
        const paid = inv.fee_payments?.reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0) || 0
        pendingDues += Math.max(0, Number(inv.total_amount) - paid)
      })
    }

    let lastKnownClass = 'N/A';
    let passoutYear = 'N/A';
    let latestStartDate: Date | null = null;
    
    if (student.student_enrollments && student.student_enrollments.length > 0) {
      student.student_enrollments.forEach((enrollment: any) => {
        const ay = Array.isArray(enrollment.academic_years) ? enrollment.academic_years[0] : enrollment.academic_years;
        const cl = Array.isArray(enrollment.classes) ? enrollment.classes[0] : enrollment.classes;
        
        if (ay && ay.start_date) {
           const startDate = new Date(ay.start_date);
           if (!latestStartDate || startDate > latestStartDate) {
             latestStartDate = startDate;
             passoutYear = ay.name || 'N/A';
             lastKnownClass = cl ? `${cl.grade_level} - ${cl.section}` : 'N/A';
           }
        }
      })
    }

    const walletBalance = (student.pocket_money_transactions || []).reduce(
      (bal: number, tx: any) => bal + (tx.transaction_type === 'CREDIT' ? Number(tx.amount) : -Number(tx.amount)),
      0
    )

    return {
      id: student.id,
      first_name: student.first_name,
      last_name: student.last_name,
      admission_number: student.admission_number,
      status: student.status,
      pendingDues,
      walletBalance,
      lastKnownClass,
      passoutYear,
      latestStartDateStr: latestStartDate ? (latestStartDate as Date).toISOString() : ''
    }
  });

  // Filter by Fees Status
  let filteredStudents = formerStudents;
  if (feesStatus === 'Pending') {
    filteredStudents = formerStudents.filter(s => s.pendingDues > 0);
  } else if (feesStatus === 'Cleared') {
    filteredStudents = formerStudents.filter(s => s.pendingDues === 0);
  }

  // Sorting
  filteredStudents.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') {
      const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
      const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
      cmp = nameA.localeCompare(nameB);
    } else if (sortBy === 'dues') {
      cmp = a.pendingDues - b.pendingDues;
    } else if (sortBy === 'passout_year') {
      cmp = a.latestStartDateStr.localeCompare(b.latestStartDateStr);
    } else if (sortBy === 'admission_number') {
      cmp = a.admission_number.localeCompare(b.admission_number);
    }
    
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.ceil(filteredStudents.length / limit)
  const paginatedStudents = filteredStudents.slice((page - 1) * limit, page * limit)

  return { students: paginatedStudents, totalPages, totalCount: filteredStudents.length }
}

export async function addFormerStudent(formData: FormData): Promise<void> {
  const normalizeOptional = (value: FormDataEntryValue | null): string | null => {
    if (typeof value !== 'string') return null
    const normalized = value.trim()
    return normalized.length ? normalized : null
  }

  const fail = (message: string): never => {
    redirect(`/students/former-students/new?error=${encodeURIComponent(message)}`)
  }

  // Core identity
  const status = normalizeOptional(formData.get('status')) || 'Alumni'
  const first_name = normalizeOptional(formData.get('first_name'))
  const last_name = normalizeOptional(formData.get('last_name'))
  const admission_number = normalizeOptional(formData.get('admission_number'))
  const dob = normalizeOptional(formData.get('dob'))
  const gender = normalizeOptional(formData.get('gender'))
  const date_of_admission = normalizeOptional(formData.get('date_of_admission'))
  const primary_contact_number = normalizeOptional(formData.get('primary_contact_number'))
  const tc_number = normalizeOptional(formData.get('tc_number'))
  const previous_school_attended = normalizeOptional(formData.get('previous_school_attended'))
  const aadhaar_number = normalizeOptional(formData.get('aadhaar_number'))
  const apaar_id = normalizeOptional(formData.get('apaar_id'))

  // Parent / guardian
  const mother_full_name = normalizeOptional(formData.get('mother_full_name'))
  const father_full_name = normalizeOptional(formData.get('father_full_name'))
  const guardian_name_and_relation = normalizeOptional(formData.get('guardian_name_and_relation'))
  const parent_aadhaar_number = normalizeOptional(formData.get('parent_aadhaar_number'))
  const secondary_contact_number = normalizeOptional(formData.get('secondary_contact_number'))

  // Enrollment
  const raw_academic_year_id = normalizeOptional(formData.get('academic_year_id'))
  const class_id = normalizeOptional(formData.get('class_id'))
  const roll_number = parseInt(formData.get('roll_number') as string, 10) || 0

  // Financial
  const pending_arrears = parseFloat(formData.get('pending_arrears') as string) || 0.00
  const pocket_money_amount = parseFloat(formData.get('pocket_money_amount') as string) || 0.00
  const pocket_money_type = formData.get('pocket_money_type') as string || 'CREDIT'

  if (!first_name || !last_name || !admission_number || !dob) {
    fail('First name, Last name, Admission number, and Date of Birth are required.')
  }

  if (!raw_academic_year_id || !class_id) {
    fail('Last Academic Year and Class are required.')
  }

  const supabase = await createClient()

  // Validate permission (Admin or Accountant)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.id) return fail('Please login and try again.')

  const { data: staffData } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (staffData?.role !== 'Admin' && staffData?.role !== 'Accountant') {
    fail('Unauthorized to add former students.')
  }

  // Resolve academic_year_id — if a historic sentinel value was submitted, auto-create the year
  const HISTORIC_PREFIX = '__historic__'
  let academic_year_id = raw_academic_year_id
  if (raw_academic_year_id!.startsWith(HISTORIC_PREFIX)) {
    const yearName = raw_academic_year_id!.slice(HISTORIC_PREFIX.length) // e.g. "2015-2016"
    const startYear = parseInt(yearName.split('-')[0], 10)
    if (isNaN(startYear)) fail('Invalid historical year selected.')

    // Check if it was already created by a previous submission
    const { data: existing } = await supabase
      .from('academic_years')
      .select('id')
      .eq('name', yearName)
      .maybeSingle()

    if (existing) {
      academic_year_id = existing.id
    } else {
      const { data: created, error: yearError } = await supabase
        .from('academic_years')
        .insert({
          name: yearName,
          start_date: `${startYear}-04-01`,
          end_date: `${startYear + 1}-03-31`,
          is_active: false,
        })
        .select('id')
        .single()

      if (yearError) fail(`Could not create historical academic year: ${yearError.message}`)
      academic_year_id = created!.id
    }
  }

  // DUPLICATE CHECK: Name + DOB combination OR Admission number
  const { data: existingStudent } = await supabase
    .from('students')
    .select('id')
    .or(`admission_number.eq.${admission_number},and(first_name.ilike.${first_name},last_name.ilike.${last_name},dob.eq.${dob})`)
    .maybeSingle()

  if (existingStudent) {
    fail('A student with the same admission number or exact name/DOB already exists.')
  }

  // 1. Insert Student Record
  const { data: studentRecord, error: studentError } = await supabase
    .from('students')
    .insert([
      {
        admission_number,
        first_name,
        last_name,
        dob,
        status,
        gender,
        date_of_admission,
        primary_contact_number,
        tc_number,
        previous_school_attended,
        aadhaar_number,
        apaar_id,
        mother_full_name,
        father_full_name,
        guardian_name_and_relation,
        parent_aadhaar_number,
        secondary_contact_number,
      }
    ])
    .select()
    .single()

  if (studentError) {
    console.error("Student insert failed:", studentError)
    fail(studentError.message)
  }

  // 2. Insert corresponding Student Enrollment Profile
  const { data: enrollmentRecord, error: enrollmentError } = await supabase
    .from('student_enrollments')
    .insert([
      {
        student_id: studentRecord.id,
        academic_year_id,
        class_id,
        roll_number,
        discount_type: 'None',
        discount_mode: 'Percentage',
        discount_value: 0
      }
    ])
    .select()
    .single()

  if (enrollmentError) {
    console.error("Enrollment failed. Rolling back profile creation:", enrollmentError.message)
    await supabase.from('students').delete().eq('id', studentRecord.id)
    fail(`Enrollment initialization failed: ${enrollmentError.message}`)
  }

  // 3. Generate Previous Year Arrears Invoice
  if (pending_arrears > 0) {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    const { error: arrearsError } = await supabase
      .from('fee_invoices')
      .insert({
        student_id: studentRecord.id,
        enrollment_id: enrollmentRecord.id,
        invoice_title: 'Past Arrears',
        total_amount: pending_arrears,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'Unpaid',
        created_by: staffData ? staffData.id : null
      })

    if (arrearsError) {
      console.error("Arrears invoice generation failed:", arrearsError.message)
    }
  }

  // 4. Generate Pocket Money Transactions
  if (pocket_money_amount > 0) {
    const { error: pocketMoneyError } = await supabase
      .from('pocket_money_transactions')
      .insert({
        student_id: studentRecord.id,
        transaction_type: pocket_money_type,
        amount: pocket_money_amount,
        description: pocket_money_type === 'CREDIT' ? 'Pending Pocket Money to be returned' : 'Pending Pocket Money owed by student',
        logged_by: staffData ? staffData.id : null
      })

    if (pocketMoneyError) {
      console.error("Pocket money deposit failed:", pocketMoneyError.message)
    }
  }

  revalidatePath('/students/former-students')
  redirect('/students/former-students')
}
