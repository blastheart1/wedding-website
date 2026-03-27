import Image from 'next/image'

interface SectionBackgroundProps {
  imageUrl?:       string
  fallbackColor:   string   // Tailwind bg-* class e.g. 'bg-petal'
  overlayClass?:   string   // e.g. 'bg-white/65' or 'bg-ink/40'
}

/**
 * Renders either a full-bleed Cloudinary image + semi-transparent overlay,
 * or a plain colour block as a fallback. Must be placed inside a `relative`
 * container; content above it should carry `relative z-10`.
 */
export function SectionBackground({
  imageUrl,
  fallbackColor,
  overlayClass = 'bg-white/65',
}: SectionBackgroundProps) {
  if (!imageUrl) {
    return <div className={`absolute inset-0 ${fallbackColor}`} />
  }

  return (
    <>
      <div className="absolute inset-0">
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
