import Link from 'next/link';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#F7F7F5] px-6 py-20">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-[13px] text-[#8A8A8A] transition-colors hover:text-[#111]">
          Back to home
        </Link>

        <h1 className="mt-8 text-[32px] font-semibold tracking-tight text-[#111]">About Resolvaio</h1>

        <div className="mt-10 space-y-8 text-[15px] leading-[1.7] text-[#5F5F5F]">
          <p>
            Resolvaio is a writing assistance tool that helps US consumers
            recover security deposits and cancel unwanted subscriptions.
          </p>

          <h2 className="text-[20px] font-semibold text-[#111]">What we do</h2>
          <p>
            We generate demand letters and cancellation emails grounded in
            verified, jurisdiction-specific consumer protection law. Every citation
            is validated against our knowledge base of primary legal sources.
          </p>

          <h2 className="text-[20px] font-semibold text-[#111]">What we are not</h2>
          <p>
            We are not a law firm. We do not provide legal advice, evaluate
            whether you have a valid claim, or guarantee any outcome. The letters
            and emails we generate are starting points that you should review
            carefully and may want to have reviewed by a licensed attorney before
            sending.
          </p>

          <h2 className="text-[20px] font-semibold text-[#111]">How it works</h2>
          <ul className="list-disc space-y-2.5 pl-6">
            <li>Answer diagnostic questions about your situation</li>
            <li>Upload relevant documents (lease, billing statements) for automated extraction</li>
            <li>We assemble grounding context from verified statutes for your jurisdiction</li>
            <li>AI generates your letter or email sequence, cited only to grounded sources</li>
            <li>Post-generation validation strips any ungrounded citations</li>
            <li>Compliance scanning ensures no prohibited language</li>
            <li>You review, customize, and send</li>
          </ul>

          <h2 className="text-[20px] font-semibold text-[#111]">Coverage</h2>
          <p>
            <strong className="text-[#111]">Security deposits:</strong> California, Texas, New York, Florida
            (expanding based on demand).
          </p>
          <p>
            <strong className="text-[#111]">Subscription cancellation:</strong> All US states (federal + state-specific
            where available).
          </p>

          <h2 className="text-[20px] font-semibold text-[#111]">Contact</h2>
          <p>
            For support inquiries, please email{' '}
            <a href="mailto:support@resolvaio.com" className="text-[#111] underline underline-offset-4">
              support@resolvaio.com
            </a>
          </p>
        </div>

        <div className="mt-16 border-t border-[#E8E8E5] pt-8 text-center">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-[#8A8A8A]">
            <Link href="/legal/terms" className="transition-colors hover:text-[#111]">Terms</Link>
            <Link href="/legal/privacy" className="transition-colors hover:text-[#111]">Privacy</Link>
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
