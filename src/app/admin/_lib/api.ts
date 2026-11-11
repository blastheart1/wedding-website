/** Shared calls for the admin areas. Every request carries the httpOnly session cookie. */

export class AdminRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'AdminRequestError'
  }
}

/** Sends a request and returns the parsed JSON, or throws an error whose message is safe to show. */
export async function adminFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new AdminRequestError('Could not reach the server. Check your connection and try again.', 0)
  }
  if (response.status === 401) {
    window.location.assign('/admin/login')
    throw new AdminRequestError('Please sign in again.', 401)
  }
  const json: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof json === 'object' && json !== null ? (json as { error?: unknown }).error : undefined
    throw new AdminRequestError(typeof message === 'string' ? message : 'Something went wrong. Please try again.', response.status)
  }
  return json as T
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export interface UploadedImage {
  url: string
  publicId: string
}

/** Signed upload straight to Cloudinary, the same flow the admin has always used. */
export async function uploadImage(file: File, folder: string): Promise<UploadedImage> {
  const timestamp = Math.round(Date.now() / 1000)
  const signed = await adminFetch<{ signature: string; apiKey: string; cloudName: string }>('/api/admin/gallery/sign', {
    method: 'POST',
    body: { paramsToSign: { timestamp: String(timestamp), folder } },
  })
  const form = new FormData()
  form.append('file', file)
  form.append('signature', signed.signature)
  form.append('api_key', signed.apiKey)
  form.append('timestamp', String(timestamp))
  form.append('folder', folder)
  const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, { method: 'POST', body: form })
  const data = (await response.json().catch(() => ({}))) as { secure_url?: string; public_id?: string }
  if (!response.ok || !data.secure_url) throw new AdminRequestError('The upload did not go through. Please try again.', response.status)
  return { url: data.secure_url, publicId: data.public_id ?? '' }
}
