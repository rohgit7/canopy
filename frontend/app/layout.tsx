import { ClerkProvider } from '@clerk/nextjs'
import localFont from 'next/font/local'
import { ScanProvider } from '@/context/ScanContext'

import './globals.css'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  display: 'swap',
})

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  display: 'swap',
})

export const metadata = {
  title: 'Canopy - AWS Security Graph & Attack Path Analyzer',
  description: 'Real-time graph analysis, attack path engine, and IAM analyzer for AWS security',
  icons: {
    icon: '/canopy-logo.svg',
    shortcut: '/canopy-logo.svg',
    apple: '/canopy-logo.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html lang="en">
        <head>
          <link rel="icon" type="image/svg+xml" href="/canopy-logo.svg" />
          <link rel="shortcut icon" href="/canopy-logo.svg" />
          <link rel="apple-touch-icon" href="/canopy-logo.svg" />
        </head>
        <body className={`${geistSans.variable} ${geistMono.variable}`}>
          <ScanProvider>
            {children}
          </ScanProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
