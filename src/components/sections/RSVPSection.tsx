'use client'

import { useRef, useState } from 'react'
import { useForm }        from 'react-hook-form'
import { zodResolver }    from '@hookform/resolvers/zod'
import { z }              from 'zod'
import { toast }          from 'sonner'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { SectionHeader }  from '@/components/ui/SectionHeader'
import { MEAL_OPTIONS }   from '@/lib/constants'
import type { PublicConfig } from '@/lib/config'
import { fadeUp, stagger }   from '@/lib/animations'
import clsx from 'clsx'

interface RSVPSectionProps {
  config: Pick<PublicConfig, 'rsvpDeadline' | 'partner1' | 'partner2' | 'weddingDate'>
}

const schema = z.object({
  name:        z.string().min(2, 'Please enter your full name').max(255),
  email:       z.string().email('Please enter a valid email').max(255),
  attending:   z.enum(['yes', 'no']),
  meal:        z.string().max(100).optional(),
  songRequest: z.string().max(255).optional(),
  plusOne:     z.boolean().optional(),
  plusOneName: z.string().max(255).optional(),
  message:     z.string().max(2000).optional(),
})

type FormData = z.infer<typeof schema>

const inputClass = clsx(
  'w-full px-[14px] py-3 bg-cream border border-rule',
  'font-sans text-[14px] text-ink outline-none',
  'transition-colors focus:border-rose focus:bg-white',
  'appearance-none rounded-none',
)

const labelClass = 'block text-[9px] tracking-[3px] uppercase text-muted mb-2'

export function RSVPSection({ config }: RSVPSectionProps) {
  const { rsvpDeadline, partner1, partner2, weddingDate } = config
  const [submittedData, setSubmittedData] = useState<FormData | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver:      zodResolver(schema),
    defaultValues: { attending: 'yes', plusOne: false },
  })

  const attending = watch('attending')
  const plusOne   = watch('plusOne')

  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  const onSubmit = async (data: FormData) => {
    try {
      const res  = await fetch('/api/rsvp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })
      const json = await res.json()

      if (json.success) {
        setSubmittedData(data)
        toast.success("RSVP received! We can't wait to celebrate with you 🌸")
      } else {
        toast.error(json.message || 'Something went wrong. Please try again.')
      }
    } catch {
      toast.error('Network error — please try again.')
    }
  }

  // Format wedding date for display
  const [year, month, day] = weddingDate.split('-').map(Number)
  const formattedDate = new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <section id="rsvp" className="bg-petal py-24 px-6 border-t border-blush">
      <SectionHeader eyebrow="You're Invited" heading="Will you" headingItalic="join us?" />

      {rsvpDeadline && (
        <motion.p
          ref={ref}
          variants={fadeUp}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="text-center text-[11px] tracking-[2px] uppercase text-muted mb-8 -mt-6"
        >
          Please RSVP by {rsvpDeadline}
        </motion.p>
      )}

      <motion.div
        variants={stagger(0.1)}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
        className="max-w-[480px] mx-auto bg-white border border-rule p-12"
      >
        <AnimatePresence mode="wait">
          {submittedData ? (
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
                {submittedData.attending === 'yes'
                  ? `We're so excited to celebrate with you. See you on ${formattedDate}!`
                  : `We'll miss you, but thank you for letting us know, ${submittedData.name.split(' ')[0]}.`}
              </p>
              <p className="text-[11px] text-muted mt-4">
                A confirmation was sent to {submittedData.email}
              </p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-5"
              variants={stagger(0.06)}
              initial="hidden"
              animate="visible"
            >
              <motion.div variants={fadeUp}>
                <label className={labelClass}>Full Name</label>
                <input {...register('name')} className={inputClass} placeholder="Your full name" />
                {errors.name && <p className="text-rose text-[11px] mt-1">{errors.name.message}</p>}
              </motion.div>

              <motion.div variants={fadeUp}>
                <label className={labelClass}>Email Address</label>
                <input {...register('email')} type="email" className={inputClass} placeholder="your@email.com" />
                {errors.email && <p className="text-rose text-[11px] mt-1">{errors.email.message}</p>}
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
                    className="space-y-5 overflow-hidden"
                  >
                    <div>
                      <label className={labelClass}>Meal Preference</label>
                      <select {...register('meal')} className={inputClass}>
                        {MEAL_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        {...register('plusOne')}
                        type="checkbox"
                        id="plusOne"
                        className="w-4 h-4 accent-rose"
                      />
                      <label htmlFor="plusOne" className="text-[12px] text-ink2">
                        Bringing a plus one?
                      </label>
                    </div>

                    <AnimatePresence>
                      {plusOne && (
                        <motion.div
                          key="plusone-name"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{    opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <label className={labelClass}>Plus One&apos;s Name</label>
                          <input {...register('plusOneName')} className={inputClass} placeholder="Their full name" />
                        </motion.div>
                      )}
                    </AnimatePresence>

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
                  className={clsx(inputClass, 'min-h-[80px] resize-y')}
                  placeholder="Wishes, love notes…"
                />
              </motion.div>

              <motion.button
                variants={fadeUp}
                type="submit"
                disabled={isSubmitting}
                whileHover={{ scale: 1.01 }}
                whileTap={{  scale: 0.99 }}
                className="w-full bg-rose text-white text-[10px] tracking-[3px] uppercase font-medium py-4 hover:bg-rosedark disabled:opacity-60 transition-colors mt-2"
              >
                {isSubmitting ? 'Sending…' : 'Send RSVP'}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  )
}
