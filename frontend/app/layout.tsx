import { ClerkProvider } from '@clerk/nextjs'

import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html lang="en">
        <body className="bg-gray-950 text-white min-h-screen">
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}