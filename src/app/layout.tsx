import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';

import { ConvexAuthNextjsServerProvider } from '@convex-dev/auth/nextjs/server';

import { siteUrl } from '@/lib/seo/site';
import { safeJsonLd } from '@/lib/safe-json-ld';
import { organizationSchema, websiteSchema } from '@/lib/seo/schema';
import { CookieConsent } from '@/components/cookie-consent';
import { PlausibleAnalytics } from '@/components/analytics';
import { ConvexClientProvider } from '@/components/convex-provider';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

/**
 * Display face — Fraunces, an editorial serif with a lawyerly, document-grade
 * weight (optical sizing, high contrast). Used with restraint for headlines and
 * statute citations; Inter carries all UI and body text.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Resolvaio — Security Deposit Recovery & Subscription Cancellation',
    template: '%s | Resolvaio',
  },
  description:
    'Demand letters and cancellation emails grounded in verified US consumer protection statutes. Security deposit recovery in California, Texas, New York, and Florida. Subscription cancellation in all 50 states.',
  metadataBase: new URL(siteUrl()),
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Resolvaio',
    title: 'Resolvaio — Security Deposit Recovery & Subscription Cancellation',
    description:
      'Demand letters and cancellation emails grounded in verified US consumer protection statutes. Covers CA, TX, NY, FL deposit law and ROSCA/FTC for subscriptions.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Resolvaio — Security Deposit Recovery & Subscription Cancellation',
    description:
      'Demand letters grounded in verified statutes. Security deposit recovery in CA, TX, NY, FL. Subscription cancellation in all 50 US states.',
  },
  alternates: {
    canonical: siteUrl(),
  },
  other: {
    'geo.region': 'US',
    'geo.placename': 'United States',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en-US" suppressHydrationWarning>
        <body className={`${inter.variable} ${fraunces.variable} font-sans antialiased`}>
          {/* Site-wide Organization + WebSite entities. Emitted once here so
              every page carries them and every #organization @id reference
              (Service provider, WebSite publisher) resolves — not just on the
              state pages that used to emit them locally. */}
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationSchema()) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(websiteSchema()) }} />
          <ConvexClientProvider>
            {children}
            <CookieConsent />
            <PlausibleAnalytics />
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
