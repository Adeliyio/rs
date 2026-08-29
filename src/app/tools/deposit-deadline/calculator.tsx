'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight, AlertTriangle, Check, CheckCircle2, Clock, Loader2 } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  State deadline data — from KB                                     */
/* ------------------------------------------------------------------ */

interface StateDeadline {
  code: string;
  name: string;
  days: number;
  statute: string;
  penalty: string;
  note?: string;
  supported: boolean;
}

const STATE_DEADLINES: StateDeadline[] = [
  {
    code: 'AL', name: 'Alabama', days: 60, statute: 'Ala. Code \u00A7 35-9A-201',
    penalty: 'Actual damages', supported: false,
  },
  {
    code: 'AK', name: 'Alaska', days: 14, statute: 'Alaska Stat. \u00A7 34.03.070',
    penalty: 'Up to 2\u00D7 deposit', supported: false, note: '14 days if tenant provides forwarding address, 30 days otherwise',
  },
  {
    code: 'AZ', name: 'Arizona', days: 14, statute: 'Ariz. Rev. Stat. \u00A7 33-1321',
    penalty: 'Up to 2\u00D7 wrongfully withheld', supported: false,
  },
  {
    code: 'AR', name: 'Arkansas', days: 60, statute: 'Ark. Code \u00A7 18-16-305',
    penalty: 'Actual damages', supported: false,
  },
  {
    code: 'CA', name: 'California', days: 21, statute: 'Cal. Civ. Code \u00A7 1950.5',
    penalty: 'Up to 2\u00D7 deposit for bad faith', supported: true,
  },
  {
    code: 'CO', name: 'Colorado', days: 60, statute: 'Colo. Rev. Stat. \u00A7 38-12-103',
    penalty: 'Up to 3\u00D7 wrongfully withheld', supported: false, note: '60 days unless lease specifies shorter',
  },
  {
    code: 'CT', name: 'Connecticut', days: 30, statute: 'Conn. Gen. Stat. \u00A7 47a-21',
    penalty: 'Up to 2\u00D7 deposit', supported: false,
  },
  {
    code: 'DE', name: 'Delaware', days: 20, statute: 'Del. Code tit. 25 \u00A7 5514',
    penalty: 'Up to 2\u00D7 deposit', supported: false,
  },
  {
    code: 'FL', name: 'Florida', days: 15, statute: 'Fla. Stat. \u00A7 83.49',
    penalty: 'Forfeiture of claim right if 30-day notice missed', supported: true,
    note: '15 days (no claim) or 30 days (with claim, by certified mail)',
  },
  {
    code: 'GA', name: 'Georgia', days: 30, statute: 'Ga. Code \u00A7 44-7-34',
    penalty: 'Actual damages', supported: false,
  },
  {
    code: 'HI', name: 'Hawaii', days: 14, statute: 'Haw. Rev. Stat. \u00A7 521-44',
    penalty: 'Actual damages + court costs', supported: false,
  },
  {
    code: 'ID', name: 'Idaho', days: 21, statute: 'Idaho Code \u00A7 6-321',
    penalty: 'Up to 3\u00D7 wrongfully withheld', supported: false, note: '21 days or end of lease, whichever is later',
  },
  {
    code: 'IL', name: 'Illinois', days: 30, statute: 'Ill. Comp. Stat. 765 ILCS 710',
    penalty: 'Up to 2\u00D7 deposit (Chicago)', supported: false, note: 'Chicago has stricter local rules',
  },
  {
    code: 'IN', name: 'Indiana', days: 45, statute: 'Ind. Code \u00A7 32-31-3-12',
    penalty: 'Actual damages + attorney\u2019s fees', supported: false,
  },
  {
    code: 'IA', name: 'Iowa', days: 30, statute: 'Iowa Code \u00A7 562A.12',
    penalty: 'Up to 2\u00D7 wrongfully withheld', supported: false,
  },
  {
    code: 'KS', name: 'Kansas', days: 30, statute: 'Kan. Stat. \u00A7 58-2550',
    penalty: '1.5\u00D7 wrongfully withheld', supported: false,
  },
  {
    code: 'KY', name: 'Kentucky', days: 30, statute: 'Ky. Rev. Stat. \u00A7 383.580',
    penalty: 'Actual damages', supported: false, note: 'Landlord has 60 days if inspection needed',
  },
  {
    code: 'LA', name: 'Louisiana', days: 30, statute: 'La. Rev. Stat. \u00A7 9:3251',
    penalty: 'Up to 2\u00D7 wrongfully withheld + attorney\u2019s fees', supported: false,
  },
  {
    code: 'ME', name: 'Maine', days: 30, statute: 'Me. Rev. Stat. tit. 14 \u00A7 6033',
    penalty: 'Up to 2\u00D7 wrongfully withheld', supported: false, note: '21 days if tenancy < 1 year',
  },
  {
    code: 'MD', name: 'Maryland', days: 45, statute: 'Md. Code Real Prop. \u00A7 8-203',
    penalty: 'Up to 3\u00D7 wrongfully withheld', supported: false,
  },
  {
    code: 'MA', name: 'Massachusetts', days: 30, statute: 'Mass. Gen. Laws ch. 186 \u00A7 15B',
    penalty: 'Up to 3\u00D7 deposit + 5% interest + attorney\u2019s fees', supported: false,
  },
  {
    code: 'MI', name: 'Michigan', days: 30, statute: 'Mich. Comp. Laws \u00A7 554.609',
    penalty: 'Up to 2\u00D7 deposit', supported: false,
  },
  {
    code: 'MN', name: 'Minnesota', days: 21, statute: 'Minn. Stat. \u00A7 504B.178',
    penalty: 'Up to 2\u00D7 wrongfully withheld + $500', supported: false, note: '3 weeks after lease end',
  },
  {
    code: 'MS', name: 'Mississippi', days: 45, statute: 'Miss. Code \u00A7 89-8-21',
    penalty: 'Actual damages', supported: false,
  },
  {
    code: 'MO', name: 'Missouri', days: 30, statute: 'Mo. Rev. Stat. \u00A7 535.300',
    penalty: 'Up to 2\u00D7 wrongfully withheld', supported: false,
  },
  {
    code: 'MT', name: 'Montana', days: 30, statute: 'Mont. Code \u00A7 70-25-202',
    penalty: 'Actual damages', supported: false, note: '10 days if no deductions',
  },
  {
    code: 'NE', name: 'Nebraska', days: 14, statute: 'Neb. Rev. Stat. \u00A7 76-1416',
    penalty: 'Actual damages + attorney\u2019s fees', supported: false,
  },
  {
    code: 'NV', name: 'Nevada', days: 30, statute: 'Nev. Rev. Stat. \u00A7 118A.242',
    penalty: 'Actual damages', supported: false,
  },
  {
    code: 'NH', name: 'New Hampshire', days: 30, statute: 'N.H. Rev. Stat. \u00A7 540-A:7',
    penalty: 'Actual damages', supported: false,
  },
  {
    code: 'NJ', name: 'New Jersey', days: 30, statute: 'N.J. Stat. \u00A7 46:8-21.1',
    penalty: 'Actual damages + attorney\u2019s fees', supported: false,
  },
  {
    code: 'NM', name: 'New Mexico', days: 30, statute: 'N.M. Stat. \u00A7 47-8-18',
    penalty: 'Actual damages', supported: false,
  },
  {
    code: 'NY', name: 'New York', days: 14, statute: 'N.Y. Gen. Oblig. Law \u00A7 7-108',
    penalty: 'Actual damages + punitive damages + attorney\u2019s fees', supported: true,
  },
  {
    code: 'NC', name: 'North Carolina', days: 30, statute: 'N.C. Gen. Stat. \u00A7 42-52',
    penalty: 'Actual damages', supported: false,
  },
  {
    code: 'ND', name: 'North Dakota', days: 30, statute: 'N.D. Cent. Code \u00A7 47-16-07.1',
    penalty: 'Actual damages', supported: false,
  },
  {
    code: 'OH', name: 'Ohio', days: 30, statute: 'Ohio Rev. Code \u00A7 5321.16',
    penalty: 'Up to 2\u00D7 wrongfully withheld + attorney\u2019s fees', supported: false,
  },
  {
    code: 'OK', name: 'Oklahoma', days: 45, statute: 'Okla. Stat. tit. 41 \u00A7 115',
    penalty: 'Up to 2\u00D7 wrongfully withheld', supported: false,
  },
  {
    code: 'OR', name: 'Oregon', days: 31, statute: 'Or. Rev. Stat. \u00A7 90.300',
    penalty: 'Up to 2\u00D7 deposit', supported: false,
  },
  {
    code: 'PA', name: 'Pennsylvania', days: 30, statute: 'Pa. Stat. tit. 68 \u00A7 250.512',
    penalty: 'Up to 2\u00D7 deposit', supported: false,
  },
  {
    code: 'RI', name: 'Rhode Island', days: 20, statute: 'R.I. Gen. Laws \u00A7 34-18-19',
    penalty: 'Actual damages', supported: false,
  },
  {
    code: 'SC', name: 'South Carolina', days: 30, statute: 'S.C. Code \u00A7 27-40-410',
    penalty: 'Actual damages', supported: false,
  },
  {
    code: 'SD', name: 'South Dakota', days: 14, statute: 'S.D. Codified Laws \u00A7 43-32-24',
    penalty: 'Actual damages + attorney\u2019s fees', supported: false, note: '14 days or lease expiration + 45 days, whichever is sooner',
  },
  {
    code: 'TN', name: 'Tennessee', days: 30, statute: 'Tenn. Code \u00A7 66-28-301',
    penalty: 'Actual damages', supported: false, note: '10 days no deductions, 30 days with deductions',
  },
  {
    code: 'TX', name: 'Texas', days: 30, statute: 'Tex. Prop. Code \u00A7 92.103',
    penalty: '$100 + 3\u00D7 wrongfully withheld + attorney\u2019s fees', supported: true,
    note: 'Clock starts after written forwarding address received',
  },
  {
    code: 'UT', name: 'Utah', days: 30, statute: 'Utah Code \u00A7 57-17-3',
    penalty: 'Up to $100 + actual damages', supported: false,
  },
  {
    code: 'VT', name: 'Vermont', days: 14, statute: 'Vt. Stat. tit. 9 \u00A7 4461',
    penalty: 'Up to 2\u00D7 deposit', supported: false,
  },
  {
    code: 'VA', name: 'Virginia', days: 45, statute: 'Va. Code \u00A7 55.1-1226',
    penalty: 'Actual damages + attorney\u2019s fees', supported: false,
  },
  {
    code: 'WA', name: 'Washington', days: 21, statute: 'Wash. Rev. Code \u00A7 59.18.280',
    penalty: 'Up to 2\u00D7 deposit', supported: false,
  },
  {
    code: 'WV', name: 'West Virginia', days: 60, statute: 'W. Va. Code \u00A7 37-6A-1',
    penalty: 'Actual damages', supported: false,
  },
  {
    code: 'WI', name: 'Wisconsin', days: 21, statute: 'Wis. Stat. \u00A7 134.06',
    penalty: 'Up to 2\u00D7 wrongfully withheld', supported: false,
  },
  {
    code: 'WY', name: 'Wyoming', days: 30, statute: 'Wyo. Stat. \u00A7 1-21-1208',
    penalty: 'Actual damages', supported: false, note: '15 days no deductions, 30 days with deductions',
  },
  {
    code: 'DC', name: 'District of Columbia', days: 45, statute: 'D.C. Code \u00A7 42-3502.17',
    penalty: 'Actual damages', supported: false,
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function DeadlineCalculator() {
  const [selectedState, setSelectedState] = useState('');
  const [moveOutDate, setMoveOutDate] = useState('');
  const [result, setResult] = useState<{
    state: StateDeadline;
    deadlineDate: Date;
    daysElapsed: number;
    deadlinePassed: boolean;
    daysOverdue: number;
  } | null>(null);

  /* Waitlist form state */
  const [waitlistName, setWaitlistName] = useState('');
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistStatus, setWaitlistStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [waitlistMessage, setWaitlistMessage] = useState('');

  const handleWaitlistSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!waitlistEmail.trim() || !result) return;

      setWaitlistStatus('loading');
      try {
        const response = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: waitlistName.trim() || undefined,
            email: waitlistEmail,
            state: result.state.code,
            wedge: 'deposit',
          }),
        });

        const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };

        if (response.ok && data.ok) {
          setWaitlistStatus('success');
          setWaitlistMessage(data.message ?? 'You have been added to the waitlist.');
        } else {
          setWaitlistStatus('error');
          setWaitlistMessage(data.error ?? 'Something went wrong. Please try again.');
        }
      } catch {
        setWaitlistStatus('error');
        setWaitlistMessage('Network error. Please try again.');
      }
    },
    [waitlistName, waitlistEmail, result],
  );

  const handleCalculate = useCallback(() => {
    if (!selectedState || !moveOutDate) return;

    const state = STATE_DEADLINES.find((s) => s.code === selectedState);
    if (!state) return;

    const moveOut = new Date(moveOutDate + 'T00:00:00');
    const deadline = new Date(moveOut);
    deadline.setDate(deadline.getDate() + state.days);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const elapsed = Math.floor(
      (today.getTime() - moveOut.getTime()) / (1000 * 60 * 60 * 24),
    );

    const overdue = Math.floor(
      (today.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24),
    );

    setResult({
      state,
      deadlineDate: deadline,
      daysElapsed: elapsed,
      deadlinePassed: today > deadline,
      daysOverdue: Math.max(0, overdue),
    });
  }, [selectedState, moveOutDate]);

  return (
    <div>
      {/* Input form */}
      <div className="rounded-2xl border border-border bg-white p-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="state" className="text-[13px] font-medium text-foreground">
              State
            </label>
            <select
              id="state"
              value={selectedState}
              onChange={(e) => { setSelectedState(e.target.value); setResult(null); }}
              className="h-11 w-full rounded-lg border border-border bg-background px-4 text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-shadow"
            >
              <option value="">Select your state</option>
              {STATE_DEADLINES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="moveout" className="text-[13px] font-medium text-foreground">
              Move-out date
            </label>
            <input
              id="moveout"
              type="date"
              value={moveOutDate}
              onChange={(e) => { setMoveOutDate(e.target.value); setResult(null); }}
              className="h-11 w-full rounded-lg border border-border bg-background px-4 text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-shadow"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleCalculate}
          disabled={!selectedState || !moveOutDate}
          className="mt-6 w-full rounded-lg bg-foreground py-3 text-[14px] font-semibold text-white transition-all hover:bg-foreground/90 active:scale-[0.98] disabled:bg-muted disabled:text-muted-foreground disabled:active:scale-100"
        >
          Calculate Deadline
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="mt-6 space-y-4">
          {/* Status card */}
          <div className={`rounded-2xl border p-8 ${
            result.deadlinePassed
              ? 'border-red-200/60 bg-red-50/40'
              : 'border-emerald-200/60 bg-emerald-50/40'
          }`}>
            <div className="flex items-start gap-4">
              {result.deadlinePassed ? (
                <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-red-500" />
              ) : (
                <Clock className="mt-1 h-6 w-6 shrink-0 text-emerald-600" />
              )}
              <div>
                <h3 className="text-[20px] font-semibold text-foreground">
                  {result.deadlinePassed
                    ? `Deadline passed ${result.daysOverdue} day${result.daysOverdue === 1 ? '' : 's'} ago`
                    : 'Deadline has not passed yet'}
                </h3>
                <p className="mt-2 text-[15px] leading-[1.7] text-muted-foreground">
                  {result.deadlinePassed
                    ? `Your landlord\u2019s ${result.state.days}-day deadline expired on ${result.deadlineDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. It has been ${result.daysElapsed} days since you moved out.`
                    : `Your landlord has until ${result.deadlineDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} (${result.state.days} days from move-out) to return your deposit or provide an itemized statement.`}
                </p>
              </div>
            </div>
          </div>

          {/* Details card */}
          <div className="rounded-2xl border border-border bg-white p-8">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <p className="text-[13px] font-medium text-muted-foreground">Statute</p>
                <p className="text-right text-[14px] font-medium text-foreground">{result.state.statute}</p>
              </div>
              <div className="border-t border-border" />
              <div className="flex items-start justify-between gap-4">
                <p className="text-[13px] font-medium text-muted-foreground">Return deadline</p>
                <p className="text-right text-[14px] font-medium text-foreground">{result.state.days} days</p>
              </div>
              <div className="border-t border-border" />
              <div className="flex items-start justify-between gap-4">
                <p className="text-[13px] font-medium text-muted-foreground">Days since move-out</p>
                <p className="text-right text-[14px] font-medium text-foreground">{result.daysElapsed} days</p>
              </div>
              <div className="border-t border-border" />
              <div className="flex items-start justify-between gap-4">
                <p className="text-[13px] font-medium text-muted-foreground">Penalty if missed</p>
                <p className="text-right text-[14px] font-medium text-foreground">{result.state.penalty}</p>
              </div>
              {result.state.note && (
                <>
                  <div className="border-t border-border" />
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-[13px] font-medium text-muted-foreground">Note</p>
                    <p className="text-right text-[14px] text-muted-foreground">{result.state.note}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* CTA */}
          {result.deadlinePassed && result.state.supported && (
            <div className="rounded-2xl border border-border bg-white p-8 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Check className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 text-[18px] font-semibold text-foreground">
                Generate your demand letter
              </h3>
              <p className="mt-2 text-[14px] leading-[1.7] text-muted-foreground">
                Your landlord missed the {result.state.days}-day deadline under{' '}
                {result.state.statute}. A demand letter citing this statute and the
                penalty provision is the standard next step.
              </p>
              <Link
                href="/start?wedge=deposit"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-foreground px-6 py-3 text-[14px] font-semibold text-white transition-all hover:bg-foreground/90 active:scale-[0.98]"
              >
                Start Deposit Case — $49 <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {result.deadlinePassed && !result.state.supported && (
            <div className="rounded-2xl border border-border bg-white p-8 text-center">
              <h3 className="text-[18px] font-semibold text-foreground">
                {result.state.name} is not yet supported
              </h3>
              <p className="mt-2 text-[14px] leading-[1.7] text-muted-foreground">
                We currently generate demand letters for California, Texas, New York,
                and Florida. We are expanding to additional states based on demand.
              </p>

              {waitlistStatus === 'success' ? (
                <div className="mt-4 flex items-center justify-center gap-2 text-[14px] font-medium text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {waitlistMessage}
                </div>
              ) : (
                <form onSubmit={handleWaitlistSubmit} className="mx-auto mt-5 max-w-md space-y-3">
                  <p className="text-[13px] font-medium text-foreground">Join the waitlist</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={waitlistName}
                      onChange={(e) => setWaitlistName(e.target.value)}
                      placeholder="Your name"
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <input
                      type="email"
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={waitlistStatus === 'loading'}
                    className="w-full rounded-lg bg-foreground py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-foreground/90 active:scale-[0.98] disabled:opacity-70"
                  >
                    {waitlistStatus === 'loading' ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Joining...
                      </span>
                    ) : (
                      'Join the Waitlist'
                    )}
                  </button>
                </form>
              )}

              {waitlistStatus === 'error' && (
                <p className="mt-2 text-[13px] text-red-600">{waitlistMessage}</p>
              )}
            </div>
          )}

          {!result.deadlinePassed && (
            <div className="rounded-2xl border border-border bg-background p-6 text-center">
              <p className="text-[14px] leading-[1.7] text-muted-foreground">
                The deadline hasn&apos;t passed yet. If it passes without a return
                or itemized statement, a demand letter citing {result.state.statute}{' '}
                is the standard next step.
              </p>
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            This calculation is based on the general statutory deadline and does
            not account for holidays, weekends, or special circumstances that may
            affect the deadline in your jurisdiction. Some states have different
            timelines depending on whether deductions are claimed. Verify with
            official sources.
          </p>
        </div>
      )}
    </div>
  );
}
