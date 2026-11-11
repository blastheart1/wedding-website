import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import { qrLayout, renderQrSvg } from './qr'

const INK = '#2E1F1A'

/** The site's serif for the monogram. Without it the built-in font is used and the code still scans. */
async function monogramFont(): Promise<{ name: string; data: Buffer; weight: 500; style: 'normal' }[]> {
  try {
    const data = await readFile(path.join(process.cwd(), 'public', 'wedding', 'font-3.ttf'))
    return [{ name: 'Cormorant', data, weight: 500, style: 'normal' }]
  } catch {
    return []
  }
}

/**
 * PNG of the styled QR for email and download. The dots come from the same
 * SVG the dashboard shows; the monogram is set here as text so it does not
 * depend on fonts inside the SVG renderer.
 */
export async function renderQrPng(link: string, monogram: string, pixels = 1024): Promise<Buffer> {
  const svg = renderQrSvg(link)
  const layout = qrLayout(link)
  const fonts = await monogramFont()
  const fontSize = Math.round((layout.centre.side / layout.viewBox) * pixels * 0.5)
  const source = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  const image = new ImageResponse(
    (
      <div style={{ display: 'flex', position: 'relative', width: pixels, height: pixels }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={source} width={pixels} height={pixels} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: pixels, height: pixels, display: 'flex', alignItems: 'center', justifyContent: 'center', color: INK, fontFamily: fonts.length ? 'Cormorant' : 'serif', fontSize }}>
          {monogram}
        </div>
      </div>
    ),
    { width: pixels, height: pixels, fonts },
  )
  return Buffer.from(await image.arrayBuffer())
}
