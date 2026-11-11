import { z } from 'zod'

const httpsUrl = z.string().max(2048).refine(value => {
  if (!value) return true
  try { return new URL(value).protocol === 'https:' } catch { return false }
}, 'Use a valid HTTPS URL or leave blank')
const imageUrl = z.string().max(2048).refine(value =>
  /^\/(?!\/)[^\\\s]*$/.test(value) || httpsUrl.safeParse(value).success && value !== '',
'Use a local /image path or HTTPS URL')
const mapEmbedUrl = httpsUrl.refine(value => {
  if (!value) return true
  try {
    const url = new URL(value)
    return ['maps.google.com', 'www.google.com'].includes(url.hostname) && url.pathname.startsWith('/maps')
  } catch { return false }
}, 'Use a Google Maps embed URL')

export const sitePresentationSchema = z.object({
  ceremonyAddress: z.string().max(2000),
  ceremonyMapUrl: httpsUrl,
  ceremonyMapEmbedUrl: mapEmbedUrl,
  ceremonyAlias: z.string().max(255),
  dressDescription: z.string().max(5000),
  dressRestrictions: z.string().max(5000),
  receptionNote: z.string().max(2000),
  footerContactEmail: z.union([z.literal(''), z.string().email().max(255)]),
  footerContactUrl: httpsUrl,
  ceremonyImages: z.array(z.object({ src: imageUrl, alt: z.string().max(500), label: z.string().max(100) }).strict()).max(12),
}).strict()
export type SitePresentation = z.infer<typeof sitePresentationSchema>

// Copy and photographs from the approved revision-11 preview, not database seed overrides.
export const DEFAULT_PRESENTATION: SitePresentation = {
  ceremonyAddress: 'Sitio Old Boso-Boso, Barangay San Jose\nAntipolo City, Rizal, Philippines',
  ceremonyMapUrl: 'https://maps.app.goo.gl/Y5ppxwv5Dm8Jqj1LA',
  ceremonyMapEmbedUrl: 'https://maps.google.com/maps?q=Nuestra%20Se%C3%B1ora%20de%20la%20Annunciata%20Parish%20Church%20Old%20Bosoboso%20Church%20Antipolo&t=m&z=16&output=embed',
  ceremonyAlias: 'Old Bosoboso Church',
  dressDescription: 'Come dressed for a joyful celebration in spring, pastel or bright colors.\nThink flowing dresses, elegant separates, or a tailored suit in our palette. Floral prints are welcome.\nPlease choose an outfit suitable for a church ceremony.',
  dressRestrictions: 'Guests wearing these colors will not be admitted to the celebration.\nBlack, white, red and earth tones, including brown, beige, cream, rust and similar shades.',
  receptionNote: 'Details may be shared on the wedding day.',
  footerContactEmail: 'antonioluis.santos1@gmail.com',
  footerContactUrl: 'https://codebyluis.dev',
  ceremonyImages: [
    { src: '/wedding/church-1.jpg', alt: 'Front view of Old Bosoboso Church, framed by trees', label: 'The church' },
    { src: '/wedding/church-2.jpg', alt: 'Stone façade and entrance of Old Bosoboso Church', label: 'The façade' },
    { src: '/wedding/church-3.jpg', alt: 'Interior of Old Bosoboso Church', label: 'The interior' },
  ],
}

export function parseSitePresentation(raw: string | null | undefined): SitePresentation {
  if (!raw) return structuredClone(DEFAULT_PRESENTATION)
  try {
    const parsed = sitePresentationSchema.partial().safeParse(JSON.parse(raw))
    if (parsed.success) return { ...structuredClone(DEFAULT_PRESENTATION), ...parsed.data }
  } catch { /* Invalid legacy JSON uses validated presentation defaults only. */ }
  return structuredClone(DEFAULT_PRESENTATION)
}
