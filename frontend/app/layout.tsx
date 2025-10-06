import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import '../styles/credit-system.css'
import { AuthProvider } from '@/lib/auth-context'
import { LanguageProvider } from '@/lib/language-context'
import { StripeProvider } from '@/components/stripe-provider'
import CookieBanner from '@/components/cookie-banner'
import CookieInitializer from '@/components/cookie-initializer'
import { GlobalAgeConsent } from '@/components/global-age-consent'

export const metadata: Metadata = {
  title: 'Pulpoo AI Platform',
  description: 'Build AI agents in minutes without code. Connect business tools, manage conversations, and scale your business with intelligent automation.',
  generator: 'Pulpoo AI Platform',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body suppressHydrationWarning={true}>
        <AuthProvider>
          <LanguageProvider>
            <StripeProvider>
              <CookieInitializer />
              {children}
              <CookieBanner />
              <GlobalAgeConsent />
            </StripeProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
