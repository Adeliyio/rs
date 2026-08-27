import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Accessibility Statement',
  description: 'Accessibility statement for Resolvaio.',
};

export default function AccessibilityPage() {
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
          Accessibility Statement
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Last Updated: May 28, 2026
        </p>

        <div className="mt-10 space-y-8 text-[15px] leading-[1.7] text-muted-foreground">
          {/* ---------------------------------------------------------- */}
          {/*  Commitment                                                */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              Our Commitment
            </h2>
            <p>
              Resolvaio is committed to ensuring digital accessibility for
              people with disabilities. We are continually improving the user
              experience for everyone and applying the relevant accessibility
              standards.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  Standards                                                 */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              Conformance Status
            </h2>
            <p>
              We aim to conform to the{' '}
              <a
                href="https://www.w3.org/WAI/standards-guidelines/wcag/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-4"
              >
                Web Content Accessibility Guidelines (WCAG) 2.1
              </a>{' '}
              at the AA level. These guidelines explain how to make web content
              more accessible to people with a wide range of disabilities.
            </p>
            <p className="mt-3">
              Our current conformance status is{' '}
              <strong className="text-foreground">partial</strong>. We are actively
              working to identify and resolve accessibility gaps.
            </p>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  What We Do                                                */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              Measures We Take
            </h2>
            <ul className="list-disc space-y-2.5 pl-6">
              <li>Semantic HTML structure throughout the application</li>
              <li>Sufficient color contrast ratios for text and interactive elements</li>
              <li>Keyboard navigability for core workflows</li>
              <li>Descriptive link text and form labels</li>
              <li>Responsive design that adapts to various screen sizes and zoom levels</li>
              <li>Clear, plain-language content</li>
            </ul>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  Known Limitations                                         */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              Known Limitations
            </h2>
            <p>
              We recognize that some parts of the Service may not yet be fully
              accessible. Known areas where we are working to improve include:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-6">
              <li>PDF document generation may not be fully screen-reader compatible</li>
              <li>Some complex interactive elements in the diagnostic flow may have limited keyboard support</li>
              <li>Uploaded document previews may lack alternative text descriptions</li>
            </ul>
          </section>

          {/* ---------------------------------------------------------- */}
          {/*  Feedback                                                  */}
          {/* ---------------------------------------------------------- */}
          <section>
            <h2 className="text-[20px] font-semibold text-foreground">
              Feedback
            </h2>
            <p>
              We welcome your feedback on the accessibility of Resolvaio. If you
              encounter accessibility barriers or have suggestions for
              improvement, please contact us:
            </p>
            <p className="mt-3">
              <strong className="text-foreground">Email:</strong>{' '}
              <a
                href="mailto:support@resolvaio.com"
                className="text-foreground underline underline-offset-4"
              >
                support@resolvaio.com
              </a>
            </p>
            <p className="mt-1">
              <strong className="text-foreground">Subject line:</strong>{' '}
              &ldquo;Accessibility Feedback&rdquo;
            </p>
            <p className="mt-3">
              We aim to respond to accessibility feedback within 5 business
              days.
            </p>
          </section>
        </div>

        <div className="mt-16 border-t border-border pt-8 text-center">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            <Link href="/legal/terms" className="transition-colors hover:text-foreground">Terms</Link>
            <Link href="/legal/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link href="/legal/cookies" className="transition-colors hover:text-foreground">Cookies</Link>
            <Link href="/legal/acceptable-use" className="transition-colors hover:text-foreground">Acceptable Use</Link>
            <Link href="/legal/ai-disclosure" className="transition-colors hover:text-foreground">AI Disclosure</Link>
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
