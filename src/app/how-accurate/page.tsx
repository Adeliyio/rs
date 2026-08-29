import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, FileSearch, Ban, Scale } from 'lucide-react';

import { ToolsDropdown } from '@/components/marketing/tools-dropdown';
import { Logo } from '@/components/logo';
import { safeJsonLd } from '@/lib/safe-json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

/* ------------------------------------------------------------------ */
/*  Metadata                                                          */
/* ------------------------------------------------------------------ */

export const metadata: Metadata = buildMetadata({
  title: 'How Accurate Are AI-Generated Demand Letters?',
  description:
    'How Resolvaio keeps AI demand letters accurate: every statute citation is checked against verified legal sources, and anything unverified is removed.',
  path: '/how-accurate',
});

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function HowAccuratePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" aria-label="Resolvaio home">
            <Logo />
          </Link>
          <div className="hidden items-center gap-8 text-[13px] sm:flex">
            <ToolsDropdown />
            <Link href="/blog" className="text-muted-foreground transition-colors hover:text-foreground">Blog</Link>
            <Link href="/login" className="text-muted-foreground transition-colors hover:text-foreground">Sign In</Link>
            <Link
              href="/start"
              className="rounded-lg bg-foreground px-4 py-2 font-medium text-white transition-all hover:bg-foreground/90 active:scale-[0.98]"
            >
              Start Free Diagnostic
            </Link>
          </div>
          <Link
            href="/start"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white transition-all hover:bg-foreground/90 active:scale-[0.98] sm:hidden"
          >
            Start Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 text-center sm:py-24">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-[36px] font-semibold leading-[1.1] tracking-tight text-foreground sm:text-[48px]">
            How accurate are the
            <br />
            <span className="text-muted-foreground">demand letters?</span>
          </h1>
          <p className="mt-6 text-[16px] leading-[1.7] text-muted-foreground">
            The honest answer to the question people ask most before they trust an
            AI with a legal document: every statute citation in your letter is
            checked against verified legal sources, and anything the system
            can&apos;t verify is removed before you ever see it.
          </p>
        </div>
      </section>

      {/* The core mechanism */}
      <section className="px-6 pb-4">
        <div className="mx-auto max-w-3xl">
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-white p-6">
              <FileSearch className="h-6 w-6 text-primary" />
              <h3 className="mt-3 text-[15px] font-semibold text-foreground">
                Grounded in real statutes
              </h3>
              <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
                Every letter is built from a curated knowledge base of the actual
                security-deposit statutes for your state — not the model&apos;s
                memory.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-white p-6">
              <Ban className="h-6 w-6 text-primary" />
              <h3 className="mt-3 text-[15px] font-semibold text-foreground">
                Unverified citations removed
              </h3>
              <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
                After generation, every citation is matched against that source
                set. If a citation can&apos;t be verified, it is stripped out —
                so a made-up statute never reaches your letter.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-white p-6">
              <Scale className="h-6 w-6 text-primary" />
              <h3 className="mt-3 text-[15px] font-semibold text-foreground">
                No claims, no opinions
              </h3>
              <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
                The letter states facts and cites law. It doesn&apos;t predict
                outcomes or give a legal opinion — that keeps it accurate and
                keeps you in control.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The problem it solves */}
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-[24px] font-semibold tracking-tight text-foreground">
            The real risk with AI and the law
          </h2>
          <p className="mt-4 text-[15px] leading-[1.8] text-muted-foreground">
            General-purpose AI models are known to invent citations — plausible
            statute numbers that don&apos;t exist, or real statutes that say
            something different from what&apos;s claimed. In a demand letter, a
            fabricated citation isn&apos;t just embarrassing; it undermines the
            entire letter the moment a landlord or a judge checks it.
          </p>
          <p className="mt-4 text-[15px] leading-[1.8] text-muted-foreground">
            That&apos;s the specific failure mode Resolvaio is built to prevent.
            The generation step drafts the letter; a separate validation step then
            checks every citation it produced against the verified source set and
            removes anything that isn&apos;t grounded. A citation has to earn its
            place in your letter.
          </p>
        </div>
      </section>

      {/* How it works — steps */}
      <section className="border-t border-border bg-white px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-center text-[24px] font-semibold tracking-tight text-foreground">
            How a letter is checked
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="text-center">
              <p className="mb-2 text-[28px] font-semibold text-foreground">1</p>
              <h3 className="text-[15px] font-semibold text-foreground">Draft from the source</h3>
              <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
                Your situation is combined with the verified statute data for your
                state to draft the letter — deadline, permissible deductions, and
                penalty provision.
              </p>
            </div>
            <div className="text-center">
              <p className="mb-2 text-[28px] font-semibold text-foreground">2</p>
              <h3 className="text-[15px] font-semibold text-foreground">Validate every citation</h3>
              <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
                Each citation in the draft is matched against the source set.
                Grounded citations stay; anything unverified is stripped before the
                letter is finalized.
              </p>
            </div>
            <div className="text-center">
              <p className="mb-2 text-[28px] font-semibold text-foreground">3</p>
              <h3 className="text-[15px] font-semibold text-foreground">You review and send</h3>
              <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
                You see the finished letter and decide whether to send it. Nothing
                is ever sent for you — you stay in control of the final word.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Honest limits */}
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-[24px] font-semibold tracking-tight text-foreground">
            What accuracy does — and doesn&apos;t — mean here
          </h2>
          <p className="mt-4 text-[15px] leading-[1.8] text-muted-foreground">
            Grounded, validated citations mean the law in your letter is real and
            correctly cited. It does not promise a particular outcome. Whether a
            landlord pays, or how a judge rules, depends on the facts of your case,
            your evidence, and your jurisdiction.
          </p>
          <p className="mt-4 text-[15px] leading-[1.8] text-muted-foreground">
            Resolvaio is a writing and research assistance tool, not a law firm. It
            helps you produce an accurate, statute-cited letter; it does not offer
            legal opinions or representation. For a complex dispute — an eviction, a
            counterclaim, or a large amount at stake — talking to a licensed
            attorney or a local tenant clinic is the right step, and we&apos;ll say
            so.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/start?wedge=deposit"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-6 py-3 text-[14px] font-semibold text-white transition-all hover:bg-foreground/90 active:scale-[0.98]"
            >
              <ShieldCheck className="h-4 w-4" />
              Generate a statute-cited letter
            </Link>
            <Link
              href="/blog/diy-demand-letter-landlord-security-deposit"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 text-[14px] font-semibold text-foreground transition-all hover:bg-background active:scale-[0.98]"
            >
              Or write one yourself
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto max-w-4xl text-center">
          <Link href="/" className="text-[15px] font-semibold text-foreground">
            Resolvaio
          </Link>
          <p className="mx-auto mt-4 max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
            Resolvaio is a writing and research assistance tool, not a law firm,
            and does not offer legal opinions or representation. Generated content
            should be reviewed before use. Individual results vary.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            <Link href="/legal/terms" className="transition-colors hover:text-foreground">Terms</Link>
            <Link href="/legal/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link href="/legal/ai-disclosure" className="transition-colors hover:text-foreground">AI Disclosure</Link>
            <Link href="/legal/accessibility" className="transition-colors hover:text-foreground">Accessibility</Link>
          </div>
          <p className="mt-4 text-[12px] text-muted-foreground">
            &copy; {new Date().getFullYear()} Resolvaio. All rights reserved.
            Resolvaio is owned and operated by Nikola Innovations Limited.
          </p>
        </div>
      </footer>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'How accurate are AI-generated demand letters?',
            description:
              'How Resolvaio keeps AI-generated demand letters accurate: every statute citation is validated against verified legal sources, and unverified citations are removed before the letter is finalized.',
            provider: { '@type': 'Organization', name: 'Resolvaio', url: 'https://resolvaio.com' },
          }),
        }}
      />
    </main>
  );
}
