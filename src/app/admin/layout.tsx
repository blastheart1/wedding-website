import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'Wedding admin', template: '%s · Wedding admin' },
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
