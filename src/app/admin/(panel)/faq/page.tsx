import type { Metadata } from 'next'
import { FaqView } from './_components/FaqView'

export const metadata: Metadata = { title: 'FAQ' }

export default function FaqPage() {
  return <FaqView />
}
