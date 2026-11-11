/**
 * What Messenger, Facebook, Instagram and other apps show when the site's
 * address is pasted: a title, a line of text and a picture. Pure, so it can
 * be tested without a server.
 */
export interface SharePreviewInput {
  partner1: string
  partner2: string
  /** Already formatted for reading, e.g. "February 27, 2027". */
  date: string
  /** Custom wording and picture from Site settings. Empty means "use the automatic one". */
  title: string
  description: string
  imageUrl: string
  /** Site address without a trailing slash. */
  baseUrl: string
}

export interface SharePreview {
  title: string
  description: string
  url: string
  image: { url: string; width: number; height: number; alt: string; type: 'image/png' | 'image/jpeg' }
}

export const PREVIEW_SIZE = { width: 1200, height: 630 } as const

const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/

/**
 * A photo uploaded to Cloudinary is cropped to the shape preview cards use and
 * sent as a JPEG, the format every app accepts. Any other address is used as it is.
 */
export function previewSizedImage(url: string): string {
  const match = CLOUDINARY_UPLOAD.exec(url)
  if (!match) return url
  const transform = `c_fill,g_auto,w_${PREVIEW_SIZE.width},h_${PREVIEW_SIZE.height},f_jpg,q_auto`
  // Do not stack a second transformation on an address that already has this one.
  return match[2].startsWith(transform) ? url : `${match[1]}${transform}/${match[2]}`
}

export function sharePreview(input: SharePreviewInput): SharePreview {
  const couple = `${input.partner1} & ${input.partner2}`
  const title = input.title.trim() || couple
  const description = input.description.trim() || `We are getting married on ${input.date}. Join us to celebrate.`
  const custom = input.imageUrl.trim()
  return {
    title,
    description,
    url: `${input.baseUrl}/`,
    image: {
      url: custom ? previewSizedImage(custom) : `${input.baseUrl}/preview-image`,
      // The generated card is a PNG; an uploaded photo is delivered as a JPEG.
      type: custom ? 'image/jpeg' : 'image/png',
      ...PREVIEW_SIZE,
      alt: `${couple}, ${input.date}`,
    },
  }
}

/** Sizes of the site icon: browser tab, iPhone home screen, Android home screen and splash. */
export const ICON_SIZES = [32, 180, 192, 512] as const
export type IconSize = (typeof ICON_SIZES)[number]

export function isIconSize(value: number): value is IconSize {
  return (ICON_SIZES as readonly number[]).includes(value)
}

/** The site's identity wherever a browser or phone shows it: tab, home screen, app switcher. */
export function siteIdentity(partner1: string, partner2: string) {
  const initial = (name: string) => name.trim().charAt(0).toUpperCase()
  return {
    name: `${partner1} & ${partner2}`,
    shortName: [initial(partner1), initial(partner2)].filter(Boolean).join(' & '),
    monogram: [initial(partner1), initial(partner2)].filter(Boolean).join('&'),
    background: '#FDFAF6',
    ink: '#2E1F1A',
  }
}
