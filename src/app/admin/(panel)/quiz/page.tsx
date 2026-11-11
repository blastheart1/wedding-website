import type { Metadata } from 'next'
import { QuizView } from './_components/QuizView'

export const metadata: Metadata = { title: 'Quiz' }

export default function QuizPage() {
  return <QuizView />
}
