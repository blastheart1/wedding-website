import type { Metadata } from 'next'
import { emailMode } from '@/lib/invitations/mailer'
import { InvitationsDashboard } from './_components/InvitationsDashboard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Invitations' }

export default function InvitationsPage() {
  const mode = emailMode()
  return <InvitationsDashboard emailEnabled={mode !== 'off'} emailSimulated={mode === 'simulated'} />
}
