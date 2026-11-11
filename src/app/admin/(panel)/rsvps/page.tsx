import type { Metadata } from 'next'
import { RsvpsView } from './_components/RsvpsView'

export const metadata: Metadata = { title: 'RSVPs' }

export default function RsvpsPage() {
  return <RsvpsView />
}
