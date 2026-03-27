import { NextRequest, NextResponse } from 'next/server'
import { signUploadParams } from '@/lib/cloudinary'

function isAuthenticated(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-password')
  return !!auth && auth === process.env.ADMIN_PASSWORD
}

/**
 * POST /api/admin/gallery/sign
 * Body: { paramsToSign: Record<string, string> }
 * Returns: { signature: string, apiKey: string, cloudName: string }
 *
 * Called by the admin upload UI before it POSTs directly to Cloudinary,
 * so the API secret never leaves the server.
 */
export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as { paramsToSign: Record<string, string> }

  const signature = signUploadParams(body.paramsToSign)

  return NextResponse.json({
    signature,
    apiKey:    process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  })
}
