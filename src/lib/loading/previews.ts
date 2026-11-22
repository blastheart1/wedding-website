/**
 * Tiny blurred stand-ins for photos. A guest who scrolls faster than a photo can
 * arrive sees a soft version of the right picture instead of an empty box. Each is
 * about a kilobyte, so all of them together cost less than one photo.
 */

/** A 24 px wide, softened copy, made by the media host from the same source. */
export const PREVIEW_TRANSFORM = 'f_auto,q_30,w_24,e_blur:200'

const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(v\d+\/.+)$/

/** The photo behind an image address: the optimizer's `url` parameter, or the address itself. */
function sourceOf(src: string): string | null {
  try {
    const parsed = new URL(src, 'https://site.invalid')
    return parsed.pathname === '/_next/image' ? parsed.searchParams.get('url') : src
  } catch {
    return null
  }
}

/**
 * The address of a photo's tiny preview, or null when there is no safe way to
 * make one (an unknown host, or a photo that already carries a transformation).
 */
export function previewUrl(src: string): string | null {
  const source = sourceOf(src)
  if (!source) return null
  const hosted = CLOUDINARY_UPLOAD.exec(source)
  if (hosted) return `${hosted[1]}${PREVIEW_TRANSFORM}/${hosted[2]}`
  if (source.startsWith('/wedding/')) return `/_next/image?url=${encodeURIComponent(source)}&w=16&q=20`
  return null
}
