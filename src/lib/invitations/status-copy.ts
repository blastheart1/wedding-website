/** Wording for the public status check. Pure, so every case can be tested. */

export interface StatusResult {
  found: boolean
  responded: boolean
  delivery: 'email' | 'manual' | 'recent' | null
}

export interface StatusCopy {
  title: string
  body: string
  /** Offer the "ask for a change" note. Only for guests who have already responded. */
  canRequestChange: boolean
}

const WAYS = 'email, Messenger, Instagram or text'

/** What a guest is told after checking their status. Never includes a name, seat count or link. */
export function statusCopy(result: StatusResult, deadline: string): StatusCopy {
  if (!result.found) {
    return {
      title: 'We could not find that',
      body: 'Try the other email address or mobile number you use. If you were invited and still cannot find yourself, contact us and we will sort it out.',
      canRequestChange: false,
    }
  }
  const delivery =
    result.delivery === 'email' ? 'We have just emailed your personal link to you.'
    : result.delivery === 'recent' ? 'Your personal link was sent a few minutes ago. Please check your messages.'
    : `We will send your personal link by ${WAYS}.`
  if (result.responded) {
    const window = deadline ? ` You can change your answer through your link until ${deadline}.` : ' You can change your answer through your link.'
    return { title: 'We have your RSVP', body: `${delivery}${window}`, canRequestChange: true }
  }
  return {
    title: 'You are on our list',
    body: `We have not received your RSVP yet. ${delivery} Open it to reply.`,
    canRequestChange: false,
  }
}
