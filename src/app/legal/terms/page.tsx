import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Resolvaio.',
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-background px-6 py-20">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Back to home
        </Link>

        <h1 className="mt-8 text-[32px] font-semibold tracking-tight text-foreground">
          Terms of Service
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Effective Date: May 28, 2026 &middot; Last Updated: May 28, 2026
        </p>

        <div className="mt-10 space-y-8 text-[15px] leading-[1.7] text-muted-foreground">
          {/* ---------------------------------------------------------- */}
          {/*  1. Acceptance                                             */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using Resolvaio (&ldquo;Service&rdquo;), owned
              and operated by Nikola Innovations Limited, at resolvaio.com and
              app.resolvaio.com, you agree to be bound by
              these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree,
              do not use the Service. We may update these Terms at any time by
              posting a revised version. Your continued use after changes
              constitutes acceptance.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  2. Service Description                                    */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              2. Service Description
            </h2>
            <p>
              Resolvaio is a <strong className="text-foreground">writing assistance tool</strong> that
              helps United States consumers draft demand letters for security
              deposit disputes and cancellation email sequences for unwanted
              subscriptions. The Service uses artificial intelligence to generate
              documents grounded in jurisdiction-specific consumer protection
              statutes.
            </p>
            <p className="mt-3">
              <strong className="text-foreground">
                Resolvaio is not a law firm and does not provide legal advice.
              </strong>{' '}
              Use of the Service does not create an attorney-client
              relationship. Generated documents are starting points that you
              should review carefully and may wish to have reviewed by a
              licensed attorney before sending. We do not evaluate whether you
              have a valid claim, predict outcomes, or guarantee results.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  3. Eligibility                                            */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              3. Eligibility
            </h2>
            <p>
              You must be at least 18 years old and a legal resident of the
              United States to use the Service. By using the Service, you
              represent and warrant that you meet these requirements.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  4. Account                                                */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              4. Account Registration
            </h2>
            <p>
              You must create an account to use certain features. You are
              responsible for maintaining the confidentiality of your login
              credentials and for all activity under your account. Notify us
              immediately at{' '}
              <a
                href="mailto:support@resolvaio.com"
                className="text-foreground underline underline-offset-4"
              >
                support@resolvaio.com
              </a>{' '}
              if you suspect unauthorized access.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  5. Pricing & Payment                                      */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              5. Pricing and Payment
            </h2>
            <ul className="list-disc space-y-2.5 pl-6">
              <li>
                <strong className="text-foreground">
                  Subscription Cancellation Emails:
                </strong>{' '}
                Free. No payment required.
              </li>
              <li>
                <strong className="text-foreground">
                  Single Deposit Demand Letter:
                </strong>{' '}
                $49 one-time payment.
              </li>
              <li>
                <strong className="text-foreground">Unlimited Plan:</strong> $15/month
                or $129/year, providing unlimited deposit case generation.
              </li>
            </ul>
            <p className="mt-3">
              All payments are processed by our third-party payment processor and
              merchant of record, Polar. By purchasing, you agree to{' '}
              <a
                href="https://polar.sh/legal/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-4"
              >
                Polar&rsquo;s Terms of Service
              </a>
              . Prices are in USD and may be subject to applicable taxes.
              Resolvaio does not store your credit card information.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  6. Refund Policy                                          */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              6. Refund Policy
            </h2>
            <p>
              We want you to be satisfied with the Service. Refunds are handled
              as follows:
            </p>
            <ul className="mt-3 list-disc space-y-2.5 pl-6">
              <li>
                <strong className="text-foreground">Before letter generation:</strong>{' '}
                If you have paid but have not yet generated your demand letter,
                you may request a full refund within 7 days of purchase.
              </li>
              <li>
                <strong className="text-foreground">After letter generation:</strong>{' '}
                Once your demand letter has been generated and delivered to you,
                the service is considered rendered. Refunds after generation are
                available only if the Service produced a materially defective
                output (e.g., wrong jurisdiction, system error preventing
                delivery, or incorrect statutory citations). &ldquo;I changed my
                mind&rdquo; is not grounds for a refund after delivery.
              </li>
              <li>
                <strong className="text-foreground">Unsupported jurisdiction:</strong>{' '}
                If your jurisdiction is not supported, you will be refunded
                automatically.
              </li>
              <li>
                <strong className="text-foreground">Subscriptions:</strong> You may
                cancel your subscription at any time. Cancellation takes effect
                at the end of your current billing period. No refunds are issued
                for partial billing periods.
              </li>
              <li>
                <strong className="text-foreground">Limit:</strong> One refund per
                account. Accounts with a pattern of refund requests may be
                suspended.
              </li>
            </ul>
            <p className="mt-3">
              To request a refund, email{' '}
              <a
                href="mailto:support@resolvaio.com"
                className="text-foreground underline underline-offset-4"
              >
                support@resolvaio.com
              </a>{' '}
              with your transaction ID.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  7. Acceptable Use                                         */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              7. Acceptable Use
            </h2>
            <p>
              You agree not to use the Service to:
            </p>
            <ul className="mt-3 list-disc space-y-2.5 pl-6">
              <li>Submit false, fraudulent, or misleading information</li>
              <li>Generate letters based on fabricated disputes or forged documents</li>
              <li>Harass, threaten, or intimidate any individual or entity</li>
              <li>Attempt to gain unauthorized access to the Service or other users&rsquo; accounts</li>
              <li>Use automated scripts, bots, or scrapers to access the Service</li>
              <li>Resell, redistribute, or commercially exploit generated content on behalf of third parties</li>
              <li>Circumvent usage limits, rate limits, or abuse safeguards</li>
              <li>Use the Service for any purpose that violates applicable law</li>
            </ul>
            <p className="mt-3">
              We reserve the right to suspend or terminate accounts that violate
              these rules. See our full{' '}
              <Link
                href="/legal/acceptable-use"
                className="text-foreground underline underline-offset-4"
              >
                Acceptable Use Policy
              </Link>{' '}
              for details.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  8. User Content & IP                                      */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              8. Your Content and Intellectual Property
            </h2>
            <p>
              <strong className="text-foreground">Your content:</strong> You retain
              ownership of all documents, information, and materials you upload
              to the Service. By uploading content, you grant Resolvaio a
              limited, non-exclusive license to process that content solely to
              provide the Service to you.
            </p>
            <p className="mt-3">
              <strong className="text-foreground">Generated documents:</strong> You
              own the demand letters, email sequences, and filing packets
              generated for you through the Service. You are free to use, modify,
              and send them as you see fit. Resolvaio retains no ownership claim
              over generated documents.
            </p>
            <p className="mt-3">
              <strong className="text-foreground">Resolvaio IP:</strong> The
              Service, including its design, code, knowledge base, and
              underlying technology, is owned by Resolvaio and protected by
              intellectual property laws. These Terms do not grant you any rights
              to our trademarks, branding, or proprietary technology.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  9. Evidence & Accuracy                                    */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              9. Evidence Authenticity and Accuracy
            </h2>
            <p>
              You represent and warrant that all documents, information, and
              evidence you provide to the Service are genuine, accurate, and not
              forged, altered, or misleading. The Service does not independently
              verify the authenticity of uploaded materials. You are solely
              responsible for the truthfulness of all information you provide and
              for any consequences of submitting false or misleading materials.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  10. AI Disclosure                                         */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              10. AI-Generated Content
            </h2>
            <p>
              The Service uses artificial intelligence (including OpenAI models)
              to generate documents. AI-generated content may contain errors,
              omissions, or inaccuracies despite our citation validation process.
              You are responsible for reviewing all generated content before use.
              See our full{' '}
              <Link
                href="/legal/ai-disclosure"
                className="text-foreground underline underline-offset-4"
              >
                AI-Generated Content Disclosure
              </Link>{' '}
              for details.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  11. Electronic Communications                             */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              11. Electronic Communications Consent
            </h2>
            <p>
              By creating an account, you consent to receive electronic
              communications from Resolvaio, including transactional emails
              (account confirmations, generated documents, deadline reminders)
              and service-related notices. We do not send marketing emails. You
              may delete your account at any time to stop receiving
              communications.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  12. Disclaimers                                           */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              12. Disclaimers
            </h2>
            <p className="uppercase tracking-wide">
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as
              available&rdquo; without warranties of any kind, express or
              implied, including but not limited to warranties of
              merchantability, fitness for a particular purpose, accuracy, or
              non-infringement.
            </p>
            <p className="mt-3">
              Without limiting the foregoing, Resolvaio does not warrant that:
            </p>
            <ul className="mt-3 list-disc space-y-2.5 pl-6">
              <li>Generated documents will achieve any particular outcome</li>
              <li>Statutory citations are current or applicable to your specific situation</li>
              <li>The Service will be uninterrupted, error-free, or secure</li>
              <li>The counterparty will respond to or comply with your letter</li>
            </ul>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  13. Limitation of Liability                               */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              13. Limitation of Liability
            </h2>
            <p className="uppercase tracking-wide">
              To the maximum extent permitted by law, Resolvaio, its officers,
              directors, employees, and agents shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages,
              including but not limited to loss of profits, data, or goodwill,
              arising from your use of or inability to use the Service.
            </p>
            <p className="mt-3 uppercase tracking-wide">
              In no event shall Resolvaio&rsquo;s total aggregate liability
              exceed the amount you paid to Resolvaio in the twelve (12) months
              preceding the claim.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  14. Indemnification                                       */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              14. Indemnification
            </h2>
            <p>
              You agree to indemnify, defend, and hold harmless Resolvaio and
              its officers, directors, employees, and agents from and against
              any claims, liabilities, damages, losses, and expenses (including
              reasonable attorneys&rsquo; fees) arising out of or relating to:
              (a) your use of the Service; (b) your violation of these Terms;
              (c) your violation of any third-party rights; (d) the content or
              accuracy of information you provide; or (e) your sending of any
              generated documents.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  15. Dispute Resolution                                    */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              15. Dispute Resolution and Arbitration
            </h2>
            <p>
              <strong className="text-foreground">Informal Resolution:</strong> Before
              filing any formal proceeding, you agree to contact us at{' '}
              <a
                href="mailto:support@resolvaio.com"
                className="text-foreground underline underline-offset-4"
              >
                support@resolvaio.com
              </a>{' '}
              and attempt to resolve the dispute informally for at least 30
              days.
            </p>
            <p className="mt-3">
              <strong className="text-foreground">Binding Arbitration:</strong> Any
              dispute not resolved informally shall be settled by binding
              arbitration administered by the American Arbitration Association
              (&ldquo;AAA&rdquo;) under its Consumer Arbitration Rules. The
              arbitration shall be conducted in English.
            </p>
            <p className="mt-3">
              <strong className="text-foreground">Class Action Waiver:</strong> You
              agree that disputes will be resolved on an individual basis. You
              waive any right to participate in a class action, collective
              action, or representative proceeding.
            </p>
            <p className="mt-3">
              <strong className="text-foreground">Small Claims Exception:</strong>{' '}
              Either party may bring an individual action in small claims court
              if the claim qualifies.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  16. DMCA                                                  */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              16. Copyright and DMCA
            </h2>
            <p>
              If you believe that content on the Service infringes your
              copyright, please send a DMCA takedown notice to{' '}
              <a
                href="mailto:support@resolvaio.com"
                className="text-foreground underline underline-offset-4"
              >
                support@resolvaio.com
              </a>{' '}
              including: (a) identification of the copyrighted work; (b)
              identification of the infringing material and its location; (c)
              your contact information; (d) a statement of good-faith belief
              that the use is unauthorized; and (e) a statement under penalty of
              perjury that the information is accurate and you are authorized to
              act on behalf of the copyright owner.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  17. Termination                                           */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              17. Termination
            </h2>
            <p>
              You may delete your account at any time through your account
              settings or by emailing{' '}
              <a
                href="mailto:support@resolvaio.com"
                className="text-foreground underline underline-offset-4"
              >
                support@resolvaio.com
              </a>
              . We may suspend or terminate your account if you violate these
              Terms, engage in fraudulent activity, or abuse the Service.
              Sections 8, 9, 12, 13, 14, and 15 survive termination.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  18. Governing Law                                         */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              18. Governing Law
            </h2>
            <p>
              These Terms shall be governed by and construed in accordance with
              the laws of the State of Delaware, without regard to its conflict
              of law provisions.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  19. Severability                                          */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              19. Severability
            </h2>
            <p>
              If any provision of these Terms is found to be unenforceable, the
              remaining provisions will continue in full force and effect.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  20. Entire Agreement                                      */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              20. Entire Agreement
            </h2>
            <p>
              These Terms, together with our{' '}
              <Link
                href="/legal/privacy"
                className="text-foreground underline underline-offset-4"
              >
                Privacy Policy
              </Link>
              ,{' '}
              <Link
                href="/legal/acceptable-use"
                className="text-foreground underline underline-offset-4"
              >
                Acceptable Use Policy
              </Link>
              , and{' '}
              <Link
                href="/legal/cookies"
                className="text-foreground underline underline-offset-4"
              >
                Cookie Policy
              </Link>
              , constitute the entire agreement between you and Resolvaio
              regarding the Service.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  21. Contact                                               */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              21. Contact
            </h2>
            <p>
              Questions about these Terms? Email us at{' '}
              <a
                href="mailto:support@resolvaio.com"
                className="text-foreground underline underline-offset-4"
              >
                support@resolvaio.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-16 border-t border-border pt-8 text-center">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            <Link href="/legal/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link href="/legal/cookies" className="transition-colors hover:text-foreground">Cookies</Link>
            <Link href="/legal/acceptable-use" className="transition-colors hover:text-foreground">Acceptable Use</Link>
            <Link href="/legal/ai-disclosure" className="transition-colors hover:text-foreground">AI Disclosure</Link>
            <Link href="/legal/accessibility" className="transition-colors hover:text-foreground">Accessibility</Link>
          </div>
          <p className="mt-4 text-[12px] text-muted-foreground">
            &copy; {new Date().getFullYear()} Resolvaio. All rights reserved.
            Resolvaio is owned and operated by Nikola Innovations Limited.
          </p>
        </div>
      </div>
    </main>
  );
}
