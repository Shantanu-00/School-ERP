'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { applyDiscount, buildInvoiceTitle, selectFeeConfigurationByGender } from '@/lib/invoice'

type DiscountUpdateInput = {
  discount_type: string
  discount_mode: 'Percentage' | 'Fixed'
  discount_value: number
}

export async function fetchPromotionStudents(fromYearId: string, toYearId: string, classId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get from-year enrollments
  // Also fetch fee_invoices to calculate pending fees
  const { data: fromEnrollments, error: fromError } = await supabase
    .from('student_enrollments')
    .select(`
      id, student_id, roll_number, discount_type, discount_mode, discount_value,
      students!inner(admission_number, first_name, last_name, status),
      fee_invoices(total_amount, status, fee_payments(amount_paid))
    `)
    .eq('academic_year_id', fromYearId)
    .eq('class_id', classId)

  if (fromError) throw new Error(fromError.message)
  if (!fromEnrollments || fromEnrollments.length === 0) return []

  const studentIds = fromEnrollments.map(e => e.student_id)

  // Get to-year enrollments for these students to see if they are already processed
  const { data: toEnrollments, error: toError } = await supabase
    .from('student_enrollments')
    .select('student_id')
    .eq('academic_year_id', toYearId)
    .in('student_id', studentIds)

  if (toError) throw new Error(toError.message)

  const processedStudentIds = new Set((toEnrollments || []).map(e => e.student_id))

  // Combine
  return fromEnrollments.map(enr => {
    const s = Array.isArray(enr.students) ? enr.students[0] : enr.students;
    
    // Calculate pending fees correctly for this enrollment
    let pendingFees = 0;
    if (enr.fee_invoices && Array.isArray(enr.fee_invoices)) {
      enr.fee_invoices.forEach((inv: { status: string, total_amount: string | number, fee_payments?: { amount_paid: string | number }[] }) => {
         if (inv.status !== 'Cancelled') {
            const paid = Array.isArray(inv.fee_payments) 
               ? inv.fee_payments.reduce((acc: number, p: { amount_paid: string | number }) => acc + Number(p.amount_paid), 0)
               : 0;
            pendingFees += (Number(inv.total_amount) - paid);
         }
      })
    }

    return {
      student_id: enr.student_id,
      enrollment_id: enr.id,
      admission_number: s?.admission_number,
      first_name: s?.first_name,
      last_name: s?.last_name,
      roll_number: enr.roll_number,
      current_status: s?.status,
      discount_type: enr.discount_type,
      discount_mode: enr.discount_mode,
      discount_value: Number(enr.discount_value || 0),
      pending_fees: pendingFees,
      status: s?.status === 'Alumni' ? 'Alumni' : s?.status === 'Dropout' ? 'Dropout' : processedStudentIds.has(enr.student_id) ? 'Processed (In Next Year)' : 'Pending'
    }
  }).sort((a, b) => (a.roll_number || 0) - (b.roll_number || 0))
}

export type PromotionInstruction = {
  student_id: string
  actionType: 'promote' | 'alumni' | 'dropout' | 'fail'
  targetClassId?: string | null
  roll_number?: number
  discount_type: string
  discount_mode: 'Percentage' | 'Fixed'
  discount_value: number
}

export async function promoteStudents(
  fromYearId: string, 
  toYearId: string, 
  instructions: PromotionInstruction[],
  generateInvoices: boolean = true
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: staffData } = await supabase.from('staff').select('id, role').eq('auth_id', user.id).single()
  if (staffData?.role !== 'Admin') throw new Error('Only Admins can perform this action')

  if (!instructions || instructions.length === 0) return { success: true }

  const studentIds = instructions.map(inst => inst.student_id)

  const promoteEnrolls: PromotionInstruction[] = []
  const statusUpdates: { id: string, status: string }[] = []

  for (const inst of instructions) {
    if (inst.actionType === 'alumni' || inst.actionType === 'dropout') {
      statusUpdates.push({ id: inst.student_id, status: inst.actionType === 'alumni' ? 'Alumni' : 'Dropout' })
    } else if (inst.actionType === 'promote' || inst.actionType === 'fail') {
      if (!inst.targetClassId) throw new Error(`Missing target class for student ${inst.student_id} action ${inst.actionType}`)
      promoteEnrolls.push(inst)
      statusUpdates.push({ id: inst.student_id, status: 'Active' })
    }
  }

  // Update statuses
  if (statusUpdates.length > 0) {
    // Supabase JS doesn't have an easy bulk update with varied values, but we have 'Active', 'Alumni', 'Dropout'
    const statusGroups = {
      Active: statusUpdates.filter(s => s.status === 'Active').map(s => s.id),
      Alumni: statusUpdates.filter(s => s.status === 'Alumni').map(s => s.id),
      Dropout: statusUpdates.filter(s => s.status === 'Dropout').map(s => s.id)
    };

    if (statusGroups.Active.length > 0) {
      await supabase.from('students').update({ status: 'Active' }).in('id', statusGroups.Active);
    }
    if (statusGroups.Alumni.length > 0) {
      await supabase.from('students').update({ status: 'Alumni' }).in('id', statusGroups.Alumni);
    }
    if (statusGroups.Dropout.length > 0) {
      await supabase.from('students').update({ status: 'Dropout' }).in('id', statusGroups.Dropout);
    }
  }

  // Handle promote/fail enrollments
  if (promoteEnrolls.length > 0) {
    const newRows = promoteEnrolls.map(inst => ({
      student_id: inst.student_id,
      academic_year_id: toYearId,
      class_id: inst.targetClassId,
      roll_number: inst.roll_number,
      discount_type: inst.discount_type || 'None',
      discount_value: inst.discount_type === 'None' ? 0 : Number(inst.discount_value || 0),
      discount_mode: inst.discount_mode || 'Percentage'
    }))

    // Check for duplicate enrollments before upsert
    // To do that, we upsert, and assume we're fine since it handles conflict
    if (newRows.length > 0) {
      const { error: insertError } = await supabase
        .from('student_enrollments')
        .upsert(newRows, { onConflict: 'student_id, academic_year_id' }) // Ensure no duplicates
        
      if (insertError) throw new Error(insertError.message)
    }

    if (!generateInvoices) {
      revalidatePath('/students')
      revalidatePath('/settings/promotions')
      return {
        success: true,
        message: 'Promotion completed. No invoices were generated as requested.'
      }
    }

    const { data: newEnrollments, error: newEnrollmentError } = await supabase
      .from('student_enrollments')
      .select(`
        id,
        student_id,
        academic_year_id,
        class_id,
        discount_mode,
        discount_value,
        students(gender),
        academic_years(name),
        classes(grade_level, section)
      `)
      .eq('academic_year_id', toYearId)
      .in('student_id', promoteEnrolls.map(i => i.student_id))

    if (newEnrollmentError) {
      throw new Error(`Promotion completed, but failed to fetch new enrollments for invoice generation: ${newEnrollmentError.message}`)
    }

    const { data: existingInvoices, error: invoiceLookupError } = await supabase
      .from('fee_invoices')
      .select('enrollment_id')
      .in('enrollment_id', (newEnrollments || []).map((row) => row.id))

    if (invoiceLookupError) {
      throw new Error(`Promotion completed, but failed while checking existing invoices: ${invoiceLookupError.message}`)
    }

    const existingEnrollmentInvoiceSet = new Set((existingInvoices || []).map((row) => row.enrollment_id))

    // Group enrollments by class to fetch fee configurations
    const classIds = [...new Set(newEnrollments?.map(e => e.class_id) || [])]
    const { data: configs, error: configError } = await supabase
      .from('fee_configurations')
      .select('class_id, gender, course_stream, base_fee_amount')
      .eq('academic_year_id', toYearId)
      .in('class_id', classIds)
      .eq('course_stream', 'General')

    if (configError) {
      throw new Error(`Promotion completed, but failed to read fee configuration for invoice generation: ${configError.message}`)
    }

    const invoiceRows: Array<{
      enrollment_id: string
      invoice_title: string
      total_amount: number
      due_date: string
      status: 'Unpaid'
      created_by: string
    }> = []

    let skippedInvoiceCount = 0
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    for (const enrollment of newEnrollments || []) {
      if (existingEnrollmentInvoiceSet.has(enrollment.id)) {
        continue
      }

      const studentData = Array.isArray(enrollment.students) ? enrollment.students[0] : enrollment.students
      const yearData = Array.isArray(enrollment.academic_years) ? enrollment.academic_years[0] : enrollment.academic_years
      const classData = Array.isArray(enrollment.classes) ? enrollment.classes[0] : enrollment.classes

      const matchingConfigs = (configs || []).filter(c => c.class_id === enrollment.class_id)
      const selectedConfig = selectFeeConfigurationByGender(matchingConfigs, studentData?.gender || 'All')
      if (!selectedConfig) {
        skippedInvoiceCount += 1
        continue
      }

      const totalAmount = applyDiscount(
        Number(selectedConfig.base_fee_amount || 0),
        enrollment.discount_mode || 'Percentage',
        Number(enrollment.discount_value || 0)
      )

      invoiceRows.push({
        enrollment_id: enrollment.id,
        invoice_title: buildInvoiceTitle({
          invoiceType: 'Tuition Fee',
          academicYearName: yearData?.name || null,
          gradeLevel: classData?.grade_level || null,
          section: classData?.section || null,
          courseStream: selectedConfig.course_stream || null
        }),
        total_amount: totalAmount,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'Unpaid',
        created_by: staffData.id
      })
    }

    if (invoiceRows.length > 0) {
      const { error: invoiceInsertError } = await supabase
        .from('fee_invoices')
        .insert(invoiceRows)

      if (invoiceInsertError) {
        throw new Error(`Promotion completed, but failed to generate invoices: ${invoiceInsertError.message}`)
      }
    }

    revalidatePath('/students')
    revalidatePath('/finance')
    revalidatePath('/settings/promotions')

    const generatedInvoices = invoiceRows.length
    const skippedNote = skippedInvoiceCount > 0
      ? ` ${skippedInvoiceCount} invoice(s) skipped because no fee configuration matched.`
      : ''

    return {
      success: true,
      message: `Promotion completed. ${generatedInvoices} invoice(s) generated.${skippedNote}`
    }
  }

  revalidatePath('/students')
  revalidatePath('/settings/promotions')
  return { success: true, message: 'Operation completed successfully.' }
}
