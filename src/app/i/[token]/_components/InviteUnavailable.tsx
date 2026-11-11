interface InviteUnavailableProps {
  couple: { partner1: string; partner2: string }
  contactEmail: string
}

/** One neutral page for unknown, mistyped and revoked links: it confirms nothing about any guest. */
export function InviteUnavailable({ couple, contactEmail }: InviteUnavailableProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center px-8 py-16 text-center">
      <p className="font-sans text-[13px] uppercase tracking-[0.14em] text-ink2">{couple.partner1} &amp; {couple.partner2}</p>
      <h1 className="mt-3 font-serif text-[34px] leading-tight text-ink">This link is not active</h1>
      <p className="mt-4 font-sans text-[16px] leading-relaxed text-ink2">
        Please open the link from your invitation again, or check your RSVP status with the email or phone number we have for you.
      </p>
      <div className="mt-8 space-y-3">
        <a href="/rsvp/find" className="block rounded-full bg-ink px-6 py-3.5 font-sans text-[16px] font-medium text-cream">Check my RSVP status</a>
        {contactEmail && (
          <a href={`mailto:${contactEmail}`} className="block rounded-full bg-white px-6 py-3.5 font-sans text-[16px] font-medium text-ink">Contact us</a>
        )}
      </div>
    </main>
  )
}
