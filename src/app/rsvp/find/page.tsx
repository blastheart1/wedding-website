import type { Metadata } from 'next'
import { getWeddingConfig } from '@/lib/config'
import { FindStatus } from './FindStatus'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Check your RSVP',
  robots: { index: false, follow: false },
}

export default async function FindPage() {
  const config = await getWeddingConfig()
  return (
    <FindStatus
      couple={{ partner1: config.partner1, partner2: config.partner2 }}
      contactEmail={config.presentation.footerContactEmail}
    />
  )
}
