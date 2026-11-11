/** Helpers for delivering media at a sensible size. Pure, so they can be tested. */

const CLOUDINARY_VIDEO = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(.+)$/

/** Good-quality H.264, at most 1280 wide, no audio track: the background video is always muted. */
export const BACKGROUND_VIDEO_TRANSFORM = 'q_auto:good,w_1280,c_limit,vc_h264,ac_none'

/**
 * The address to use for a muted background video. A Cloudinary upload is
 * requested in a lighter form (a 20 MB original becomes about 3 MB); any
 * other address, or one that already carries a transformation, is used as it is.
 */
export function backgroundVideoUrl(url: string): string {
  const match = CLOUDINARY_VIDEO.exec(url.trim())
  if (!match) return url
  const first = match[2].split('/')[0]
  // A version ("v1700000000") or a plain file name means no transformation has been applied yet.
  const untransformed = /^v\d+$/.test(first) || !first.includes('_') || first.includes('.')
  return untransformed ? `${match[1]}${BACKGROUND_VIDEO_TRANSFORM}/${match[2]}` : url
}
