import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { ConvexAuthNextjsServerProvider } from '@convex-dev/auth/nextjs/server';

import { siteUrl } from '@/lib/seo/site';
import { CookieConsent } from '@/components/cookie-consent';
import { PlausibleAnalytics } from '@/components/analytics';
import { ConvexClientProvider } from '@/components/convex-provider';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
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
        <body className={`${inter.variable} font-sans antialiased`}>
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
