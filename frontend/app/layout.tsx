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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable}`}>
          <ScanProvider>
            {children}
          </ScanProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
