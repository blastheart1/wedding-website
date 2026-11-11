import QRCode from 'qrcode'

const QUIET_ZONE = 4
const FINDER = 7
const INK = '#2E1F1A'
const CREAM = '#FDFAF6'
/** Share of the code's width cleared for the monogram. Level H recovers far more than this hides. */
const CENTRE_SHARE = 0.24

export interface QrOptions {
  /** Short text set in the centre, e.g. "L&B". Omit to leave the centre clear for an overlay. */
  monogram?: string
  foreground?: string
  background?: string
}

export interface QrLayout {
  /** Modules per side, without the quiet zone. */
  size: number
  /** Side of the SVG viewBox, in modules, including the quiet zone. */
  viewBox: number
  /** First module and side length of the cleared centre square. */
  centre: { start: number; side: number }
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, character => `&#${character.charCodeAt(0)};`)
}

function centreSquare(size: number): QrLayout['centre'] {
  let side = Math.round(size * CENTRE_SHARE)
  // Same parity as the code so the square sits exactly in the middle.
  if (side % 2 !== size % 2) side += 1
  return { start: (size - side) / 2, side }
}

export function qrLayout(text: string): QrLayout {
  const size = QRCode.create(text, { errorCorrectionLevel: 'H' }).modules.size
  return { size, viewBox: size + QUIET_ZONE * 2, centre: centreSquare(size) }
}

/**
 * Centres of the small alignment markers for a code of this size (QR versions 2 and up).
 * Drawn as solid shapes: split into dots, scanners cannot recognise them on large prints.
 */
export function alignmentCentres(size: number): [number, number][] {
  const version = (size - 17) / 4
  if (version < 2) return []
  const count = Math.floor(version / 7) + 2
  const last = size - 7
  const step = version === 32 ? 26 : Math.ceil((last - 6) / (count - 1) / 2) * 2
  const positions = [6]
  for (let index = count - 2; index >= 0; index--) positions.push(last - index * step)
  const centres: [number, number][] = []
  for (const row of positions) {
    for (const column of positions) {
      const overlapsFinder = (row === 6 && column === 6) || (row === 6 && column === last) || (row === last && column === 6)
      if (!overlapsFinder) centres.push([column, row])
    }
  }
  return centres
}

function alignmentPattern(column: number, row: number, foreground: string, background: string): string {
  const x = column + QUIET_ZONE - 2
  const y = row + QUIET_ZONE - 2
  return [
    `<rect x="${x}" y="${y}" width="5" height="5" rx="1.2" fill="${foreground}"/>`,
    `<rect x="${x + 1}" y="${y + 1}" width="3" height="3" rx="0.7" fill="${background}"/>`,
    `<rect x="${x + 2}" y="${y + 2}" width="1" height="1" rx="0.3" fill="${foreground}"/>`,
  ].join('')
}

function finderPattern(column: number, row: number, foreground: string, background: string): string {
  const x = column + QUIET_ZONE
  const y = row + QUIET_ZONE
  return [
    `<rect x="${x}" y="${y}" width="7" height="7" rx="2.2" fill="${foreground}"/>`,
    `<rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="1.4" fill="${background}"/>`,
    `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.9" fill="${foreground}"/>`,
  ].join('')
}

/**
 * The invitation QR in the site's look: rounded dots, soft corner markers, ink
 * on cream, and a clear centre for the couple's monogram. Error correction is
 * at the highest level so the cleared centre never affects scanning.
 */
export function renderQrSvg(text: string, options: QrOptions = {}): string {
  const foreground = options.foreground ?? INK
  const background = options.background ?? CREAM
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'H' })
  const size = modules.size
  const centre = centreSquare(size)
  const inFinder = (column: number, row: number) =>
    (column < FINDER && row < FINDER) || (column >= size - FINDER && row < FINDER) || (column < FINDER && row >= size - FINDER)
  const inCentre = (column: number, row: number) =>
    column >= centre.start && column < centre.start + centre.side && row >= centre.start && row < centre.start + centre.side

  // A marker under the monogram is left out; the rest are drawn solid.
  const markers = alignmentCentres(size).filter(([column, row]) => !inCentre(column, row))
  const inMarker = (column: number, row: number) =>
    markers.some(([markerColumn, markerRow]) => Math.abs(column - markerColumn) <= 2 && Math.abs(row - markerRow) <= 2)

  const dots: string[] = []
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      if (!modules.data[row * size + column] || inFinder(column, row) || inCentre(column, row) || inMarker(column, row)) continue
      dots.push(`<circle cx="${column + QUIET_ZONE + 0.5}" cy="${row + QUIET_ZONE + 0.5}" r="0.46"/>`)
    }
  }

  const viewBox = size + QUIET_ZONE * 2
  const middle = viewBox / 2
  const monogram = options.monogram
    ? `<text x="${middle}" y="${middle}" text-anchor="middle" dominant-baseline="central" font-family="'Cormorant Garamond', Georgia, serif" font-size="${(centre.side * 0.5).toFixed(2)}" fill="${foreground}">${escapeXml(options.monogram)}</text>`
    : ''

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBox} ${viewBox}" role="img" aria-label="Invitation QR code">`,
    `<rect width="${viewBox}" height="${viewBox}" rx="3" fill="${background}"/>`,
    `<g fill="${foreground}">${dots.join('')}</g>`,
    finderPattern(0, 0, foreground, background),
    finderPattern(size - FINDER, 0, foreground, background),
    finderPattern(0, size - FINDER, foreground, background),
    markers.map(([column, row]) => alignmentPattern(column, row, foreground, background)).join(''),
    monogram,
    '</svg>',
  ].join('')
}

/** "Luis" and "Bee" become "L&B". */
export function coupleMonogram(partner1: string, partner2: string): string {
  const initial = (name: string) => name.trim().charAt(0).toUpperCase()
  return [initial(partner1), initial(partner2)].filter(Boolean).join('&')
}
