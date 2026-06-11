import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'Aitomic Flow',
  description:
    'Your team always knows what to do next. Visual workflow builder for teams — no code required.',
  metadataBase: new URL('https://aitomicflow.com'),
  openGraph: {
    title: 'Aitomic Flow',
    description:
      'Your team always knows what to do next. Visual workflow builder for teams — no code required.',
    url: 'https://aitomicflow.com',
    siteName: 'Aitomic Flow',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Aitomic Flow' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aitomic Flow',
    description:
      'Your team always knows what to do next. Visual workflow builder for teams — no code required.',
    images: ['/og.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  )
}
