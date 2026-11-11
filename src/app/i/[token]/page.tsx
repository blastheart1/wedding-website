import { cache } from 'react'
import type { Metadata } from 'next'
import { asc, eq } from 'drizzle-orm'
import { getInviteDb, schema } from '@/lib/invitations/db'
import { getWeddingConfig } from '@/lib/config'
import { loadInviteView } from '@/lib/invitations/service'
import { inviteStore, loadInviteSettings } from '@/lib/invitations/store'
import { renderTemplate } from '@/lib/invitations/settings'
import { formatWeddingDate, siteBaseUrl, templateValues } from '@/lib/invitations/format'
import type { InviteView } from '@/lib/invitations/types'
import { InviteExperience } from './_components/InviteExperience'
import { InviteUnavailable } from './_components/InviteUnavailable'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { token: string }
}

/** One lookup per request, shared by the metadata and the page. Any failure reads as "not active". */
const getView = cache(async (token: string): Promise<InviteView | null> => {
  try {
    return await loadInviteView(inviteStore, token)
  } catch (error) {
    console.error('Invitation lookup failed', error instanceof Error ? error.name : 'unknown error')
    return null
  }
})

async function loadFaqs(): Promise<{ id: number; question: string; answer: string }[]> {
  try {
    return await getInviteDb()
      .select({ id: schema.faqItems.id, question: schema.faqItems.question, answer: schema.faqItems.answer })
      .from(schema.faqItems)
      .where(eq(schema.faqItems.visible, true))
      .orderBy(asc(schema.faqItems.sortOrder), asc(schema.faqItems.createdAt))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [view, config] = await Promise.all([getView(params.token), getWeddingConfig()])
  const shared: Metadata = {
    // Personal links must never be indexed or leak through the Referer header.
    robots: { index: false, follow: false, nocache: true },
    referrer: 'no-referrer',
  }
  if (!view) {
    return { ...shared, title: `${config.partner1} & ${config.partner2}` }
  }
  const settings = await loadInviteSettings()
  const values = templateValues({ firstName: view.firstName, partner1: config.partner1, partner2: config.partner2, weddingDate: config.weddingDate })
  const title = renderTemplate(settings.previewTitle, values)
  const description = renderTemplate(settings.previewDescription, values)
  const image = settings.previewImageUrl || `${siteBaseUrl()}/i/${params.token}/preview-image`
  return {
    ...shared,
    title,
    description,
    openGraph: { title, description, type: 'website', images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

export default async function InvitePage({ params }: PageProps) {
  const [view, config] = await Promise.all([getView(params.token), getWeddingConfig()])
  const couple = { partner1: config.partner1, partner2: config.partner2 }
  if (!view) {
    return <InviteUnavailable couple={couple} contactEmail={config.presentation.footerContactEmail} />
  }
  const [settings, faqs] = await Promise.all([loadInviteSettings(), loadFaqs()])
  return (
    <InviteExperience
      token={params.token}
      initialView={view}
      couple={{ ...couple, date: formatWeddingDate(config.weddingDate) }}
      dos={settings.dos}
      donts={settings.donts}
      acknowledgement={settings.acknowledgement}
      faqs={faqs}
    />
  )
}
