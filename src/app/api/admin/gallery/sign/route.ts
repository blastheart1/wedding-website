import { NextRequest, NextResponse } from 'next/server'
import { signUploadParams } from '@/lib/cloudinary'
import { isAdminRequest } from '@/lib/auth'

export async function POST(request: NextRequest) {
  if (!await isAdminRequest(request)) {
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
