import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for Resolvaio.',
};

export default function PrivacyPolicyPage() {
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
          Privacy Policy
        </h1>
        <p className="mt-2 text-[13px] text-[#8A8A8A]">
          Effective Date: May 28, 2026 &middot; Last Updated: May 28, 2026
        </p>

        <div className="mt-10 space-y-8 text-[15px] leading-[1.7] text-[#5F5F5F]">
          {/* ---------------------------------------------------------- */}
          {/*  Introduction                                              */}
          {/* ---------------------------------------------------------- */}
          <section>
            <p>
              Resolvaio, owned and operated by Nikola Innovations Limited
              (&ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;),
              respects your privacy. This Privacy Policy explains what
              information we collect, how we use it, who we share it with, and
              your rights regarding your data when you use our website and
              services at resolvaio.com and app.resolvaio.com.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  1. Information We Collect                                  */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              1. Information We Collect
            </h2>

            <h3 className="mt-4 text-[16px] font-semibold text-[#333]">
              1.1 Account Information
            </h3>
            <p>
              When you register, we collect your email address and a hashed
              password. We also record your account creation date and a unique
              user identifier.
            </p>

            <h3 className="mt-4 text-[16px] font-semibold text-[#333]">
              1.2 Case and Dispute Data
            </h3>
            <p>
              When you use the Service, we collect information about your
              dispute, including:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-6">
              <li>Answers to diagnostic questions (jurisdiction, dispute type, amounts, dates)</li>
              <li>Case status and history</li>
              <li>Generated demand letters, email sequences, and filing packets</li>
              <li>Reported outcomes (optional, with your consent)</li>
            </ul>

            <h3 className="mt-4 text-[16px] font-semibold text-[#333]">
              1.3 Uploaded Documents
            </h3>
            <p>
              You may upload documents such as lease agreements, billing
              statements, photos, and screenshots. Accepted formats include PDF,
              JPEG, PNG, HEIC, and HEIF (maximum 10 MB per file). We use AI
              vision to extract relevant data from these documents to generate
              your letters.
            </p>

            <h3 className="mt-4 text-[16px] font-semibold text-[#333]">
              1.4 Payment Information
            </h3>
            <p>
              Payments are processed by Paddle. We store Paddle transaction IDs,
              subscription IDs, payment status, and billing period dates.{' '}
              <strong className="text-[#111]">
                We do not store your credit card number, CVV, or bank account
                details.
              </strong>{' '}
              That information is handled entirely by Paddle. See{' '}
              <a
                href="https://www.paddle.com/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#111] underline underline-offset-4"
              >
                Paddle&rsquo;s Privacy Policy
              </a>
              .
            </p>

            <h3 className="mt-4 text-[16px] font-semibold text-[#333]">
              1.5 Automatically Collected Information
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-6">
              <li>
                <strong className="text-[#111]">Authentication logs:</strong> IP
                address, user agent, login timestamp, and success/failure status
                for security purposes.
              </li>
              <li>
                <strong className="text-[#111]">Analytics:</strong> We use
                Plausible Analytics, a privacy-focused, cookie-free analytics
                service. Plausible collects aggregate page views and custom
                events (e.g., case created, letter generated) without personal
                identifiers. See{' '}
                <a
                  href="https://plausible.io/data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#111] underline underline-offset-4"
                >
                  Plausible&rsquo;s Data Policy
                </a>
                .
              </li>
              <li>
                <strong className="text-[#111]">Error tracking:</strong> We use
                Sentry to capture application errors. Error reports may include
                request traces and, optionally, a user identifier for debugging.
                See{' '}
                <a
                  href="https://sentry.io/privacy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#111] underline underline-offset-4"
                >
                  Sentry&rsquo;s Privacy Policy
                </a>
                .
              </li>
            </ul>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  2. How We Use Your Information                             */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              2. How We Use Your Information
            </h2>
            <ul className="list-disc space-y-2.5 pl-6">
              <li>
                <strong className="text-[#111]">Provide the Service:</strong>{' '}
                Generate demand letters, cancellation sequences, and filing
                packets based on your case information.
              </li>
              <li>
                <strong className="text-[#111]">Process payments:</strong>{' '}
                Facilitate transactions through Paddle and manage subscription
                status.
              </li>
              <li>
                <strong className="text-[#111]">Send transactional emails:</strong>{' '}
                Deliver generated documents, account confirmations, and deadline
                reminders via Resend.
              </li>
              <li>
                <strong className="text-[#111]">Improve the Service:</strong>{' '}
                Analyze aggregate, anonymized usage patterns to improve
                reliability and user experience.
              </li>
              <li>
                <strong className="text-[#111]">Security and fraud prevention:</strong>{' '}
                Monitor for abuse, unauthorized access, and fraudulent activity.
              </li>
              <li>
                <strong className="text-[#111]">Legal compliance:</strong>{' '}
                Respond to lawful requests and comply with applicable law.
              </li>
            </ul>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  3. Third-Party Service Providers                          */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              3. Third-Party Service Providers (Sub-Processors)
            </h2>
            <p>
              We share data with the following providers solely to operate the
              Service:
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-[#E8E8E5] text-left text-[#111]">
                    <th className="pb-2 pr-4 font-semibold">Provider</th>
                    <th className="pb-2 pr-4 font-semibold">Purpose</th>
                    <th className="pb-2 font-semibold">Data Shared</th>
                  </tr>
                </thead>
                <tbody className="text-[#5F5F5F]">
                  <tr className="border-b border-[#E8E8E5]">
                    <td className="py-2.5 pr-4 font-medium text-[#111]">Supabase</td>
                    <td className="py-2.5 pr-4">Database, authentication, file storage</td>
                    <td className="py-2.5">All account and case data</td>
                  </tr>
                  <tr className="border-b border-[#E8E8E5]">
                    <td className="py-2.5 pr-4 font-medium text-[#111]">OpenAI</td>
                    <td className="py-2.5 pr-4">AI text and vision generation</td>
                    <td className="py-2.5">Case context, document contents (zero data retention enabled)</td>
                  </tr>
                  <tr className="border-b border-[#E8E8E5]">
                    <td className="py-2.5 pr-4 font-medium text-[#111]">Tavily</td>
                    <td className="py-2.5 pr-4">Statute verification via web search</td>
                    <td className="py-2.5">Jurisdiction and statute queries (cached, no PII)</td>
                  </tr>
                  <tr className="border-b border-[#E8E8E5]">
                    <td className="py-2.5 pr-4 font-medium text-[#111]">Paddle</td>
                    <td className="py-2.5 pr-4">Payment processing</td>
                    <td className="py-2.5">Email, transaction and subscription data</td>
                  </tr>
                  <tr className="border-b border-[#E8E8E5]">
                    <td className="py-2.5 pr-4 font-medium text-[#111]">Resend</td>
                    <td className="py-2.5 pr-4">Transactional email delivery</td>
                    <td className="py-2.5">Email address, letter content</td>
                  </tr>
                  <tr className="border-b border-[#E8E8E5]">
                    <td className="py-2.5 pr-4 font-medium text-[#111]">Plausible</td>
                    <td className="py-2.5 pr-4">Privacy-focused analytics</td>
                    <td className="py-2.5">Aggregate page views and events (no PII, no cookies)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium text-[#111]">Sentry</td>
                    <td className="py-2.5 pr-4">Error monitoring</td>
                    <td className="py-2.5">Error logs, request traces</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              <strong className="text-[#111]">OpenAI Zero Data Retention:</strong>{' '}
              We have enabled zero data retention on our OpenAI API account.
              This means OpenAI does not store your case data or document
              contents after processing and does not use your data to train its
              models.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  4. Cookies & Tracking                                     */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              4. Cookies and Tracking Technologies
            </h2>
            <p>
              We use <strong className="text-[#111]">strictly necessary cookies only</strong>{' '}
              for authentication (Supabase session cookies). We do not use
              advertising cookies, marketing pixels, or third-party tracking
              cookies. Our analytics provider (Plausible) is entirely
              cookie-free. See our full{' '}
              <Link
                href="/legal/cookies"
                className="text-[#111] underline underline-offset-4"
              >
                Cookie Policy
              </Link>{' '}
              for details.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  5. Data Retention                                         */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              5. Data Retention
            </h2>
            <ul className="list-disc space-y-2.5 pl-6">
              <li>
                <strong className="text-[#111]">Account data:</strong> Retained
                for the lifetime of your account.
              </li>
              <li>
                <strong className="text-[#111]">Case data and documents:</strong>{' '}
                Retained for the lifetime of your account. Deleted when you
                delete your account.
              </li>
              <li>
                <strong className="text-[#111]">Payment records:</strong>{' '}
                Transaction records are retained for 7 years for tax and
                regulatory compliance, even after account deletion.
              </li>
              <li>
                <strong className="text-[#111]">Authentication logs:</strong>{' '}
                Login attempt records are retained for 90 days for security
                purposes.
              </li>
              <li>
                <strong className="text-[#111]">Audit logs:</strong> System
                audit logs are anonymized (not deleted) upon account deletion
                and retained for operational integrity.
              </li>
              <li>
                <strong className="text-[#111]">Statute search cache:</strong>{' '}
                Tavily search results are cached for 30 days and contain no
                personal information.
              </li>
            </ul>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  6. Data Security                                          */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              6. Data Security
            </h2>
            <p>
              We implement industry-standard security measures to protect your
              data, including:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-6">
              <li>Encryption of sensitive fields at rest</li>
              <li>HTTPS encryption for all data in transit</li>
              <li>Row-Level Security (RLS) ensuring users can only access their own data</li>
              <li>Hashed passwords (never stored in plaintext)</li>
              <li>Rate limiting and IP-based abuse prevention</li>
              <li>Webhook signature verification for payment events</li>
            </ul>
            <p className="mt-3">
              No method of transmission or storage is 100% secure. While we
              strive to protect your data, we cannot guarantee absolute security.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  7. Your Rights                                            */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              7. Your Privacy Rights
            </h2>

            <h3 className="mt-4 text-[16px] font-semibold text-[#333]">
              7.1 All Users
            </h3>
            <p>All users have the right to:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-6">
              <li>
                <strong className="text-[#111]">Access:</strong> Export a full
                copy of your data in JSON format via your account settings or by
                emailing us.
              </li>
              <li>
                <strong className="text-[#111]">Deletion:</strong> Permanently
                delete your account and all associated data (cases, documents,
                letters, sequences, subscriptions) via your account settings or
                by emailing us. Deletion is cascading and includes files stored
                in our cloud storage.
              </li>
              <li>
                <strong className="text-[#111]">Correction:</strong> Update your
                account information through your account settings.
              </li>
            </ul>

            <h3 className="mt-4 text-[16px] font-semibold text-[#333]">
              7.2 California Residents (CCPA/CPRA)
            </h3>
            <p>
              If you are a California resident, you have additional rights under
              the California Consumer Privacy Act (CCPA) and the California
              Privacy Rights Act (CPRA):
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-6">
              <li>
                <strong className="text-[#111]">Right to Know:</strong> You may
                request the categories and specific pieces of personal
                information we have collected about you.
              </li>
              <li>
                <strong className="text-[#111]">Right to Delete:</strong> You
                may request deletion of your personal information, subject to
                certain exceptions.
              </li>
              <li>
                <strong className="text-[#111]">Right to Opt-Out of Sale:</strong>{' '}
                We do not sell your personal information. We do not share your
                personal information for cross-context behavioral advertising.
              </li>
              <li>
                <strong className="text-[#111]">
                  Right to Non-Discrimination:
                </strong>{' '}
                We will not discriminate against you for exercising your privacy
                rights.
              </li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email{' '}
              <a
                href="mailto:support@resolvaio.com"
                className="text-[#111] underline underline-offset-4"
              >
                support@resolvaio.com
              </a>{' '}
              with the subject &ldquo;CCPA Request.&rdquo; We will respond
              within 45 days.
            </p>

            <h3 className="mt-4 text-[16px] font-semibold text-[#333]">
              7.3 Other US State Privacy Laws
            </h3>
            <p>
              Residents of states with comprehensive privacy laws (including
              Virginia, Colorado, Connecticut, Utah, and others) may have
              similar rights to access, delete, and correct their personal data.
              Contact us at{' '}
              <a
                href="mailto:support@resolvaio.com"
                className="text-[#111] underline underline-offset-4"
              >
                support@resolvaio.com
              </a>{' '}
              to exercise these rights.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  8. Do Not Sell                                             */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              8. Do Not Sell or Share My Personal Information
            </h2>
            <p>
              We do not sell your personal information. We do not share your
              personal information with third parties for their marketing
              purposes. Data shared with our sub-processors (listed in Section
              3) is shared solely to provide the Service to you.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  9. Children                                               */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              9. Children&rsquo;s Privacy
            </h2>
            <p>
              The Service is not intended for anyone under the age of 18. We do
              not knowingly collect personal information from children. If you
              believe a child has provided us with personal information, please
              contact us at{' '}
              <a
                href="mailto:support@resolvaio.com"
                className="text-[#111] underline underline-offset-4"
              >
                support@resolvaio.com
              </a>{' '}
              and we will delete it promptly.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  10. International Users                                   */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              10. International Users
            </h2>
            <p>
              The Service is designed for United States consumers. If you access
              the Service from outside the United States, please be aware that
              your data will be transferred to and processed in the United
              States. By using the Service, you consent to this transfer.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  11. Changes                                               */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              11. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of material changes by posting the updated policy on
              this page and updating the &ldquo;Last Updated&rdquo; date. Your
              continued use of the Service after changes constitutes acceptance.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  12. Contact                                               */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-[#111]">
              12. Contact Us
            </h2>
            <p>
              For privacy-related inquiries, data export requests, or data
              deletion requests, contact us at:
            </p>
            <p className="mt-3">
              <strong className="text-[#111]">Email:</strong>{' '}
              <a
                href="mailto:support@resolvaio.com"
                className="text-[#111] underline underline-offset-4"
              >
                support@resolvaio.com
              </a>
            </p>
            <p className="mt-1">
              <strong className="text-[#111]">Subject line:</strong>{' '}
              &ldquo;Privacy Request&rdquo;
            </p>
            <p className="mt-3">
              We will respond to all verified requests within 30 days.
            </p>
          </section>
        </div>

        <div className="mt-16 border-t border-[#E8E8E5] pt-8 text-center">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-[#8A8A8A]">
            <Link href="/legal/terms" className="transition-colors hover:text-[#111]">Terms</Link>
            <Link href="/legal/cookies" className="transition-colors hover:text-[#111]">Cookies</Link>
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
