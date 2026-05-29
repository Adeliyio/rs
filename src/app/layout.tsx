import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { CookieConsent } from '@/components/cookie-consent';
import { PlausibleAnalytics } from '@/components/analytics';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Resolvaio',
    template: '%s | Resolvaio',
  },
  description:
    'From frustration to recovered money — one clear step at a time.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <CookieConsent />
        <PlausibleAnalytics />
      </body>
    </html>
  );
}
