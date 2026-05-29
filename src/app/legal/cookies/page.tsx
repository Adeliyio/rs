import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cookie & Tracking Policy',
  description: 'Cookie and tracking policy for Resolvaio.',
};

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen bg-[#F7F7F5] px-6 py-20">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-[13px] text-[#8A8A8A] transition-colors hover:text-[#111]"
        >
          Back to home
        </Link>

        <h1 className="mt-8 text-[32px] font-semibold tracking-tight text-[#111]">
          Cookie &amp; Tracking Policy
        </h1>
        <p className="mt-2 text-[13px] text-[#8A8A8A]">
          Effective Date: May 28, 2026 &middot; Last Updated: May 28, 2026
        </p>

        <div className="mt-10 space-y-8 text-[15px] leading-[1.7] text-[#5F5F5F]">
          {/* ---------------------------------------------------------- */}
          {/*  Overview                                                  */}
          {/* ---------------------------------------------------------- */}
          <section>
            <p>
              Resolvaio uses minimal tracking technologies. We do not use
              advertising cookies, marketing pixels, or third-party tracking
              cookies. This page explains exactly what we use and why.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  1. Cookies We Use                                         */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              1. Cookies We Use
            </h2>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-[#E8E8E5] text-left text-[#111]">
                    <th className="pb-2 pr-4 font-semibold">Cookie</th>
                    <th className="pb-2 pr-4 font-semibold">Type</th>
                    <th className="pb-2 pr-4 font-semibold">Purpose</th>
                    <th className="pb-2 font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody className="text-[#5F5F5F]">
                  <tr className="border-b border-[#E8E8E5]">
                    <td className="py-2.5 pr-4 font-mono text-[13px]">
                      sb-*-auth-token
                    </td>
                    <td className="py-2.5 pr-4">Strictly necessary</td>
                    <td className="py-2.5 pr-4">
                      Supabase authentication session. Required to keep you
                      logged in.
                    </td>
                    <td className="py-2.5">Session</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-4">
              That&rsquo;s it. We use one category of cookie, and it is strictly
              necessary for the Service to function. You cannot opt out of this
              cookie while using the Service, as it is required for
              authentication.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  2. localStorage                                           */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              2. Local Storage
            </h2>
            <p>
              We use browser localStorage for the following:
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-[#E8E8E5] text-left text-[#111]">
                    <th className="pb-2 pr-4 font-semibold">Key</th>
                    <th className="pb-2 font-semibold">Purpose</th>
                  </tr>
                </thead>
                <tbody className="text-[#5F5F5F]">
                  <tr>
                    <td className="py-2.5 pr-4 font-mono text-[13px]">
                      resolvaio_cookie_consent
                    </td>
                    <td className="py-2.5">
                      Records that you have acknowledged the cookie consent
                      banner.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              localStorage data is stored only in your browser and is never sent
              to our servers.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  3. Analytics                                              */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              3. Analytics (Cookie-Free)
            </h2>
            <p>
              We use{' '}
              <a
                href="https://plausible.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#111] underline underline-offset-4"
              >
                Plausible Analytics
              </a>
              , a privacy-focused analytics service that does not use cookies,
              does not collect personal data, and does not track users across
              sites. Plausible is fully compliant with GDPR, CCPA, and PECR
              without requiring consent.
            </p>
            <p className="mt-3">Plausible collects:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-6">
              <li>Aggregate page views (no individual tracking)</li>
              <li>Referrer source (where you came from)</li>
              <li>
                Custom events: case created, diagnostic completed, letter
                generated, letter sent, outcome reported (aggregate counts only,
                no personal identifiers)
              </li>
            </ul>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  4. Error Tracking                                         */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              4. Error Tracking
            </h2>
            <p>
              We use{' '}
              <a
                href="https://sentry.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#111] underline underline-offset-4"
              >
                Sentry
              </a>{' '}
              to monitor application errors and performance. Sentry does not use
              cookies for tracking. When an error occurs, Sentry may capture:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-6">
              <li>Error message and stack trace</li>
              <li>Browser type and version</li>
              <li>Request URL that triggered the error</li>
              <li>An anonymized user identifier (for deduplication)</li>
            </ul>
            <p className="mt-3">
              This data is used solely for debugging and is not used for
              marketing, advertising, or user profiling.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  5. What We Don't Use                                      */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              5. What We Do Not Use
            </h2>
            <ul className="list-disc space-y-2.5 pl-6">
              <li>Advertising or marketing cookies</li>
              <li>Third-party tracking pixels (Facebook, Google, etc.)</li>
              <li>Cross-site tracking</li>
              <li>Browser fingerprinting</li>
              <li>Retargeting or remarketing technologies</li>
            </ul>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  6. Contact                                                */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              6. Questions
            </h2>
            <p>
              Questions about our use of cookies or tracking? Email{' '}
              <a
                href="mailto:support@resolvaio.com"
                className="text-[#111] underline underline-offset-4"
              >
                support@resolvaio.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-16 border-t border-[#E8E8E5] pt-8 text-center">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-[#8A8A8A]">
            <Link href="/legal/terms" className="transition-colors hover:text-[#111]">Terms</Link>
            <Link href="/legal/privacy" className="transition-colors hover:text-[#111]">Privacy</Link>
            <Link href="/legal/acceptable-use" className="transition-colors hover:text-[#111]">Acceptable Use</Link>
            <Link href="/legal/ai-disclosure" className="transition-colors hover:text-[#111]">AI Disclosure</Link>
            <Link href="/legal/accessibility" className="transition-colors hover:text-[#111]">Accessibility</Link>
          </div>
          <p className="mt-4 text-[12px] text-[#8A8A8A]">
            &copy; {new Date().getFullYear()} Resolvaio. All rights reserved.
            Resolvaio is owned and operated by Nikola Innovations Limited.
          </p>
        </div>
      </div>
    </main>
  );
}
