import { v2 as cloudinary } from 'cloudinary'

// Configure once per module load — safe in Next.js API routes
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
})

export { cloudinary }

/**
 * Generate a signed upload signature for a direct browser → Cloudinary upload.
 * The browser never sees the API secret — only the resulting signature.
 */
export function signUploadParams(paramsToSign: Record<string, string>): string {
  const secret = process.env.CLOUDINARY_API_SECRET
  if (!secret) throw new Error('CLOUDINARY_API_SECRET is not set')
  return cloudinary.utils.api_sign_request(paramsToSign, secret)
}

/**
 * Delete an image from Cloudinary by its public_id.
 */
export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId)
}

/**
 * Build the optimised Cloudinary URL for a stored public_id.
 * Falls back to a full URL passthrough if the value already starts with https.
 */
export function buildImageUrl(publicIdOrUrl: string, width = 1200): string {
  if (publicIdOrUrl.startsWith('https://')) return publicIdOrUrl
  return cloudinary.url(publicIdOrUrl, {
    width,
    crop:    'fill',
    quality: 'auto',
    fetch_format: 'auto',
  })
}
