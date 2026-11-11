import type { InvitationSummary } from './api'

export type Stage = 'revoked' | 'responded' | 'opened' | 'sent' | 'not_sent'
export type Filter = 'all' | 'not_sent' | 'sent' | 'opened' | 'responded'

export const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'not_sent', label: 'Not sent' },
  { value: 'sent', label: 'Sent' },
  { value: 'opened', label: 'Opened' },
  { value: 'responded', label: 'Responded' },
]

/** The furthest point an invitation has reached. */
export function stageOf(invitation: InvitationSummary): Stage {
  if (invitation.status !== 'active') return 'revoked'
  if (invitation.response) return 'responded'
  if (invitation.firstOpenedAt) return 'opened'
  if (invitation.sentAt) return 'sent'
  return 'not_sent'
}

export function statusText(invitation: InvitationSummary): string {
  const stage = stageOf(invitation)
  if (stage === 'revoked') return 'Revoked'
  if (stage === 'responded' && invitation.response) {
    return invitation.response.attending ? `Attending · ${invitation.response.partySize}` : 'Declined'
  }
  if (stage === 'opened') return 'Opened'
  if (stage === 'sent') return 'Sent'
  return 'Not sent'
}

export function matchesFilter(invitation: InvitationSummary, filter: Filter): boolean {
  return filter === 'all' || stageOf(invitation) === filter
}

export function matchesSearch(invitation: InvitationSummary, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [invitation.guestName, invitation.email ?? '', invitation.phone ?? ''].some(value => value.toLowerCase().includes(needle))
}

export interface Totals {
  invited: number
  sent: number
  opened: number
  attending: number
  declined: number
  seatsGiven: number
  seatsUsed: number
  linkRequests: number
}

export function totalsOf(invitations: readonly InvitationSummary[]): Totals {
  const active = invitations.filter(invitation => invitation.status === 'active')
  return {
    invited: active.length,
    sent: active.filter(invitation => invitation.sentAt).length,
    opened: active.filter(invitation => invitation.firstOpenedAt).length,
    attending: active.filter(invitation => invitation.response?.attending).length,
    declined: active.filter(invitation => invitation.response && !invitation.response.attending).length,
    seatsGiven: active.reduce((sum, invitation) => sum + invitation.seats, 0),
    seatsUsed: active.reduce((sum, invitation) => sum + (invitation.response?.attending ? invitation.response.partySize : 0), 0),
    linkRequests: active.filter(invitation => invitation.linkRequestedAt).length,
  }
}

const CHANNELS: Record<string, string> = { messenger: 'Messenger', instagram: 'Instagram', email: 'Email', other: 'Other' }

export const channelLabel = (channel: string | null): string => (channel ? CHANNELS[channel] ?? channel : '')

const EVENTS: Record<string, string> = {
  created: 'Invitation created',
  email_sent: 'Email sent',
  email_failed: 'Email could not be sent',
  email_delivered: 'Email delivered',
  email_bounced: 'Email bounced',
  shared: 'Marked as sent',
  opened: 'Link opened',
  responded: 'RSVP received',
  updated: 'RSVP changed',
  revoked: 'Link revoked',
  restored: 'Link restored',
  regenerated: 'New link issued',
  link_requested: 'Guest asked for their link',
  edited: 'Details edited',
}

export function eventLabel(type: string, channel: string | null, meta: string | null = null): string {
  const label = EVENTS[type] ?? type
  if (type === 'email_sent' && meta?.includes('"simulated":true')) return 'Email simulated (nothing sent)'
  return type === 'shared' && channel ? `${label} via ${channelLabel(channel)}` : label
}

/** "Nov 11, 3:42 PM" in the viewer's own timezone; the year is added when it is not this year. */
export function formatWhen(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...(sameYear ? {} : { year: 'numeric' }),
  })
}

export function plusText(seats: number): string {
  const plus = Math.max(0, seats - 1)
  return plus === 0 ? 'No plus' : `Plus ${plus}`
}
