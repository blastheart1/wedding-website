import clsx from 'clsx'
import { tableBox, tableReach } from '@/lib/seating/geometry'
import { seatingSentences, type GuestSeating } from '@/lib/seating/guest-view'
import { Group, Row } from './ui'

type Map = GuestSeating['map']

const PADDING = 40

/** The part of the room that has something in it, so the map is not mostly empty floor. */
function boundsOf(map: Map) {
  const edges = [
    ...map.tables.map(table => { const reach = tableReach(table.shape, table.chairs); return { left: table.x - reach, right: table.x + reach, top: table.y - reach, bottom: table.y + reach } }),
    ...map.shapes.map(shape => ({ left: shape.x - shape.width / 2, right: shape.x + shape.width / 2, top: shape.y - shape.height / 2, bottom: shape.y + shape.height / 2 })),
  ]
  const left = Math.min(...edges.map(edge => edge.left)) - PADDING
  const top = Math.min(...edges.map(edge => edge.top)) - PADDING
  const right = Math.max(...edges.map(edge => edge.right)) + PADDING
  const bottom = Math.max(...edges.map(edge => edge.bottom)) + PADDING
  return { left, top, width: right - left, height: bottom - top }
}

/** A small picture of the room: every table as an outline with its name, the guest's own table filled in. */
function RoomMap({ map }: { map: Map }) {
  const bounds = boundsOf(map)
  const percent = (value: number, of: number) => `${(value / of) * 100}%`
  const place = (x: number, y: number, width: number, height: number) => ({
    left: percent(x - width / 2 - bounds.left, bounds.width),
    top: percent(y - height / 2 - bounds.top, bounds.height),
    width: percent(width, bounds.width),
    height: percent(height, bounds.height),
  })
  const mine = map.tables.filter(table => table.mine).map(table => table.label)
  return (
    <div
      role="img"
      aria-label={`Map of the room. ${mine.length === 1 ? `Your table, ${mine[0]}, is` : `Your tables, ${mine.join(' and ')}, are`} highlighted.`}
      className="relative w-full overflow-hidden rounded-xl bg-[#F5F2EE]"
      style={{ aspectRatio: `${bounds.width} / ${bounds.height}`, containerType: 'inline-size' }}
    >
      {map.shapes.map((shape, index) => (
        <div key={`shape-${index}`} aria-hidden="true" style={place(shape.x, shape.y, shape.width, shape.height)}
          className="absolute flex items-center justify-center overflow-hidden rounded-[4px] bg-black/[0.07] font-sans uppercase tracking-[0.06em] text-ink2">
          <span className="truncate px-1" style={{ fontSize: 'clamp(7px, 2.2cqw, 12px)' }}>{shape.label}</span>
        </div>
      ))}
      {map.tables.map((table, index) => {
        const box = tableBox(table.shape, table.chairs)
        return (
          <div key={`table-${index}`} aria-hidden="true" style={{ ...place(table.x, table.y, box.width, box.height), transform: `rotate(${table.rotation}deg)` }}
            className={clsx('absolute flex items-center justify-center', table.shape === 'round' ? 'rounded-full' : 'rounded-[4px]',
              table.mine ? 'z-[1] bg-ink text-cream shadow-[0_0_0_4px_rgba(46,31,26,0.18)]' : 'bg-white text-ink2 shadow-[0_0_0_1px_rgba(46,31,26,0.16)]')}>
            <span className={clsx('whitespace-nowrap font-sans leading-none', table.mine && 'font-semibold')} style={{ fontSize: 'clamp(6px, 2cqw, 12px)', transform: `rotate(${-table.rotation}deg)` }}>
              {table.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** The guest's own table and where it is in the room. Shown only once the couple publishes the seat plan. */
export function YourTable({ seating }: { seating: GuestSeating }) {
  return (
    <Group label="Your table" footnote="Seating can still change before the day. This page always shows the latest.">
      <Row>
        {seatingSentences(seating.seats).map(sentence => (
          <p key={sentence} className="font-serif text-[24px] leading-snug text-ink">{sentence}</p>
        ))}
      </Row>
      <Row><RoomMap map={seating.map} /></Row>
    </Group>
  )
}
