import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight options
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Initialize admin client to bypass Row Level Security (RLS) internals securely
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // --- SECURITY GUARD BLOCK ADDED HERE ---
    const incomingSecret = req.headers.get('X-Internal-Secret')
    const expectedSecret = Deno.env.get('INTERNAL_WEBHOOK_SECRET')
    if (!incomingSecret || incomingSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized invocation block' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }
    // ---------------------------------------

    const payload = await req.json()
    const { mode } = payload // Expected: 'AUTOMATED_POCKET_MONEY' or 'MANUAL_FEE_REMINDER'

    // 2. Fetch and decrypt the single school's Meta credentials entirely in-memory
    const secretKey = Deno.env.get('DB_ENCRYPTION_KEY') ?? ''
    const { data: ws, error: wsError } = await supabaseAdmin
      .rpc('get_decrypted_whatsapp_settings', { secret_passphrase: secretKey })
      .single()

    if (wsError || !ws) {
      throw new Error(`WhatsApp Credentials missing or decryption failed: ${wsError?.message}`)
    }

    const { phone_number_id, decrypted_token } = ws

    // =========================================================================
    // MODE A: AUTOMATED POCKET MONEY ALERTS (Triggered via DB Webhook)
    // =========================================================================
    if (mode === 'AUTOMATED_POCKET_MONEY') {
      const { record } = payload
      if (!record || !record.student_id) {
        return new Response(JSON.stringify({ error: 'Malformed webhook record data' }), { status: 400 })
      }
      
      const studentId = record.student_id

      // Fetch wallet balance and school thresholds
      const [balanceRes, configRes] = await Promise.all([
        supabaseAdmin.from('pocket_money_balances').select('current_balance').eq('student_id', studentId).single(),
        supabaseAdmin.from('pocket_money_config').select('low_balance_threshold, max_notifications_per_drop').single()
      ])

      if (!balanceRes.data || !configRes.data) {
        return new Response(JSON.stringify({ status: 'Skipped: Missing balance or configuration profiles' }))
      }

      const currentBalance = parseFloat(balanceRes.data.current_balance)
      const threshold = parseFloat(configRes.data.low_balance_threshold)
      
      if (currentBalance >= threshold) {
        return new Response(JSON.stringify({ status: 'Skipped: Student wallet balance healthy' }))
      }

      // Evaluate anti-spam counter boundaries
      const { data: alertState } = await supabaseAdmin
        .from('student_alert_states')
        .select('notifications_sent')
        .eq('student_id', studentId)
        .single()

      const sentCount = alertState ? alertState.notifications_sent : 0
      if (sentCount >= configRes.data.max_notifications_per_drop) {
        return new Response(JSON.stringify({ status: 'Suppressed: Maximum pacing limit met' }))
      }

      // Fetch target parent contact details
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('first_name, primary_contact_number')
        .eq('id', studentId)
        .single()

      if (!student?.primary_contact_number) {
        throw new Error('Parent mobile destination value missing from profile record.')
      }

      // Phone Normalization Guard for Indian Numbers
      const cleanPhone = student.primary_contact_number.replace(/\D/g, '')
      const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`

      // Fire payload to Meta Cloud API
      const metaResponse = await fetch(`https://graph.facebook.com/v21.0/${phone_number_id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${decrypted_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: formattedPhone,
          type: "template",
          template: {
            name: "pocket_money_low_alert",
            language: { code: "en_US" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: student.first_name },
                  { type: "text", text: currentBalance.toFixed(2) }
                ]
              }
            ]
          }
        })
      })

      const metaData = await metaResponse.json()

      // Log transaction footprint and increment safety counter state
      await supabaseAdmin.from('whatsapp_logs').insert({
        student_id: studentId,
        recipient_phone: student.primary_contact_number,
        message_type: 'LOW_BALANCE',
        meta_message_id: metaData.messages?.[0]?.id || null,
        delivery_status: metaResponse.ok ? 'Sent' : 'Failed',
        error_message: metaResponse.ok ? null : JSON.stringify(metaData)
      })

      if (metaResponse.ok) {
        await supabaseAdmin.from('student_alert_states').upsert({
          student_id: studentId,
          notifications_sent: sentCount + 1,
          last_triggered_at: new Date().toISOString()
        })
      }
    }

    // =========================================================================
    // MODE B: OPTIMIZED MANUAL BULK FEE REMINDERS (Triggered via Frontend Panel)
    // =========================================================================
    if (mode === 'MANUAL_FEE_REMINDER') {
      const { selectedRecords, staffId } = payload // Expects array of { student_id, outstanding_amount }
      
      if (!selectedRecords || selectedRecords.length === 0) {
        return new Response(JSON.stringify({ status: 'Skipped: No bulk items specified' }))
      }

      // Extract unique IDs to execute a single unified batch look-up query
      const studentIds = selectedRecords.map((r: any) => r.student_id)
      const { data: studentsList, error: studentError } = await supabaseAdmin
        .from('students')
        .select('id, first_name, primary_contact_number')
        .in('id', studentIds)

      if (studentError || !studentsList) {
        throw new Error(`Bulk demographic profile lookup failed: ${studentError?.message}`)
      }

      // Create an optimized O(1) memory map for low latency data mapping
      const studentMap = new Map(studentsList.map(s => [s.id, s]))

      // Process and stream web requests concurrently via Promise.all mapping mechanics
      const executionPromises = selectedRecords.map(async (record: any) => {
        const student = studentMap.get(record.student_id)
        if (!student || !student.primary_contact_number) return

        // Sanitize string to enforce Meta standard format parameters
        const cleanPhone = student.primary_contact_number.replace(/\D/g, '')
        const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`

        try {
          const metaResponse = await fetch(`https://graph.facebook.com/v21.0/${phone_number_id}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${decrypted_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: formattedPhone,
              type: "template",
              template: {
                name: "pending_fee_reminder",
                language: { code: "en_US" },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: student.first_name },
                      { type: "text", text: parseFloat(record.outstanding_amount).toFixed(2) }
                    ]
                  }
                ]
              }
            })
          })

          const metaData = await metaResponse.json()

          await supabaseAdmin.from('whatsapp_logs').insert({
            student_id: record.student_id,
            recipient_phone: student.primary_contact_number,
            message_type: 'FEE_REMINDER',
            meta_message_id: metaData.messages?.[0]?.id || null,
            delivery_status: metaResponse.ok ? 'Sent' : 'Failed',
            error_message: metaResponse.ok ? null : JSON.stringify(metaData),
            logged_by: staffId
          })

        } catch (err) {
          // Prevent individual execution errors from crashing the overall promise queue
          await supabaseAdmin.from('whatsapp_logs').insert({
            student_id: record.student_id,
            recipient_phone: student.primary_contact_number,
            message_type: 'FEE_REMINDER',
            delivery_status: 'Failed',
            error_message: `Network Execution Thread Error: ${err.message}`,
            logged_by: staffId
          })
        }
      })

      await Promise.all(executionPromises)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})