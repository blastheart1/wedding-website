import type { Metadata } from 'next'
import { SettingsView } from './_components/SettingsView'

export const metadata: Metadata = { title: 'Site settings' }

export default function SettingsPage() {
  return <SettingsView />
}
