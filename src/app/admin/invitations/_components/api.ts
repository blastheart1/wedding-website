/** Client-side types and calls for the invitations dashboard. Dates arrive as ISO strings. */

export interface InvitationResponse {
  attending: boolean
  partySize: number
  companions: string[]
  dietary: string | null
  songRequest: string | null
  message: string | null
  updatedAt: string | null
}

export interface InvitationSummary {
  id: number
  guestName: string
  email: string | null
  phone: string | null
  seats: number
  status: string
  sentAt: string | null
  lastChannel: string | null
  firstOpenedAt: string | null
  lastOpenedAt: string | null
  openCount: number
  respondedAt: string | null
  linkRequestedAt: string | null
  createdAt: string
  response: InvitationResponse | null
}

export interface InvitationEvent {
  id: number
  type: string
  channel: string | null
  meta: string | null
  createdAt: string
}

export interface InvitationDetail {
  invitation: InvitationSummary & { events: InvitationEvent[] }
  link: string
  qrSvg: string
  shareMessage: string
  preview: { title: string; description: string; image: string }
}

export interface InviteSettings {
  previewTitle: string
  previewDescription: string
  previewImageUrl: string
  emailSubject: string
  emailIntro: string
  shareMessage: string
  dos: string[]
  donts: string[]
  acknowledgement: string
}

export interface BulkResult {
  created: number
  skipped: { guestName: string; reason: string }[]
}

export interface GuestDraft {
  guestName: string
  email: string
  phone: string
  seats: number
}

export type ShareChannel = 'messenger' | 'instagram' | 'email' | 'other'

export type UpdateAction =
  | ({ action: 'edit'; id: number } & GuestDraft)
  | { action: 'revoke' | 'restore' | 'regenerate'; id: number }
  | { action: 'shared'; id: number; channel: ShareChannel }

const BASE = '/api/admin/invitations'

/** Every call resolves to data or throws an Error whose message is safe to show. */
async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(BASE + path, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.')
  }
  if (response.status === 401) {
    window.location.assign('/admin/login')
    throw new Error('Please sign in again.')
  }
  const json: { success?: boolean; data?: T; error?: string } = await response.json().catch(() => ({}))
  if (!json.success) throw new Error(json.error ?? 'Something went wrong. Please try again.')
  return json.data as T
}

export const invitationsApi = {
  list: () => call<InvitationSummary[]>(''),
  detail: (id: number) => call<InvitationDetail>(`/${id}`),
  create: (guest: GuestDraft) => call<{ id: number }>('', 'POST', guest),
  createMany: (guests: GuestDraft[]) => call<BulkResult>('', 'POST', { guests }),
  update: (input: UpdateAction) => call<{ id: number }>('', 'PATCH', input),
  remove: (id: number) => call<{ id: number }>('', 'DELETE', { id }),
  importGuestList: () => call<BulkResult>('/import', 'POST'),
  settings: () => call<InviteSettings>('/settings'),
  saveSettings: (settings: InviteSettings) => call<InviteSettings>('/settings', 'PUT', settings),
  sendEmail: (ids: number[], resend: boolean) =>
    call<{ sent: number; skipped: { id: number; reason: string }[] }>('/send', 'POST', { ids, resend }),
  qrPngUrl: (id: number) => `${BASE}/${id}/qr`,
  emailPreviewUrl: (id: number) => `${BASE}/${id}/email`,
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}
