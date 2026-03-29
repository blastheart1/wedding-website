'use client'

import { useRef, useEffect } from 'react'
import Image from 'next/image'

interface SectionBackgroundProps {
  imageUrl?:     string
  fallbackColor: string
  overlayClass?: string
  /** Enable GSAP ScrollTrigger parallax on the background image */
  parallax?:     boolean
}

/**
 * Full-bleed section background with optional GSAP parallax.
 * Must be placed inside a `<section>` with `position: relative`.
 * Content above it should carry `relative z-10`.
 */
export function SectionBackground({
  imageUrl,
  fallbackColor,
  overlayClass = 'bg-white/65',
  parallax = false,
}: SectionBackgroundProps) {
  const bgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!parallax || !imageUrl || !bgRef.current) return

    // Walk up to the nearest <section> as the ScrollTrigger trigger
    const section = bgRef.current.closest('section') as HTMLElement | null
    if (!section) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ctx: any

    ;(async () => {
      const { gsap }          = await import('gsap')
      const { ScrollTrigger } = await import('gsap/ScrollTrigger')
      gsap.registerPlugin(ScrollTrigger)

      ctx = gsap.context(() => {
        gsap.fromTo(
          bgRef.current,
          { y: 0 },
          {
            y: -60,
            ease: 'none',
            scrollTrigger: {
              trigger: section,
              start:   'top bottom',
              end:     'bottom top',
              scrub:   true,
            },
          }
        )
      })
    })()

    return () => ctx?.revert?.()
  }, [parallax, imageUrl])

  if (!imageUrl) {
    return <div className={`absolute inset-0 ${fallbackColor}`} />
  }

  return (
    <>
      <div
        ref={bgRef}
        style={{
          position: 'absolute',
          inset: 0,
          // Extend the image beyond section bounds so parallax never shows a gap
          ...(parallax ? { top: '-60px', bottom: '-60px', height: 'calc(100% + 120px)' } : {}),
        }}
      >
        <Image
          src={imageUrl}
          alt="Section background"
          fill
          className="object-cover"
          sizes="100vw"
        />
      </div>
      <div className={`absolute inset-0 ${overlayClass}`} />
    </>
  )
}
