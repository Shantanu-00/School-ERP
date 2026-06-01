import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// =========================================================================
// TYPES & STRUCTURAL INTERFACES
// =========================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendTemplateOptions {
  to: string;
  templateName: string;
  variables: string[];
}

interface ProviderResponse {
  success: boolean;
  messageId: string | null;
  errorMessage: string | null;
}

interface IWhatsAppProvider {
  sendTemplate(options: SendTemplateOptions): Promise<ProviderResponse>;
}

// =========================================================================
// STRATEGY ENGINE: VENDOR IMPLEMENTATIONS
// =========================================================================

/**
 * Strategy 1: Official Meta Cloud API (Direct TSP Setup)
 */
class MetaProvider implements IWhatsAppProvider {
  constructor(private phoneNumberId: string, private token: string) {}

  async sendTemplate(options: SendTemplateOptions): Promise<ProviderResponse> {
    try {
      console.log(`[MetaProvider] Outbound message trigger initiated to: ${options.to}`);
      const response = await fetch(`https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: options.to,
          type: "template",
          template: {
            name: options.templateName,
            language: { code: "en_US" },
            components: [
              {
                type: "body",
                parameters: options.variables.map(val => ({ type: "text", text: val }))
              }
            ]
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.error(`[MetaProvider] API error payload received:`, data);
        return { success: false, messageId: null, errorMessage: JSON.stringify(data) };
      }
      return { success: true, messageId: data.messages?.[0]?.id || null, errorMessage: null };
    } catch (err) {
      console.error(`[MetaProvider] Exception encountered: ${err.message}`);
      return { success: false, messageId: null, errorMessage: err.message };
    }
  }
}

/**
 * Strategy 2: UDO (Unique Digital Outreach)
 */
class UdoProvider extends MetaProvider implements IWhatsAppProvider {
  constructor(phoneNumberId: string, token: string) {
    const pId = phoneNumberId || Deno.env.get('UDO_PHONE_NUMBER_ID') || '';
    const tkn = token || Deno.env.get('UDO_ACCESS_TOKEN') || '';
    super(pId, tkn);
  }
}

/**
 * Strategy 3: MSG91 Outbound V5 Bulk Routing Engine
 */
class Msg91Provider implements IWhatsAppProvider {
  private authKey: string;
  private integratedNumber: string;

  constructor() {
    this.authKey = Deno.env.get('MSG91_AUTH_KEY') || '';
    this.integratedNumber = Deno.env.get('MSG91_INTEGRATED_NUMBER') || '';
  }

  async sendTemplate(options: SendTemplateOptions): Promise<ProviderResponse> {
    try {
      console.log(`[Msg91Provider] Compiling layout configuration maps to: ${options.to}`);
      const bodyComponents: Record<string, { type: string; value: string }> = {};
      options.variables.forEach((val, index) => {
        bodyComponents[`body_${index + 1}`] = { type: "text", value: val };
      });

      const response = await fetch("https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", {
        method: 'POST',
        headers: {
          'authkey': this.authKey,
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify({
          integrated_number: this.integratedNumber,
          content_type: "template",
          messaging_product: "whatsapp",
          payload: {
            type: "template",
            template: {
              name: options.templateName,
              language: { code: "en", policy: "deterministic" },
              to_and_components: [
                {
                  to: [options.to],
                  components: bodyComponents
                }
              ]
            }
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.error(`[Msg91Provider] Bulk engine rejected dispatch layout:`, data);
        return { success: false, messageId: null, errorMessage: JSON.stringify(data) };
      }
      return { success: true, messageId: data.bulkId || null, errorMessage: null };
    } catch (err) {
      console.error(`[Msg91Provider] Critical network failure: ${err.message}`);
      return { success: false, messageId: null, errorMessage: err.message };
    }
  }
}

/**
 * Strategy 4: Twilio Content API Service Layer (With Enhanced Logging)
 */
class TwilioProvider implements IWhatsAppProvider {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
    this.authToken = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
    this.fromNumber = Deno.env.get('TWILIO_FROM_NUMBER') || '';
  }

  async sendTemplate(options: SendTemplateOptions): Promise<ProviderResponse> {
    try {
      console.log(`[TwilioProvider] Initializing credentials and environment configuration variables...`);
      console.log(`[TwilioProvider] Account SID loaded: ${this.accountSid ? '✅ YES' : '❌ MISSING'}`);
      console.log(`[TwilioProvider] Auth Token loaded: ${this.authToken ? '✅ YES' : '❌ MISSING'}`);
      console.log(`[TwilioProvider] From Phone Number loaded: "${this.fromNumber}"`);

      // Resolves explicit system maps for Content API Template SIDs
      const envKey = `TWILIO_TEMPLATE_SID_${options.templateName.toUpperCase()}`;
      const templateSid = Deno.env.get(envKey) || options.templateName;
      console.log(`[TwilioProvider] Looking for Env Key: ${envKey}`);
      console.log(`[TwilioProvider] Resolved Template SID being dispatched: "${templateSid}"`);
      
      const contentVariables: Record<string, string> = {};
      options.variables.forEach((val, index) => {
        contentVariables[String(index + 1)] = val;
      });
      console.log(`[TwilioProvider] Formatted Key Position Variables:`, contentVariables);

      const params = new URLSearchParams();
      params.append('From', `whatsapp:${this.fromNumber}`);
      params.append('To', `whatsapp:${options.to.startsWith('+') ? options.to : '+' + options.to}`);
      params.append('ContentSid', templateSid);
      params.append('ContentVariables', JSON.stringify(contentVariables));

      console.log(`[TwilioProvider] Form-Data Raw Targets compiled. Destination "To": ${params.get('To')}`);

      const credentials = btoa(`${this.accountSid}:${this.authToken}`);

      console.log(`[TwilioProvider] Dispatching request thread to Twilio Programmable Messages API...`);
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      const responseText = await response.text();
      console.log(`[TwilioProvider] Raw API HTTP Response Status Code: ${response.status}`);
      console.log(`[TwilioProvider] Raw Response Object String: ${responseText}`);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (pErr) {
        console.error(`[TwilioProvider] Critical Parse Error: Response returned non-JSON data output.`);
        return { success: false, messageId: null, errorMessage: `Unparseable response text: ${responseText}` };
      }

      if (!response.ok) {
        console.error(`[TwilioProvider] Request rejected by Twilio Gateway backend infrastructure.`);
        return { success: false, messageId: null, errorMessage: JSON.stringify(data) };
      }

      console.log(`[TwilioProvider] Message dispatched successfully! Message SID: ${data.sid}`);
      return { success: true, messageId: data.sid || null, errorMessage: null };
    } catch (err) {
      console.error(`[TwilioProvider] Fatal thread transaction fault logic: ${err.message}`);
      return { success: false, messageId: null, errorMessage: err.message };
    }
  }
}

// =========================================================================
// PROVIDER FACTORY RUNTIME RESOLVER
// =========================================================================
class WhatsAppProviderFactory {
  static create(providerType: string, phoneId?: string, token?: string): IWhatsAppProvider {
    console.log(`[ProviderFactory] Resolving instance type matching code: "${providerType}"`);
    switch (providerType.toUpperCase()) {
      case 'META':
        return new MetaProvider(phoneId || '', token || '');
      case 'UDO':
        return new UdoProvider(phoneId || '', token || '');
      case 'MSG91':
        return new Msg91Provider();
      case 'TWILIO':
        return new TwilioProvider();
      default:
        throw new Error(`Unsupported WhatsApp infrastructure provider key: ${providerType}`);
    }
  }
}

// =========================================================================
// CORE SUPABASE EDGE FUNCTION PIPELINE
// =========================================================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log(`[Pipeline] Core edge function pipeline invoked successfully.`);
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Security Gate Enforcement
    const incomingSecret = req.headers.get('X-Internal-Secret')
    const expectedSecret = Deno.env.get('INTERNAL_WEBHOOK_SECRET')
    console.log(`[Pipeline] Verifying security signature validation token headers...`);
    
    if (!incomingSecret || incomingSecret !== expectedSecret) {
      console.error(`[Pipeline] Security rejection: Headers mismatch signature gate profiles.`);
      return new Response(JSON.stringify({ error: 'Unauthorized invocation block' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }

    const payload = await req.json()
    const { mode } = payload
    console.log(`[Pipeline] Valid payload parsed. Mode operation read target: "${mode}"`);

    // Pull system settings and check target provider configuration routing
    const activeProvider = Deno.env.get('WHATSAPP_PROVIDER') ?? 'META'
    const secretKey = Deno.env.get('DB_ENCRYPTION_KEY') ?? ''
    console.log(`[Pipeline] Master Environment Variable Router Configurer set to: [${activeProvider}]`);
    
    const { data: ws, error: wsError } = await supabaseAdmin
      .rpc('get_decrypted_whatsapp_settings', { secret_passphrase: secretKey })
      .single()

    if (wsError || !ws) {
      console.error(`[Pipeline] Warning: Decryption database settings lookup returned an error or was empty:`, wsError?.message);
    }

    // Initialize clean instance tracking pattern from factory configuration
    const messenger = WhatsAppProviderFactory.create(activeProvider, ws?.phone_number_id, ws?.decrypted_token);

    // =========================================================================
    // MODE A: AUTOMATED POCKET MONEY ALERTS (Webhook Driven)
    // =========================================================================
    if (mode === 'AUTOMATED_POCKET_MONEY') {
      const { record } = payload
      console.log(`[Pipeline Mode A] Micro ledger row database transaction interception read profile:`, record);
      
      if (!record?.student_id) {
        console.error(`[Pipeline Mode A] Aborting transaction thread: payload row metadata does not contain student_id profile identifier.`);
        return new Response(JSON.stringify({ error: 'Malformed webhook record profile data' }), { status: 400 })
      }
      
      const studentId = record.student_id

      const [balanceRes, configRes] = await Promise.all([
        supabaseAdmin.from('pocket_money_balances').select('current_balance').eq('student_id', studentId).single(),
        supabaseAdmin.from('pocket_money_config').select('low_balance_threshold, max_notifications_per_drop, is_automated_alerts_enabled').single()
      ])

      console.log(`[Pipeline Mode A] Wallet Balance Profile:`, balanceRes.data);
      console.log(`[Pipeline Mode A] Wallet Safety Threshold Configuration System:`, configRes.data);

      if (!balanceRes.data || !configRes.data) {
        console.warn(`[Pipeline Mode A] Suppression exception: Balance summary charts or notification threshold configs are blank.`);
        return new Response(JSON.stringify({ status: 'Skipped: Missing balance or configuration profiles' }))
      }

      if (configRes.data.is_automated_alerts_enabled === false) {
        console.log(`[Pipeline Mode A] Transaction skipped: Automated notifications disabled inside core UI control switch dashboard.`);
        return new Response(JSON.stringify({ status: 'Suppressed: Automated pocket money alerts are disabled by Admin' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        })
      }

      const currentBalance = parseFloat(balanceRes.data.current_balance)
      const threshold = parseFloat(configRes.data.low_balance_threshold)
      
      if (currentBalance >= threshold) {
        console.log(`[Pipeline Mode A] Suppression event: Student balance (${currentBalance}) stays above risk threshold boundary line (${threshold}).`);
        return new Response(JSON.stringify({ status: 'Skipped: Student wallet balance healthy' }))
      }

      const { data: alertState } = await supabaseAdmin
        .from('student_alert_states')
        .select('notifications_sent')
        .eq('student_id', studentId)
        .single()

      const sentCount = alertState ? alertState.notifications_sent : 0
      console.log(`[Pipeline Mode A] History alert registry log: Sent notification counter reads [${sentCount}/${configRes.data.max_notifications_per_drop}] matches.`);
      
      if (sentCount >= configRes.data.max_notifications_per_drop) {
        console.log(`[Pipeline Mode A] Pacing rules violation triggered: Student has exceeded the maximum sequence drop notifications ceiling cap limit.`);
        return new Response(JSON.stringify({ status: 'Suppressed: Maximum pacing limit met' }))
      }

      const { data: student } = await supabaseAdmin
        .from('students')
        .select('first_name, primary_contact_number')
        .eq('id', studentId)
        .single()

      if (!student?.primary_contact_number) {
        console.error(`[Pipeline Mode A] Absolute demographic error: Student registry missing an primary_contact_number address entry.`);
        throw new Error('Parent mobile destination value missing from profile record.')
      }

      const cleanPhone = student.primary_contact_number.replace(/\D/g, '')
      const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`
      console.log(`[Pipeline Mode A] Destination profile target resolved to clean number format string: "${formattedPhone}"`);

      console.log(`[Pipeline Mode A] Invoking polymorphic instance provider framework dispatch execution module...`);
      const trackingReceipt = await messenger.sendTemplate({
        to: formattedPhone,
        templateName: "pocket_money_low_alert",
        variables: [student.first_name, currentBalance.toFixed(2)]
      });

      console.log(`[Pipeline Mode A] Execution summary result received from active class driver instance:`, trackingReceipt);

      console.log(`[Pipeline Mode A] Committing logs metadata rows table trace context to public.whatsapp_logs...`);
      await supabaseAdmin.from('whatsapp_logs').insert({
        student_id: studentId,
        recipient_phone: student.primary_contact_number,
        message_type: 'LOW_BALANCE',
        meta_message_id: trackingReceipt.messageId,
        delivery_status: trackingReceipt.success ? 'Sent' : 'Failed',
        error_message: trackingReceipt.errorMessage
      })

      if (trackingReceipt.success) {
        console.log(`[Pipeline Mode A] Message verification validated. Updating tracking pacing limits map counter table...`);
        await supabaseAdmin.from('student_alert_states').upsert({
          student_id: studentId,
          notifications_sent: sentCount + 1,
          last_triggered_at: new Date().toISOString()
        })
      }
    }

    // =========================================================================
    // MODE B: OPTIMIZED MANUAL BULK FEE REMINDERS (Dashboard Panel Driven)
    // =========================================================================
    if (mode === 'MANUAL_FEE_REMINDER') {
      const { selectedRecords, staffId } = payload 
      console.log(`[Pipeline Mode B] Bulk manual ledger loop parsing sequence for records payload count: ${selectedRecords?.length}`);
      
      if (!selectedRecords || selectedRecords.length === 0) {
        return new Response(JSON.stringify({ status: 'Skipped: No bulk items specified' }))
      }

      const studentIds = selectedRecords.map((r: any) => r.student_id)
      const { data: studentsList, error: studentError } = await supabaseAdmin
        .from('students')
        .select('id, first_name, primary_contact_number')
        .in('id', studentIds)

      if (studentError || !studentsList) {
        throw new Error(`Bulk demographic profile lookup failed: ${studentError?.message}`)
      }

      const studentMap = new Map(studentsList.map(s => [s.id, s]))

      const executionPromises = selectedRecords.map(async (record: any) => {
        const student = studentMap.get(record.student_id)
        if (!student?.primary_contact_number) return

        const cleanPhone = student.primary_contact_number.replace(/\D/g, '')
        const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`

        try {
          const trackingReceipt = await messenger.sendTemplate({
            to: formattedPhone,
            templateName: "pending_fee_reminder",
            variables: [student.first_name, parseFloat(record.outstanding_amount).toFixed(2)]
          });

          await supabaseAdmin.from('whatsapp_logs').insert({
            student_id: record.student_id,
            recipient_phone: student.primary_contact_number,
            message_type: 'FEE_REMINDER',
            meta_message_id: trackingReceipt.messageId,
            delivery_status: trackingReceipt.success ? 'Sent' : 'Failed',
            error_message: trackingReceipt.errorMessage,
            logged_by: staffId
          })

        } catch (err) {
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
    console.error(`[Pipeline Critical System Fault Block]: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})