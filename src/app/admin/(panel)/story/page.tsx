import type { Metadata } from 'next'
import { StoryView } from './_components/StoryView'

export const metadata: Metadata = { title: 'Story' }

export default function StoryPage() {
  return <StoryView />
}
