import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  getWhatsAppSettings,
  getPocketMoneyConfig,
  getWhatsAppLogs,
} from '@/actions/whatsapp.actions'
import { WhatsAppSettingsClient } from './WhatsAppSettingsClient'

export default async function WhatsAppSettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: staffData } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (staffData?.role !== 'Admin') redirect('/messages')

  const [{ data: settings }, { data: pmConfig }, { data: logs }] = await Promise.all([
    getWhatsAppSettings(),
    getPocketMoneyConfig(),
    getWhatsAppLogs(),
  ])

  return (
    <WhatsAppSettingsClient
      settings={settings}
      pmConfig={pmConfig}
      logs={logs ?? []}
    />
  )
}
