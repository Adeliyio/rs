'use client';

/**
 * Email-capture → invisible-account → case-hydration step (SPEC.md M3).
 *
 * This is the single gate in the deposit funnel: it sits AFTER the full value
 * reveal and BEFORE any document upload / AI-vision call, so 100% of variable AI
 * cost is protected while the visitor has already seen the product's value.
 *
 * On submit:
 *   1. auth.register(name, email, password)  — Convex Auth 'password' signUp
 *   2. auth.verifyEmail(email, code)         — OTP step (see friction note below)
 *   3. POST /api/cases { wedge:'deposit', jurisdiction }        — create the case
 *   4. PUT  /api/diagnostic/state { caseId, state }             — hydrate answers
 *   5. router.push(`/case/${id}`)                               — resume paid flow
 *
 * FRICTION NOTE: the current @convex-dev/auth 'password' provider is configured
 * with email verification ON — signUp emails an 8-digit OTP and the session is
 * not authenticated until it is verified. We cannot make account creation fully
 * invisible without changing the auth provider config (out of scope / forbidden:
 * "do NOT rip out the auth system"). We make it as seamless as possible: a single
 * inline card (no separate /register → /login wall), the OTP entry appears in the
 * same place, and hydration + redirect happen automatically once verified.
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useResolvaioAuth } from '@/lib/convex/use-auth';
import type { DiagnosticState } from '@/types/diagnostic.types';
import { buildHydratedState } from './anonymous-answers';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface EmailCaptureStepProps {
  jurisdiction: string;
  graphVersion: string;
  boundaryNodeId: string;
  answers: Record<string, unknown>;
  completedNodes: string[];
}

type Phase = 'form' | 'otp' | 'hydrating';

const inputClass =
  'flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-[14px] ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-shadow';

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function EmailCaptureStep({
  jurisdiction,
  graphVersion,
  boundaryNodeId,
  answers,
  completedNodes,
}: EmailCaptureStepProps): React.JSX.Element {
  const auth = useResolvaioAuth();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('form');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [busy, setBusy] = useState(false);

  // Live password-rule checks, shown as the visitor types.
  const rules = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
  ];
  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  /* ---- Create the case + hydrate the collected answers, then continue ---- */
  const hydrateAndContinue = useCallback(async (): Promise<void> => {
    setPhase('hydrating');
    setError(null);

    // 1. Create the real case.
    const caseRes = await fetch('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wedge: 'deposit', jurisdiction }),
    });

    let caseId: string | null = null;
    if (caseRes.ok) {
      const data = (await caseRes.json()) as { id: string };
      caseId = data.id;
    } else {
      const data = (await caseRes.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        existing_case_id?: string;
      };
      // A duplicate active case is fine — resume it.
      if (data.code === 'DUPLICATE_ACTIVE_CASE' && data.existing_case_id) {
        caseId = data.existing_case_id;
      } else {
        setError(data.error ?? 'Could not create your case. Please try again.');
        setPhase('otp');
        return;
      }
    }

    // 2. Hydrate the diagnostic state with the anonymously-collected answers so
    //    the authenticated shell resumes at the boundary node.
    const state: DiagnosticState = buildHydratedState({
      caseId,
      graphVersion,
      boundaryNodeId,
      answers,
      completedNodes,
    });

    await fetch('/api/diagnostic/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, state }),
    }).catch(() => {
      // Non-fatal: the shell will fall back to a fresh state if this drops. The
      // visitor keeps their case; worst case they re-confirm a couple of answers.
    });

    // 3. Resume the existing paid flow.
    router.push(`/case/${caseId}`);
  }, [
    jurisdiction,
    graphVersion,
    boundaryNodeId,
    answers,
    completedNodes,
    router,
  ]);

  /* ---- Step 1: register ---- */
  const handleRegister = useCallback(async (): Promise<void> => {
    setError(null);
    setAlreadyExists(false);

    if (!fullName.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must be at least 8 characters with an uppercase letter and a number.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const result = await auth.register(fullName.trim(), email.trim(), password);
      if (result.alreadyExists) {
        setAlreadyExists(true);
        setError(result.error ?? 'An account with that email already exists.');
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.pending) {
        setPhase('otp');
      }
    } catch {
      // Backstop: no auth failure should ever leave the form frozen with no
      // message. register() is designed to return errors, not throw, but if
      // anything upstream does, the user still sees a clear next step.
      setError('Something went wrong creating your account. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [auth, fullName, email, password, confirmPassword]);

  /* ---- Step 2: verify OTP, then hydrate ---- */
  const handleVerify = useCallback(async (): Promise<void> => {
    setError(null);
    setBusy(true);
    const result = await auth.verifyEmail(email.trim(), code.trim());
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    // verifyEmail's own router.push('/new') is superseded by our hydration
    // redirect below; the session is authenticated at this point.
    await hydrateAndContinue();
  }, [auth, email, code, hydrateAndContinue]);

  /* ---- Hydrating spinner ---- */
  if (phase === 'hydrating') {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Setting up your case and carrying over your answers…
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="space-y-1.5 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {phase === 'otp' ? 'Confirm your email' : 'Where should we send your case?'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {phase === 'otp' ? (
            <>
              We emailed an 8-digit code to <strong>{email}</strong>. Enter it to
              continue to your case.
            </>
          ) : (
            'Your answers are saved to this case so you can pick up right where you left off.'
          )}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p>{error}</p>
          {alreadyExists && (
            <button
              type="button"
              onClick={() => router.push(`/login?next=/start%3Fwedge%3Ddeposit`)}
              className="mt-1.5 font-medium underline underline-offset-2 hover:no-underline"
            >
              Sign in instead
            </button>
          )}
        </div>
      )}

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        {phase === 'otp' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleVerify();
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="otp-code" className="text-[13px] font-medium">
                Confirmation code
              </label>
              <input
                id="otp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="12345678"
                className={`${inputClass} tracking-[0.3em]`}
              />
            </div>
            <Button type="submit" size="lg" disabled={busy} className="w-full gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm &amp; continue
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleRegister();
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="cap-name" className="text-[13px] font-medium">
                Your name
              </label>
              <input
                id="cap-name"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="cap-email" className="text-[13px] font-medium">
                Email
              </label>
              <input
                id="cap-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="cap-password" className="text-[13px] font-medium">
                Create a password
              </label>
              <div className="relative">
                <input
                  id="cap-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-r-lg"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {/* Live password-rule hints */}
              <ul className="mt-0.5 flex flex-col gap-1">
                {rules.map((rule) => (
                  <li
                    key={rule.label}
                    className={`flex items-center gap-1.5 text-[12px] transition-colors ${
                      rule.met ? 'text-emerald-600' : 'text-muted-foreground/70'
                    }`}
                  >
                    <Check
                      className={`h-3 w-3 shrink-0 ${
                        rule.met ? 'opacity-100' : 'opacity-40'
                      }`}
                    />
                    {rule.label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="cap-confirm" className="text-[13px] font-medium">
                Confirm password
              </label>
              <input
                id="cap-confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className={`${inputClass} ${
                  confirmPassword.length > 0 && !passwordsMatch
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }`}
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-[12px] text-destructive">
                  Passwords do not match.
                </p>
              )}
              {passwordsMatch && (
                <p className="flex items-center gap-1.5 text-[12px] text-emerald-600">
                  <Check className="h-3 w-3" /> Passwords match
                </p>
              )}
            </div>
            <Button type="submit" size="lg" disabled={busy} className="w-full gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Save my case &amp; continue
            </Button>
          </form>
        )}
      </div>

      <p className="text-center text-[11px] leading-relaxed text-muted-foreground/70">
        Resolvaio is a writing and research assistance tool, not a law firm.
      </p>
    </div>
  );
}
