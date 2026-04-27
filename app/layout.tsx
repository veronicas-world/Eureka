import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import { Sidebar } from '@/components/Sidebar'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Eureka — VC Sourcing',
  description: 'Startup sourcing and deal tracking for venture investors.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${jetbrainsMono.variable}`}>
      <body className="h-full flex antialiased" style={{ fontFamily: 'var(--font-jetbrains), ui-monospace, monospace', background: 'var(--paper)' }}>
        <Sidebar />
        <main className="flex-1 overflow-y-auto min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
