import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  // Let the page draw under the phone's status bar, notch and home indicator, so the
  // browser's bars sit over the site's own content instead of a separate band of colour.
  viewportFit:  'cover',
  // Cream, matching the page. The home page keeps this in step with the section on screen
  // (see StatusBarColor), so the phone status bar never shows a mismatched band.
  themeColor:   '#FDFAF6',
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'),
  title:       'Luis & Bee — February 27, 2027',
  description: 'Join us to celebrate the wedding of Luis & Bee on February 27, 2027.',
  // Fallback for pages without their own preview. The home page builds its preview from Site settings.
  openGraph: {
    title:       'Luis & Bee',
    description: 'We are getting married on February 27, 2027. Join us to celebrate.',
    type:        'website',
    siteName:    'Luis & Bee',
    locale:      'en_PH',
    images: [{ url: '/preview-image', width: 1200, height: 630, alt: 'Luis & Bee, February 27, 2027' }],
  },
  twitter: { card: 'summary_large_image' },
  // The site's own icon, drawn from the couple's initials: browser tab, bookmarks and phone home screens.
  icons: {
    icon: [
      { url: '/app-icon/32', sizes: '32x32', type: 'image/png' },
      { url: '/app-icon/192', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/app-icon/180', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'Luis & Bee', statusBarStyle: 'black-translucent' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  )
}
