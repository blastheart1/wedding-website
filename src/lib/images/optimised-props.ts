import { getImageProps } from 'next/image'

/** Sources the image optimizer is set up for (see next.config.js). Anything else is shown as given. */
const OPTIMISABLE = [/^\/wedding\//, /^https:\/\/res\.cloudinary\.com\//]

export interface PlainImageProps { src: string; alt: string; srcSet?: string; sizes?: string }

/**
 * The address, srcset and sizes next/image would use, for a plain <img> that
 * needs its own layout (a CSS-sized photo, a thumbnail). The browser then gets
 * a right-sized modern-format file instead of the original, and the page's
 * layout does not change.
 */
export function optimisedImage(src: string, alt: string, sizes: string, width = 1400, height = 1050): PlainImageProps {
  if (!OPTIMISABLE.some(pattern => pattern.test(src))) return { src, alt }
  const { props } = getImageProps({ src, alt, width, height, sizes })
  return { src: props.src, srcSet: props.srcSet, sizes: props.sizes, alt }
}
