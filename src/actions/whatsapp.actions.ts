'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success?: boolean; error?: string }

// ─── Types ──────────────────────────────────────────────────────────────────

export type WhatsAppSettingsRow = {
  waba_id: string
  phone_number_id: string
  display_phone_number: string
  has_token: boolean
  updated_at: string | null
}

export type PocketMoneyConfigRow = {
  low_balance_threshold: number
  max_notifications_per_drop: number
  is_automated_alerts_enabled: boolean
}

export type WhatsAppLogRow = {
  id: string
  student_id: string | null
  recipient_phone: string
  message_type: 'LOW_BALANCE' | 'FEE_REMINDER'
  delivery_status: 'Sent' | 'Delivered' | 'Read' | 'Failed'
  error_message: string | null
  created_at: string
  students: { first_name: string; last_name: string } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', supabase: null, staffId: null }

  const { data: staffData } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (staffData?.role !== 'Admin') return { error: 'Admin access required', supabase: null, staffId: null }
  return { supabase, staffId: staffData.id as string, error: null }
}

// ─── Read Actions ─────────────────────────────────────────────────────────────

export async function getWhatsAppSettings(): Promise<{ data: WhatsAppSettingsRow | null; error: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('whatsapp_settings')
    .select('waba_id, phone_number_id, display_phone_number, updated_at')
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: null }

  // Separately check if a token row exists (we never expose the encrypted bytes to the frontend)
  const { count } = await supabase
    .from('whatsapp_settings')
    .select('id', { count: 'exact', head: true })

  return {
    data: {
      waba_id: data.waba_id,
      phone_number_id: data.phone_number_id,
      display_phone_number: data.display_phone_number,
      has_token: (count ?? 0) > 0,
      updated_at: data.updated_at,
    },
    error: null,
  }
}

export async function getPocketMoneyConfig(): Promise<{ data: PocketMoneyConfigRow | null; error: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pocket_money_config')
    .select('low_balance_threshold, max_notifications_per_drop, is_automated_alerts_enabled')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  return { data: data as PocketMoneyConfigRow | null, error: null }
}

export async function getWhatsAppLogs(): Promise<{ data: WhatsAppLogRow[]; error: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('whatsapp_logs')
    .select('id, student_id, recipient_phone, message_type, delivery_status, error_message, created_at, students(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return { data: [], error: error.message }
  // Supabase returns students as an array for join queries; normalise to single object
  const normalised = (data ?? []).map((row: any) => ({
    ...row,
    students: Array.isArray(row.students) ? (row.students[0] ?? null) : row.students,
  })) as WhatsAppLogRow[]
  return { data: normalised, error: null }
}

// ─── Write Actions ────────────────────────────────────────────────────────────

// NOTE: This action requires the following Postgres function in Supabase SQL editor:
//
// CREATE OR REPLACE FUNCTION public.upsert_whatsapp_settings(
//   p_waba_id TEXT, p_phone_number_id TEXT, p_display_phone_number TEXT,
//   p_plain_token TEXT, p_passphrase TEXT
// ) RETURNS VOID AS $$
// BEGIN
//   DELETE FROM public.whatsapp_settings;
//   INSERT INTO public.whatsapp_settings (waba_id, phone_number_id, display_phone_number, encrypted_access_token)
//   VALUES (p_waba_id, p_phone_number_id, p_display_phone_number, pgp_sym_encrypt(p_plain_token, p_passphrase));
// END;
// $$ LANGUAGE plpgsql SECURITY DEFINER;
export async function saveWhatsappCredentials(formData: FormData): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error || !supabase) return { error: error ?? 'Unauthorized' }

  const waba_id = (formData.get('waba_id') as string)?.trim()
  const phone_number_id = (formData.get('phone_number_id') as string)?.trim()
  const display_phone_number = (formData.get('display_phone_number') as string)?.trim()
  const plain_token = (formData.get('access_token') as string)?.trim()

  if (!waba_id || !phone_number_id || !display_phone_number) {
    return { error: 'WABA ID, Phone Number ID, and Display Phone are all required.' }
  }

  if (plain_token) {
    const passphrase = process.env.DB_ENCRYPTION_KEY
    if (!passphrase) {
      return { error: 'DB_ENCRYPTION_KEY environment variable is not set on the server.' }
    }

    const { error: rpcError } = await supabase.rpc('upsert_whatsapp_settings', {
      p_waba_id: waba_id,
      p_phone_number_id: phone_number_id,
      p_display_phone_number: display_phone_number,
      p_plain_token: plain_token,
      p_passphrase: passphrase,
    })
    if (rpcError) return { error: rpcError.message }
  } else {
    // Update non-sensitive fields only — preserve the existing encrypted token
    const { data: existing } = await supabase
      .from('whatsapp_settings')
      .select('id')
      .maybeSingle()

    if (!existing) {
      return { error: 'No existing record found. Please provide the Access Token for the initial setup.' }
    }

    const { error: updateError } = await supabase
      .from('whatsapp_settings')
      .update({
        waba_id,
        phone_number_id,
        display_phone_number,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (updateError) return { error: updateError.message }
  }

  revalidatePath('/messages/settings')
  return { success: true }
}

export async function savePocketMoneyConfig(formData: FormData): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error || !supabase) return { error: error ?? 'Unauthorized' }

  const raw_threshold = formData.get('low_balance_threshold') as string
  const raw_max = formData.get('max_notifications_per_drop') as string
  const is_automated_alerts_enabled = formData.get('is_automated_alerts_enabled') === 'true'

  const low_balance_threshold = parseFloat(raw_threshold)
  const max_notifications_per_drop = parseInt(raw_max, 10)

  if (isNaN(low_balance_threshold) || low_balance_threshold < 0) {
    return { error: 'Enter a valid threshold amount (₹0 or more).' }
  }
  if (isNaN(max_notifications_per_drop) || max_notifications_per_drop < 1 || max_notifications_per_drop > 10) {
    return { error: 'Max notifications must be between 1 and 10.' }
  }

  const { error: updateError } = await supabase
    .from('pocket_money_config')
    .update({
      low_balance_threshold,
      max_notifications_per_drop,
      is_automated_alerts_enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', '00000000-0000-0000-0000-000000000001')

  if (updateError) return { error: updateError.message }

  revalidatePath('/messages/settings')
  return { success: true }
}

// ─── Fee Reminder Types ───────────────────────────────────────────────────────

export type FeeReminderStudent = {
  id: string
  admission_number: string
  first_name: string
  last_name: string
  grade_level: string | null
  section: string | null
  primary_contact_number: string | null
  outstanding_amount: number // sum of unpaid invoices minus payments, >0 guaranteed
}

export type FeeReminderGroup = {
  student_status: 'Active' | 'Alumni' | 'Dropout'
  class_id?: string | null // null/undefined = all classes for that status
}

export type SendFeeRemindersResult = {
  sent: number
  failed: number
  skipped: number // no phone number
  error?: string
}

// ─── Fee Reminder Actions ─────────────────────────────────────────────────────

async function requireAdminOrAccountant() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', supabase: null, staff: null }
  const { data: staffData } = await supabase
    .from('staff').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!staffData || !['Admin', 'Accountant'].includes(staffData.role))
    return { error: 'Permission denied', supabase: null, staff: null }
  return { supabase, staff: staffData, error: null }
}

export async function getFeeReminderStudents(
  group: FeeReminderGroup,
  yearId: string,
): Promise<{ data: FeeReminderStudent[]; error: string | null }> {
  const { supabase, error } = await requireAdminOrAccountant()
  if (error || !supabase) return { data: [], error: error ?? 'Unauthorized' }

  // ── Step 1: Identify which students belong to the selected group ──────────
  // Use the current-year enrollment purely for group membership (class filter)
  // and to resolve the display class. We do NOT limit fee lookup to this year.
  let memberQuery = supabase
    .from('students')
    .select(
      'id, admission_number, first_name, last_name, primary_contact_number, ' +
      'student_enrollments!inner(id, class_id, classes(grade_level, section))',
    )
    .eq('student_enrollments.academic_year_id', yearId)
    .eq('status', group.student_status)
    .order('first_name')
    .limit(500)

  if (group.class_id) {
    memberQuery = memberQuery.eq('student_enrollments.class_id', group.class_id)
  }

  const { data: members, error: membersError } = await memberQuery
  if (membersError) return { data: [], error: membersError.message }
  if (!members || members.length === 0) return { data: [], error: null }

  const studentIds = (members as any[]).map((s: any) => s.id)

  // ── Step 2: Resolve current-year class info per student ───────────────────
  // (used only for display — the fee query covers ALL years below)
  const classInfoById: Record<string, { grade_level: string | null; section: string | null }> = {}
  for (const s of members as any[]) {
    const enrollList = Array.isArray(s.student_enrollments)
      ? s.student_enrollments
      : s.student_enrollments ? [s.student_enrollments] : []
    for (const enr of enrollList) {
      if (!classInfoById[s.id] && enr.classes) {
        const cls = Array.isArray(enr.classes) ? enr.classes[0] : enr.classes
        classInfoById[s.id] = { grade_level: cls?.grade_level ?? null, section: cls?.section ?? null }
      }
    }
  }

  // ── Step 3: Fetch ALL enrollment IDs for these students (across all years) ─
  // This is what makes past-year dues show up correctly.
  const { data: allEnrollments, error: enrollErr } = await supabase
    .from('student_enrollments')
    .select('id, student_id')
    .in('student_id', studentIds)

  if (enrollErr) return { data: [], error: enrollErr.message }

  const allEnrollmentIds = (allEnrollments ?? []).map((e: any) => e.id)
  // Map enrollment_id → student_id for later attribution
  const studentByEnrollment: Record<string, string> = {}
  for (const e of allEnrollments ?? []) {
    studentByEnrollment[e.id] = e.student_id
  }

  // ── Step 4: Fetch ALL unpaid / partial invoices for these students ─────────
  // Two sources:
  //   A) Invoices linked via enrollment_id (the normal path)
  //   B) Invoices linked directly via student_id with enrollment_id IS NULL
  //      (direct invoices created from the student fee page)
  // Run both invoice fetches in parallel then merge
  const [enrollmentInvoicesRes, directInvoicesRes] = await Promise.all([
    // Path A: invoices attached to any of the student's enrollments (all years)
    allEnrollmentIds.length > 0
      ? supabase
          .from('fee_invoices')
          .select('id, enrollment_id, student_id, total_amount, status')
          .in('enrollment_id', allEnrollmentIds)
          .in('status', ['Unpaid', 'Partial'])
      : Promise.resolve({ data: [], error: null }),

    // Path B: direct invoices with no enrollment (linked only via student_id)
    supabase
      .from('fee_invoices')
      .select('id, enrollment_id, student_id, total_amount, status')
      .in('student_id', studentIds)
      .is('enrollment_id', null)
      .in('status', ['Unpaid', 'Partial']),
  ])

  if (enrollmentInvoicesRes.error) return { data: [], error: enrollmentInvoicesRes.error.message }
  if (directInvoicesRes.error)    return { data: [], error: directInvoicesRes.error.message }

  // Merge and deduplicate by invoice id
  const invoiceMap: Record<string, any> = {}
  for (const inv of [...(enrollmentInvoicesRes.data ?? []), ...(directInvoicesRes.data ?? [])]) {
    invoiceMap[inv.id] = inv
  }
  const allInvoices = Object.values(invoiceMap)

  if (allInvoices.length === 0) return { data: [], error: null }

  // ── Step 5: Fetch all payments for these invoices ──────────────────────────
  const invoiceIds = allInvoices.map((inv: any) => inv.id)
  const { data: payments, error: paymentsError } = await supabase
    .from('fee_payments')
    .select('invoice_id, amount_paid')
    .in('invoice_id', invoiceIds)

  if (paymentsError) return { data: [], error: paymentsError.message }

  // Build payment totals: invoice_id → total paid so far
  const paymentsByInvoice: Record<string, number> = {}
  for (const p of payments ?? []) {
    paymentsByInvoice[p.invoice_id] = (paymentsByInvoice[p.invoice_id] ?? 0) + Number(p.amount_paid)
  }

  // ── Step 6: Attribute each invoice's outstanding balance to its student ────
  // outstanding = total_amount − total_paid  (capped at 0, never negative)
  const outstandingByStudent: Record<string, number> = {}

  for (const inv of allInvoices) {
    // Resolve owner: prefer direct student_id, then look up via enrollment
    const sid: string | null =
      inv.student_id ??
      (inv.enrollment_id ? studentByEnrollment[inv.enrollment_id] : null)

    if (!sid) continue // can't attribute — skip

    const paid = paymentsByInvoice[inv.id] ?? 0
    const owed = Math.max(0, Number(inv.total_amount) - paid)
    outstandingByStudent[sid] = (outstandingByStudent[sid] ?? 0) + owed
  }

  // ── Step 7: Build result — only students with outstanding > 0 ─────────────
  const result: FeeReminderStudent[] = []

  for (const s of members as any[]) {
    const outstanding = outstandingByStudent[s.id] ?? 0
    if (outstanding <= 0) continue

    const cls = classInfoById[s.id]
    result.push({
      id: s.id,
      admission_number: s.admission_number,
      first_name: s.first_name,
      last_name: s.last_name,
      grade_level: cls?.grade_level ?? null,
      section: cls?.section ?? null,
      primary_contact_number: s.primary_contact_number ?? null,
      outstanding_amount: outstanding,
    })
  }

  result.sort((a, b) => b.outstanding_amount - a.outstanding_amount)
  return { data: result, error: null }
}

export async function sendFeeRemindersAction(
  records: { student_id: string; outstanding_amount: number }[],
): Promise<SendFeeRemindersResult> {
  // Step 1: Auth check
  const { supabase, staff, error } = await requireAdminOrAccountant()
  if (error || !supabase || !staff) return { sent: 0, failed: 0, skipped: 0, error: error ?? 'Unauthorized' }

  // Step 2: Validate
  if (!records || records.length === 0) {
    return { sent: 0, failed: 0, skipped: 0, error: 'No records provided.' }
  }

  // Step 3-4: Build URLs and get secret
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.INTERNAL_WEBHOOK_SECRET

  // Step 5: Validate env vars
  if (!supabaseUrl || !secret) {
    return {
      sent: 0,
      failed: 0,
      skipped: 0,
      error: 'Server configuration missing: INTERNAL_WEBHOOK_SECRET or SUPABASE_URL not set.',
    }
  }

  const edgeFunctionUrl = supabaseUrl + '/functions/v1/whatsapp-engine'

  // Step 6: Fetch phone numbers to find students without one
  const studentIds = records.map((r) => r.student_id)
  const { data: studentPhones, error: phonesError } = await supabase
    .from('students')
    .select('id, primary_contact_number')
    .in('id', studentIds)

  if (phonesError) return { sent: 0, failed: 0, skipped: 0, error: phonesError.message }

  const phoneMap: Record<string, string | null> = {}
  for (const s of studentPhones ?? []) {
    phoneMap[s.id] = s.primary_contact_number ?? null
  }

  // Step 7: Split into withPhone and skipped
  const withPhone = records.filter((r) => !!phoneMap[r.student_id])
  const skippedCount = records.length - withPhone.length

  // Step 8: If nobody has a phone, return early
  if (withPhone.length === 0) {
    return { sent: 0, failed: 0, skipped: records.length }
  }

  // Step 9-12: Call edge function
  try {
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': secret,
      },
      body: JSON.stringify({
        mode: 'MANUAL_FEE_REMINDER',
        selectedRecords: withPhone.map((r) => ({
          student_id: r.student_id,
          outstanding_amount: r.outstanding_amount,
        })),
        staffId: staff.id,
      }),
    })

    // Step 10: Handle non-ok response
    if (!response.ok) {
      const responseText = await response.text().catch(() => 'Unknown error')
      return {
        sent: 0,
        failed: withPhone.length,
        skipped: skippedCount,
        error: 'Edge function returned an error: ' + responseText,
      }
    }

    // Step 11: Success
    return { sent: withPhone.length, failed: 0, skipped: skippedCount }
  } catch (networkError: any) {
    // Step 12: Network failure
    return {
      sent: 0,
      failed: withPhone.length,
      skipped: skippedCount,
      error: 'Network error calling edge function: ' + (networkError?.message ?? String(networkError)),
    }
  }
}
