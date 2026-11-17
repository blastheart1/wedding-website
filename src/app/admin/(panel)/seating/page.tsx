import type { Metadata } from 'next'
import { SeatingView } from './_components/SeatingView'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Seat plan' }

export default function SeatingPage() {
  return <SeatingView />
}
