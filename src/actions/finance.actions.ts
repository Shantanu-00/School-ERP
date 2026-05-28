'use server'
import { createClient } from '@/lib/supabase/server'
import { applyDiscount, buildInvoiceTitle, selectFeeConfigurationByGender } from '@/lib/invoice'

export async function calculateFeeAction({
  academic_year_id,
  class_id,
  gender,
  discount_mode,
  discount_value
}: {
  academic_year_id: string
  class_id: string
  gender?: string
  discount_mode?: string
  discount_value?: number
}) {
  const supabase = await createClient()

  if (!academic_year_id) return { error: 'Please select an Academic Year.' }
  if (!class_id) return { error: 'Please select a Class.' }

  const query = supabase
    .from('fee_configurations')
    .select('*')
    .eq('academic_year_id', academic_year_id)
    .eq('class_id', class_id)
    .eq('course_stream', 'General') // assuming general for now

  const { data: configs, error } = await query

  if (error || !configs || configs.length === 0) {
    return { error: 'No fee configuration found for this selection.' }
  }

  const findConfig = (g: string) => configs.find(c => c.gender === g)
  const config = findConfig(gender || 'All') || findConfig('All')

  if (!config) {
    return { error: 'No fee configuration found for this selection.' }
  }

  const baseFee = Number(config.base_fee_amount)
  const finalFee = applyDiscount(baseFee, discount_mode, discount_value || 0)

  return {
    baseFee,
    finalFee,
    configFound: true
  }
}

export async function addPocketMoneyTransaction(
  student_id: string,
  amount: number,
  description: string,
  type: 'CREDIT' | 'DEBIT',
  receipt_object_keys?: string[],
  payment_mode?: 'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque' | 'Internal Adjustment',
  transaction_reference?: string,
  bank_name?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in" }

  const { data: staff } = await supabase.from('staff').select('id').eq('auth_id', user.id).single()
  if (!staff) return { error: "Staff record not found" }

  const normalizedMode = payment_mode || 'Cash'
  const normalizedReference = (transaction_reference || '').trim()
  if (type === 'CREDIT' && normalizedMode !== 'Cash' && !normalizedReference) {
    return { error: 'Transaction reference is required for non-cash pocket money credits.' }
  }

  // Compute balance after this transaction
  const { data: balData } = await supabase
    .from('pocket_money_balances')
    .select('current_balance')
    .eq('student_id', student_id)
    .maybeSingle()
  const currentBal = balData?.current_balance || 0
  const balanceAfter = type === 'CREDIT' ? currentBal + amount : currentBal - amount

  const { data: inserted, error } = await supabase.from('pocket_money_transactions').insert({
    student_id,
    transaction_type: type,
    amount,
    description: description || `Pocket Money ${type === 'CREDIT' ? 'Deposit' : 'Withdrawal'}`,
    receipt_object_keys: receipt_object_keys || null,
    payment_mode: normalizedMode,
    transaction_reference: normalizedReference || null,
    bank_name: bank_name?.trim() || null,
    balance_after_transaction: balanceAfter,
    logged_by: staff.id
  }).select('id, receipt_number')

  if (error) return { error: error.message }
  return { success: true, transaction: inserted?.[0] || null }
}

export async function addPocketMoneyReceipt(transactionId: string, newKeys: string[]) {
  const supabase = await createClient()
  // Fetch existing keys first
  const { data: txn, error: fetchErr } = await supabase
    .from('pocket_money_transactions')
    .select('receipt_object_keys')
    .eq('id', transactionId)
    .single()
    
  if (fetchErr) return { error: fetchErr.message }
  
  const existingKeys = txn.receipt_object_keys || []
  const combinedKeys = [...existingKeys, ...newKeys]

  const { error } = await supabase
    .from('pocket_money_transactions')
    .update({ receipt_object_keys: combinedKeys })
    .eq('id', transactionId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function getStudentPendingInvoices(student_id: string) {
  const supabase = await createClient()
  
  // get all invoices for all enrollments of the student
  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select('id, academic_years(is_active)')
    .eq('student_id', student_id)

  const enrollmentIds = enrollments?.map(e => e.id) || []

  let query = supabase
    .from('fee_invoices')
    .select('id, invoice_title, total_amount, status, due_date, fee_payments(amount_paid, clearance_status), student_enrollments(academic_years(name))')
    .in('status', ['Unpaid', 'Partial'])
    .order('due_date', { ascending: true })

  if (enrollmentIds.length > 0) {
    query = query.or(`enrollment_id.in.(${enrollmentIds.join(',')}),student_id.eq.${student_id}`)
  } else {
    query = query.eq('student_id', student_id)
  }

  const { data: invoices, error: invError } = await query

  if (invError || !invoices) return { error: 'Failed to fetch invoices.', invoices: [] }

  return {
    invoices: invoices.map(i => {
      const paid = i.fee_payments
        ?.filter((p: any) => p.clearance_status === 'Cleared')
        .reduce((acc: number, p: any) => acc + (p.amount_paid || 0), 0) || 0

      let ay = 'Previous Arrears';
      if (i.student_enrollments) {
        const enroll = Array.isArray(i.student_enrollments) ? i.student_enrollments[0] : i.student_enrollments;
        const academicYears = enroll?.academic_years;
        const firstAy = Array.isArray(academicYears) ? academicYears[0] : academicYears;
        ay = firstAy?.name || 'Unknown Year';
      }

      return {
        id: i.id,
        title: i.invoice_title || 'Tuition Fee',
        academic_year: ay,
        total_amount: i.total_amount,
        status: i.status,
        due_date: i.due_date,
        paid_amount: paid,
        pending_amount: i.total_amount - paid
      }
    }).filter(i => i.pending_amount > 0)
  }
}

export async function recordFeePayments(
  payments: { invoice_id: string; amount_paid: number }[],
  payment_method: string,
  payment_date: string,
  transaction_reference?: string,
  receipt_object_keys?: string[],
  bank_name?: string,
  instrument_date?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in" }

  const { data: staff } = await supabase.from('staff').select('id').eq('auth_id', user.id).single()
  if (!staff) return { error: "Staff record not found" }

  const isInstant = payment_method === 'Cash' || payment_method === 'UPI'
  const clearanceStatus = isInstant ? 'Cleared' : 'Pending'
  const clearanceDate = isInstant ? payment_date : null

  const inserts = payments.map(p => ({
    invoice_id: p.invoice_id,
    amount_paid: p.amount_paid,
    payment_date,
    payment_method,
    transaction_reference: transaction_reference?.trim() || null,
    receipt_object_keys: receipt_object_keys?.length ? receipt_object_keys : null,
    bank_name: bank_name?.trim() || null,
    instrument_date: instrument_date && instrument_date.trim() !== '' ? instrument_date : null,
    clearance_status: clearanceStatus,
    clearance_date: clearanceDate,
    logged_by: staff.id
  }))

  const { data: inserted, error } = await supabase
    .from('fee_payments')
    .insert(inserts)
    .select('id, receipt_number')

  if (error) return { error: error.message }

  // Only update invoice status if payment is instantly cleared (Cash/UPI)
  if (isInstant) {
    for (const p of payments) {
      const { data: inv } = await supabase
        .from('fee_invoices')
        .select('id, total_amount, fee_payments(amount_paid, clearance_status)')
        .eq('id', p.invoice_id)
        .single()
      if (inv) {
        const clearedTotal = inv.fee_payments
          ?.filter((fp: any) => fp.clearance_status === 'Cleared')
          .reduce((a: number, fp: any) => a + Number(fp.amount_paid), 0) || 0
        const newStatus = clearedTotal >= Number(inv.total_amount) ? 'Paid' : clearedTotal > 0 ? 'Partial' : 'Unpaid'
        await supabase.from('fee_invoices').update({ status: newStatus }).eq('id', p.invoice_id)
      }
    }
  }

  return { success: true, payments: inserted }
}

export async function getPendingClearancePayments() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('fee_payments')
    .select(`
      id, receipt_number, amount_paid, payment_date, payment_method,
      bank_name, instrument_date, transaction_reference,
      clearance_status, clearance_date, clearance_remarks,
      created_at, staff(name),
      fee_invoices(
        id, invoice_title, total_amount,
        student_id, students(first_name, last_name, admission_number),
        enrollment_id, student_enrollments(academic_years(name), classes(grade_level, section))
      )
    `)
    .eq('clearance_status', 'Pending')
    .order('payment_date', { ascending: true })

  if (error) return { error: error.message, data: [] }

  const mapped = (data || []).map((p: any) => {
    const inv = p.fee_invoices
    const student = inv?.students || inv?.student_enrollments?.students
    const resolvedStudent = Array.isArray(student) ? student[0] : student
    const enrollment = inv?.student_enrollments
    const resolvedEnrollment = Array.isArray(enrollment) ? enrollment[0] : enrollment
    const ay = resolvedEnrollment?.academic_years
    const resolvedAy = Array.isArray(ay) ? ay[0] : ay
    const cls = resolvedEnrollment?.classes
    const resolvedCls = Array.isArray(cls) ? cls[0] : cls

    return {
      ...p,
      student_name: resolvedStudent ? `${resolvedStudent.first_name} ${resolvedStudent.last_name}` : 'Unknown',
      admission_number: resolvedStudent?.admission_number || '',
      invoice_title: inv?.invoice_title || 'Fee',
      academic_year: resolvedAy?.name || 'Unknown',
      class_label: resolvedCls ? `${resolvedCls.grade_level} - ${resolvedCls.section}` : '',
      logged_by_name: p.staff?.name || 'System'
    }
  })

  return { data: mapped }
}

export async function updatePaymentClearance(
  paymentId: string,
  clearance_status: 'Pending' | 'Cleared' | 'Bounced' | 'Refunded',
  clearance_date?: string,
  clearance_remarks?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in" }

  const { data: staff } = await supabase.from('staff').select('id, role').eq('auth_id', user.id).single()
  if (!staff || !['Admin', 'Accountant'].includes(staff.role)) {
    return { error: "Only Admin or Accountant can update clearance status" }
  }

  const update: Record<string, any> = { clearance_status }
  if (clearance_date) update.clearance_date = clearance_date
  if (clearance_remarks !== undefined) update.clearance_remarks = clearance_remarks || null

  const { error } = await supabase
    .from('fee_payments')
    .update(update)
    .eq('id', paymentId)

  if (error) return { error: error.message }

  // Recalculate invoice status based only on cleared payments
  const { data: payment } = await supabase
    .from('fee_payments')
    .select('invoice_id')
    .eq('id', paymentId)
    .single()

  if (payment?.invoice_id) {
    const { data: inv } = await supabase
      .from('fee_invoices')
      .select('id, total_amount, fee_payments(amount_paid, clearance_status)')
      .eq('id', payment.invoice_id)
      .single()

    if (inv) {
      const effectivePaid = inv.fee_payments
        ?.filter((fp: any) => fp.clearance_status === 'Cleared')
        .reduce((a: number, fp: any) => a + Number(fp.amount_paid), 0) || 0

      const newStatus = effectivePaid >= Number(inv.total_amount) ? 'Paid' : effectivePaid > 0 ? 'Partial' : 'Unpaid'
      await supabase.from('fee_invoices').update({ status: newStatus }).eq('id', inv.id)
    }
  }

  return { success: true }
}

export async function getPaymentReceiptData(paymentId: string) {
  const supabase = await createClient()

  const { data: payment, error } = await supabase
    .from('fee_payments')
    .select(`
      id, receipt_number, amount_paid, payment_date, payment_method,
      bank_name, instrument_date, transaction_reference,
      clearance_status, created_at,
      fee_invoices(
        id, invoice_title, total_amount, status,
        student_id,
        students(id, first_name, last_name, admission_number),
        enrollment_id,
        student_enrollments(
          academic_years(name),
          classes(grade_level, section)
        )
      )
    `)
    .eq('id', paymentId)
    .single()

  if (error || !payment) return { error: error?.message || 'Payment not found' }

  const inv = payment.fee_invoices as any
  const student = inv?.students
  const resolvedStudent = Array.isArray(student) ? student[0] : student
  const enrollment = inv?.student_enrollments
  const resolvedEnrollment = Array.isArray(enrollment) ? enrollment[0] : enrollment
  const ay = resolvedEnrollment?.academic_years
  const resolvedAy = Array.isArray(ay) ? ay[0] : ay
  const cls = resolvedEnrollment?.classes
  const resolvedCls = Array.isArray(cls) ? cls[0] : cls

  // Get total paid across all payments for this invoice to compute pending
  const { data: allPayments } = await supabase
    .from('fee_payments')
    .select('amount_paid, clearance_status')
    .eq('invoice_id', inv?.id)

  const totalPaid = allPayments
    ?.filter((p: any) => p.clearance_status === 'Cleared' || p.clearance_status === 'Pending')
    .reduce((a: number, p: any) => a + Number(p.amount_paid), 0) || 0
  const pendingFee = Math.max(0, Number(inv?.total_amount || 0) - totalPaid)

  // Get pocket money balance
  const studentId = resolvedStudent?.id || inv?.student_id
  let pocketBalance = 0
  if (studentId) {
    const { data: pmData } = await supabase
      .from('pocket_money_balances')
      .select('current_balance')
      .eq('student_id', studentId)
      .maybeSingle()
    pocketBalance = pmData?.current_balance || 0
  }

  return {
    receipt_number: payment.receipt_number,
    receipt_date: payment.payment_date,
    student_name: resolvedStudent ? `${resolvedStudent.first_name} ${resolvedStudent.last_name}` : 'Unknown',
    student_id: resolvedStudent?.admission_number || '',
    student_class: resolvedCls ? `${resolvedCls.grade_level} - ${resolvedCls.section}` : '',
    academic_year: resolvedAy?.name || '',
    fee_particular: inv?.invoice_title || 'Tuition Fee',
    amount_paid: Number(payment.amount_paid),
    pending_fee_balance: pendingFee,
    pocket_money_balance: pocketBalance,
    payment_mode: payment.payment_method || 'Cash',
    bank_name: payment.bank_name || '',
    utr_number: payment.transaction_reference || '',
    total_invoice_amount: Number(inv?.total_amount || 0)
  }
}

export async function getMorePocketMoneyTransactions(studentId: string, limit: number, offset: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pocket_money_transactions')
    .select('id, amount, description, transaction_type, created_at, staff(name), receipt_object_keys')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return { error: error.message, data: [] }
  return { data }
}

export async function getStudentFeeHistory(studentId: string, limit: number, offset: number) {
  const supabase = await createClient()

  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select('id, academic_years(name)')
    .eq('student_id', studentId)

  const enrollmentIds = enrollments?.map(e => e.id) || []

  let query = supabase
    .from('fee_invoices')
    .select(`id, invoice_title, total_amount, status, due_date, created_at, enrollment_id,
      fee_payments(id, receipt_number, amount_paid, payment_date, payment_method, bank_name,
        instrument_date, transaction_reference, clearance_status, clearance_date,
        clearance_remarks, created_at, receipt_object_keys, staff(name))`)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (enrollmentIds.length > 0) {
    query = query.or(`enrollment_id.in.(${enrollmentIds.join(',')}),student_id.eq.${studentId}`)
  } else {
    query = query.eq('student_id', studentId)
  }

  const { data, error } = await query

  if (error) return { error: error.message, data: [] }

  const mappedData = data.map((inv: any) => {
    const enr = enrollments?.find(e => e.id === inv.enrollment_id)
    return {
      ...inv,
      academic_year: Array.isArray(enr?.academic_years) ? enr?.academic_years[0]?.name : ((enr?.academic_years as any)?.name || 'Previous Arrears')
    }
  })

  return { data: mappedData }
}

export async function generateInvoiceForEnrollment(enrollmentId: string) {
  const supabase = await createClient()

  if (!enrollmentId) {
    return { error: 'Missing enrollment context. Please reload the page and try again.' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in.' }

  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (staffError || !staff) return { error: 'Staff record not found.' }
  if (!['Admin', 'Accountant'].includes(staff.role)) {
    return { error: 'Only Admin and Accountant can generate invoices.' }
  }

  const { data: enrollment, error: enrollmentError } = await supabase
    .from('student_enrollments')
    .select(`
      id,
      student_id,
      academic_year_id,
      class_id,
      discount_mode,
      discount_value,
      students(first_name, last_name, gender),
      academic_years(name),
      classes(grade_level, section)
    `)
    .eq('id', enrollmentId)
    .single()

  if (enrollmentError || !enrollment) {
    return { error: 'Enrollment not found for the selected academic year.' }
  }

  const { data: existingInvoice, error: invoiceCheckError } = await supabase
    .from('fee_invoices')
    .select('id')
    .eq('enrollment_id', enrollment.id)
    .limit(1)
    .maybeSingle()

  if (invoiceCheckError) {
    return { error: 'Could not validate existing invoice status. Please try again.' }
  }

  if (existingInvoice) {
    return { error: 'Invoice already exists for this student in the selected academic year.' }
  }

  const studentData = Array.isArray(enrollment.students) ? enrollment.students[0] : enrollment.students
  const yearData = Array.isArray(enrollment.academic_years) ? enrollment.academic_years[0] : enrollment.academic_years
  const classData = Array.isArray(enrollment.classes) ? enrollment.classes[0] : enrollment.classes

  const studentGender = studentData?.gender || 'All'
  const { data: configs, error: configError } = await supabase
    .from('fee_configurations')
    .select('id, gender, course_stream, base_fee_amount')
    .eq('academic_year_id', enrollment.academic_year_id)
    .eq('class_id', enrollment.class_id)
    .eq('course_stream', 'General')
    .in('gender', studentGender === 'All' ? ['All'] : [studentGender, 'All'])

  if (configError) {
    return { error: 'Failed to read fee configuration. Please try again.' }
  }

  if (!configs || configs.length === 0) {
    const studentName = `${studentData?.first_name || ''} ${studentData?.last_name || ''}`.trim() || 'this student'
    const classLabel = `${classData?.grade_level || 'N/A'}${classData?.section ? ` - ${classData.section}` : ''}`
    const yearLabel = yearData?.name || 'selected academic year'
    return {
      error: `No fee configuration found for ${yearLabel}, class ${classLabel}, stream General, and gender ${studentGender}. Please add the missing fee configuration before generating an invoice for ${studentName}.`
    }
  }

  const selectedConfig = selectFeeConfigurationByGender(configs, studentGender)

  if (!selectedConfig) {
    return { error: 'No matching fee configuration found for this student.' }
  }

  const baseFee = Number(selectedConfig.base_fee_amount)
  const discountMode = enrollment.discount_mode || 'Percentage'
  const discountValue = Number(enrollment.discount_value || 0)
  const finalFee = applyDiscount(baseFee, discountMode, discountValue)

  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)
  const invoiceTitle = buildInvoiceTitle({
    invoiceType: 'Hostel & Mess',
    academicYearName: yearData?.name || null,
    gradeLevel: classData?.grade_level || null,
    section: classData?.section || null,
    courseStream: selectedConfig.course_stream || null
  })

  const { error: createInvoiceError } = await supabase
    .from('fee_invoices')
    .insert({
      enrollment_id: enrollment.id,
      invoice_title: invoiceTitle,
      total_amount: finalFee,
      due_date: dueDate.toISOString().split('T')[0],
      status: 'Unpaid',
      created_by: staff.id
    })

  if (createInvoiceError) {
    return { error: `Failed to create invoice: ${createInvoiceError.message}` }
  }

  return {
    success: true,
    amount: finalFee,
    invoiceTitle,
    yearName: yearData?.name || null,
    studentName: `${studentData?.first_name || ''} ${studentData?.last_name || ''}`.trim() || null
  }
}

export async function addFeePaymentReceipt(paymentId: string, newKeys: string[]) {
  const supabase = await createClient()
  // Fetch existing keys first
  const { data: payment, error: fetchErr } = await supabase
    .from('fee_payments')
    .select('receipt_object_keys')
    .eq('id', paymentId)
    .single()
    
  if (fetchErr) return { error: fetchErr.message }
  
  const existingKeys = payment.receipt_object_keys || []
  const combinedKeys = [...existingKeys, ...newKeys]

  const { error } = await supabase
    .from('fee_payments')
    .update({ receipt_object_keys: combinedKeys })
    .eq('id', paymentId)

  if (error) return { error: error.message }
  return { success: true }
}
