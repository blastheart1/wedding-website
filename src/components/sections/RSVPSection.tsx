'use client'

import { useRef, useState } from 'react'
import { useForm }        from 'react-hook-form'
import { zodResolver }    from '@hookform/resolvers/zod'
import { z }              from 'zod'
import { toast }          from 'sonner'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { DEFAULT_SECTION_HEADINGS } from '@/lib/constants'
import type { PublicConfig } from '@/lib/config'
import { fadeUp, stagger }   from '@/lib/animations'
import type { SectionHeading, GuestVerification } from '@/types'
import clsx from 'clsx'

interface RSVPSectionProps {
  config:   Pick<PublicConfig, 'rsvpDeadline' | 'partner1' | 'partner2' | 'weddingDate'>
  heading?: SectionHeading
}

// ─── Email gate schema ────────────────────────────────────────────────────────
const emailSchema = z.object({
  email: z.string().email('Please enter a valid email').max(255),
})

// ─── RSVP form schema ─────────────────────────────────────────────────────────
const rsvpSchema = z.object({
  name:        z.string().min(2, 'Please enter your full name').max(255),
  email:       z.string().email().max(255),
  attending:   z.enum(['yes', 'no']),
  dietary:     z.string().max(500).optional(),
  songRequest: z.string().max(255).optional(),
  message:     z.string().max(2000).optional(),
})

type EmailData = z.infer<typeof emailSchema>
type FormData  = z.infer<typeof rsvpSchema>

type Step = 'email' | 'form' | 'denied' | 'success'

const inputClass = clsx(
  'w-full px-[14px] py-[9px] bg-cream border border-rule',
  'font-sans text-[14px] text-ink outline-none',
  'transition-colors focus:border-rose focus:bg-white',
  'appearance-none rounded-none',
)

const labelClass = 'block text-[9px] tracking-[3px] uppercase text-muted mb-1'

function SeatCountBadge({ seats }: { seats: number | null }) {
  if (!seats || seats <= 0) return null

  let message: string
  if (seats === 1)      message = 'Your invitation is for you only.'
  else if (seats === 2) message = 'Your invitation includes a plus one!'
  else                  message = `Your invitation includes ${seats - 1} additional guest${seats - 1 > 1 ? 's' : ''}!`

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-2 px-3 py-2 bg-rose/10 border border-rose/20 mb-4"
    >
      <span className="text-lg">🌸</span>
      <p className="text-[12px] text-rose font-medium">{message}</p>
    </motion.div>
  )
}

export function RSVPSection({ config, heading = DEFAULT_SECTION_HEADINGS.rsvp }: RSVPSectionProps) {
  const { rsvpDeadline, partner1, partner2, weddingDate } = config

  const [step,         setStep]         = useState<Step>('email')
  const [verification, setVerification] = useState<GuestVerification | null>(null)
  const [denialReason, setDenialReason] = useState<string>('')
  const [submittedName, setSubmittedName] = useState('')

  // Email gate form
  const emailForm = useForm<EmailData>({
    resolver: zodResolver(emailSchema),
  })

  // RSVP form
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver:      zodResolver(rsvpSchema),
    defaultValues: { attending: 'yes' },
  })

  const attending = watch('attending')

  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  const [year, month, day] = weddingDate.split('-').map(Number)
  const formattedDate = new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  // ─── Step 1: verify email ─────────────────────────────────────────────────
  const onVerifyEmail = async (data: EmailData) => {
    try {
      const res  = await fetch('/api/rsvp/verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: data.email }),
      })
      const json = await res.json()

      if (!json.success) {
        toast.error(json.error ?? 'Verification failed. Please try again.')
        return
      }

      const v: GuestVerification = json.data
      setVerification(v)

      if (!v.allowed) {
        const messages: Record<string, string> = {
          blocked:
            "We're sorry, but we're unable to process your RSVP. Please contact us directly.",
          not_invited:
            'This event is by invitation only. If you believe this is an error, please contact us.',
          already_rsvped:
            "You've already submitted your RSVP! Contact us if you need to make changes.",
        }
        setDenialReason(messages[v.reason ?? ''] ?? "We're unable to process your RSVP.")
        setStep('denied')
      } else {
        setStep('form')
      }
    } catch {
      toast.error('Network error — please try again.')
    }
  }

  // ─── Step 2: submit RSVP ─────────────────────────────────────────────────
  const onSubmit = async (data: FormData) => {
    try {
      const res  = await fetch('/api/rsvp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })
      const json = await res.json()

      if (json.success) {
        setSubmittedName(data.name)
        setStep('success')
        toast.success("RSVP received! We can't wait to celebrate with you 🌸")
      } else {
        // Handle duplicate email gracefully — they may have already RSVP'd
        if (res.status === 409) {
          setDenialReason("You've already submitted your RSVP with this email. Contact us if you need to make changes.")
          setStep('denied')
        } else {
          toast.error(json.message || 'Something went wrong. Please try again.')
        }
      }
    } catch {
      toast.error('Network error — please try again.')
    }
  }

  return (
    <section id="rsvp" className="bg-petal border-t border-blush min-h-screen flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full">
        <p className="text-[9px] tracking-[4px] uppercase text-muted text-center mb-2">{heading.eyebrow}</p>
        <h2 className="font-display font-light text-[28px] text-center mb-2">
          {heading.heading} <em className="italic text-rose">{heading.italic}</em>
        </h2>

        {rsvpDeadline && (
          <motion.p
            ref={ref}
            variants={fadeUp}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            className="text-center text-[11px] tracking-[2px] uppercase text-muted mb-3"
          >
            Please RSVP by {rsvpDeadline}
          </motion.p>
        )}

        <motion.div
          variants={stagger(0.1)}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="max-w-[460px] mx-auto bg-white border border-rule p-5"
        >
          <AnimatePresence mode="wait">

            {/* ── Email gate step ── */}
            {step === 'email' && (
              <motion.div
                key="email-gate"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{    opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="text-[13px] text-ink2 text-center mb-4 leading-relaxed">
                  Please enter your email to continue.
                </p>
                <form onSubmit={emailForm.handleSubmit(onVerifyEmail)} className="space-y-3">
                  <div>
                    <label className={labelClass}>Email Address</label>
                    <input
                      {...emailForm.register('email')}
                      type="email"
                      className={inputClass}
                      placeholder="your@email.com"
                      autoComplete="email"
                    />
                    {emailForm.formState.errors.email && (
                      <p className="text-rose text-[11px] mt-1">
                        {emailForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  <motion.button
                    type="submit"
                    disabled={emailForm.formState.isSubmitting}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{  scale: 0.99 }}
                    className="w-full bg-rose text-white text-[10px] tracking-[3px] uppercase font-medium py-3 hover:bg-rosedark disabled:opacity-60 transition-colors"
                  >
                    {emailForm.formState.isSubmitting ? 'Checking…' : 'Continue'}
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* ── RSVP form step ── */}
            {step === 'form' && (
              <motion.div
                key="rsvp-form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{    opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Seat count badge */}
                <SeatCountBadge seats={verification?.seats ?? null} />

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                  <motion.div variants={fadeUp}>
                    <label className={labelClass}>Full Name</label>
                    <input {...register('name')} className={inputClass} placeholder="Your full name" />
                    {errors.name && <p className="text-rose text-[11px] mt-1">{errors.name.message}</p>}
                  </motion.div>

                  {/* Email pre-filled from gate step and locked */}
                  <input
                    {...register('email')}
                    type="hidden"
                    value={emailForm.getValues('email')}
                  />

                  <motion.div variants={fadeUp}>
                    <label className={labelClass}>Email Address</label>
                    <input
                      value={emailForm.getValues('email')}
                      readOnly
                      className={clsx(inputClass, 'opacity-60 cursor-not-allowed')}
                    />
                  </motion.div>

                  <motion.div variants={fadeUp}>
                    <label className={labelClass}>Attending?</label>
                    <select {...register('attending')} className={inputClass}>
                      <option value="yes">Joyfully accepts</option>
                      <option value="no">Regretfully declines</option>
                    </select>
                  </motion.div>

                  <AnimatePresence>
                    {attending === 'yes' && (
                      <motion.div
                        key="attending-fields"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{    opacity: 0, height: 0 }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className="space-y-3 overflow-hidden"
                      >
                        <div>
                          <label className={labelClass}>Food Allergies / Dietary Restrictions</label>
                          <textarea
                            {...register('dietary')}
                            className={clsx(inputClass, 'min-h-[60px] resize-y')}
                            placeholder="e.g. nut allergy, vegetarian, gluten-free — leave blank if none"
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Song Request 🎵</label>
                          <input
                            {...register('songRequest')}
                            className={inputClass}
                            placeholder="A song that gets you dancing"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div variants={fadeUp}>
                    <label className={labelClass}>Message for {partner1} & {partner2}</label>
                    <textarea
                      {...register('message')}
                      className={clsx(inputClass, 'min-h-[48px] resize-y')}
                      placeholder="Wishes, love notes…"
                    />
                  </motion.div>

                  <motion.button
                    variants={fadeUp}
                    type="submit"
                    disabled={isSubmitting}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{  scale: 0.99 }}
                    className="w-full bg-rose text-white text-[10px] tracking-[3px] uppercase font-medium py-3 hover:bg-rosedark disabled:opacity-60 transition-colors"
                  >
                    {isSubmitting ? 'Sending…' : 'Send RSVP'}
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* ── Denied step ── */}
            {step === 'denied' && (
              <motion.div
                key="denied"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="text-center py-8"
              >
                <div className="text-4xl mb-4">🌷</div>
                <p className="text-[14px] text-ink2 leading-relaxed">{denialReason}</p>
              </motion.div>
            )}

            {/* ── Success step ── */}
            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="text-center py-8"
              >
                <motion.div
                  animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="text-5xl mb-4"
                >
                  🌸
                </motion.div>
                <h3 className="font-display text-[28px] font-light text-ink mb-2">Thank you!</h3>
                <p className="text-[13px] text-ink2 leading-relaxed">
                  {watch('attending') === 'yes'
                    ? `We're so excited to celebrate with you. See you on ${formattedDate}!`
                    : `We'll miss you, but thank you for letting us know, ${submittedName.split(' ')[0]}.`}
                </p>
                <p className="text-[11px] text-muted mt-4">
                  A confirmation was sent to {emailForm.getValues('email')}
                </p>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  )
}
