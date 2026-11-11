import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isAdminSession } from '@/lib/auth'
import { emailMode } from '@/lib/invitations/mailer'
import { InvitationsDashboard } from './_components/InvitationsDashboard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Invitations' }

export default async function InvitationsPage() {
  if (!await isAdminSession()) redirect('/admin/login')
  const mode = emailMode()
  return <InvitationsDashboard emailEnabled={mode !== 'off'} emailSimulated={mode === 'simulated'} />
}
