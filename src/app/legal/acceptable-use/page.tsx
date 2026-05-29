import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Acceptable Use Policy',
  description: 'Acceptable Use Policy for Resolvaio.',
};

export default function AcceptableUsePolicyPage() {
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
          Acceptable Use Policy
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
              This Acceptable Use Policy (&ldquo;AUP&rdquo;) governs your use
              of Resolvaio. It supplements our{' '}
              <Link
                href="/legal/terms"
                className="text-[#111] underline underline-offset-4"
              >
                Terms of Service
              </Link>
              . Violation of this AUP may result in suspension or termination of
              your account.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  1. Intended Use                                           */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              1. Intended Use
            </h2>
            <p>
              Resolvaio is designed to help United States consumers draft demand
              letters for legitimate security deposit disputes and cancellation
              emails for unwanted subscriptions. Use of the Service must be for
              your own genuine consumer disputes.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  2. Prohibited Conduct                                     */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              2. Prohibited Conduct
            </h2>
            <p>You must not use the Service to:</p>

            <h3 className="mt-4 text-[16px] font-semibold text-[#333]">
              2.1 Fraud and Deception
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-6">
              <li>Submit false, fabricated, or misleading dispute information</li>
              <li>Upload forged, altered, or fraudulent documents</li>
              <li>Generate letters for disputes you know to be unfounded</li>
              <li>Misrepresent your identity or your relationship to a dispute</li>
              <li>File complaints with courts or agencies based on false information generated through the Service</li>
            </ul>

            <h3 className="mt-4 text-[16px] font-semibold text-[#333]">
              2.2 Harassment and Abuse
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-6">
              <li>Use generated letters to harass, threaten, or intimidate any person or entity</li>
              <li>Send excessive, repetitive, or bad-faith communications to counterparties</li>
              <li>Use the Service as a tool for extortion or coercion</li>
            </ul>

            <h3 className="mt-4 text-[16px] font-semibold text-[#333]">
              2.3 Unauthorized Practice of Law
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-6">
              <li>Represent yourself as an attorney or legal professional using Resolvaio-generated content</li>
              <li>Use the Service to provide legal advice to others</li>
              <li>Operate a legal services business using Resolvaio as your backend</li>
            </ul>

            <h3 className="mt-4 text-[16px] font-semibold text-[#333]">
              2.4 System Abuse
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-6">
              <li>Use automated bots, scripts, or scrapers to access the Service</li>
              <li>Attempt to circumvent rate limits, usage caps, or security controls</li>
              <li>Probe, scan, or test the vulnerability of the Service without authorization</li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
              <li>Create multiple accounts to circumvent refund limits, abuse caps, or enforcement actions</li>
            </ul>

            <h3 className="mt-4 text-[16px] font-semibold text-[#333]">
              2.5 Commercial Misuse
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-6">
              <li>Resell, sublicense, or redistribute the Service or generated content on behalf of third parties</li>
              <li>Use the Service to build a competing product</li>
              <li>Scrape or extract our knowledge base, statute database, or letter templates</li>
            </ul>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  3. Evidence Standards                                     */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              3. Evidence Authenticity
            </h2>
            <p>
              When uploading documents to the Service, you certify that:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-6">
              <li>All documents are genuine and have not been fabricated or altered to misrepresent facts</li>
              <li>You have the right to share these documents with the Service</li>
              <li>The information contained in the documents accurately reflects your actual dispute</li>
            </ul>
            <p className="mt-3">
              The Service does not independently verify the authenticity of
              uploaded materials. Submitting fraudulent documents may constitute
              a violation of applicable law in addition to this AUP.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  4. Usage Limits                                           */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              4. Usage Limits
            </h2>
            <p>
              To prevent abuse, subscription plans are subject to reasonable
              usage limits. If your usage exceeds normal consumer patterns, we
              may contact you to discuss your use case or throttle generation.
              Accounts exhibiting patterns consistent with automated or
              commercial use may be suspended.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  5. Enforcement                                            */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              5. Enforcement
            </h2>
            <p>
              We reserve the right to investigate and respond to violations of
              this AUP. Enforcement actions may include:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-6">
              <li>Warning or request to cease the prohibited activity</li>
              <li>Temporary suspension of your account</li>
              <li>Permanent termination of your account</li>
              <li>Refusal of refund requests</li>
              <li>Reporting to law enforcement if we believe illegal activity is involved</li>
            </ul>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  6. Reporting                                              */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              6. Reporting Violations
            </h2>
            <p>
              If you believe someone is using the Service in violation of this
              AUP, please report it to{' '}
              <a
                href="mailto:support@resolvaio.com"
                className="text-[#111] underline underline-offset-4"
              >
                support@resolvaio.com
              </a>{' '}
              with the subject &ldquo;AUP Violation Report.&rdquo;
            </p>
          </section>
        </div>

        <div className="mt-16 border-t border-[#E8E8E5] pt-8 text-center">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-[#8A8A8A]">
            <Link href="/legal/terms" className="transition-colors hover:text-[#111]">Terms</Link>
            <Link href="/legal/privacy" className="transition-colors hover:text-[#111]">Privacy</Link>
            <Link href="/legal/cookies" className="transition-colors hover:text-[#111]">Cookies</Link>
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
