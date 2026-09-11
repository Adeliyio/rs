import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

/**
 * Guards the "cancel anytime" promise.
 *
 * The app used to offer subscribers one affordance: a plain link to Polar's
 * GENERIC portal entry (https://polar.sh/purchases/subscriptions). That page
 * authenticates against Polar's own session, so a customer who checked out
 * without knowingly creating a Polar login — or who used a different email —
 * landed somewhere showing them nothing, with no route back. There was no
 * cancel endpoint anywhere: the subscription route was GET-only and Convex had
 * no cancel mutation. Meanwhile the site promises "cancel anytime" in four
 * places.
 *
 * For a product whose premise is helping people escape cancellation friction,
 * shipping our own was indefensible.
 *
 * These are source-level assertions (the route needs a live Polar token and a
 * session to exercise end to end), pinning the properties that actually matter:
 * the endpoint exists, it is POST, it is owner-scoped, and no dead generic link
 * remains.
 */

function readSource(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf-8');
}

const ROUTE = readSource(
  'src',
  'app',
  'api',
  'account',
  'subscription',
  'portal',
  'route.ts',
);

const SETTINGS = readSource('src', 'app', '(app)', 'settings', 'page.tsx');

describe('billing portal endpoint', () => {
  it('exposes POST, not GET (creating a session must not be prefetchable)', () => {
    expect(ROUTE).toMatch(/export async function POST\(/);
    expect(ROUTE).not.toMatch(/export async function GET\(/);
  });

  it('requires an authenticated caller', () => {
    expect(ROUTE).toContain('currentUser()');
    expect(ROUTE).toContain('401');
  });

  it('takes the customer id from the caller\'s OWN subscription, never the request', () => {
    // currentMine is auth-scoped, so one user cannot mint another's portal.
    expect(ROUTE).toContain('api.subscriptions.currentMine');
    expect(ROUTE).toContain('sub.polar_customer_id');
    // No request body is read at all.
    expect(ROUTE).not.toContain('request.json()');
  });

  it('calls the real Polar customer-sessions API', () => {
    expect(ROUTE).toContain('customerSessions.create');
    expect(ROUTE).toContain('customerPortalUrl');
  });

  it('always leaves a cancelling customer a route out on failure', () => {
    // Every error branch must name support rather than dead-ending.
    const supportMentions = ROUTE.match(/support@resolvaio\.com/g) ?? [];
    expect(supportMentions.length).toBeGreaterThanOrEqual(3);
  });

  it('handles a missing Polar customer id rather than crashing', () => {
    expect(ROUTE).toContain('409');
  });
});

describe('settings page no longer dead-ends a subscriber', () => {
  it('drops the generic Polar portal link', () => {
    expect(SETTINGS).not.toContain('polar.sh/purchases/subscriptions');
  });

  it('calls the authenticated portal endpoint', () => {
    expect(SETTINGS).toContain('/api/account/subscription/portal');
    expect(SETTINGS).toContain("method: 'POST'");
  });

  it('offers an explicitly labelled cancel affordance', () => {
    expect(SETTINGS.toLowerCase()).toContain('cancel subscription');
  });

  it('surfaces the server error instead of failing silently', () => {
    expect(SETTINGS).toContain('portalError');
  });

  it('no longer carries the unresolved portal TODO', () => {
    expect(SETTINGS).not.toContain('TODO(M4.5)');
  });
});

describe('generation prompts constrain citation form', () => {
  // A fabricated NAMED ACT carrying no number ("the Texas Deceptive Deposit
  // Practices Act") is not extractable by any regex, so the citation validator
  // cannot catch it. The mitigation is prompt-side: every legal assertion must
  // carry a grounded section citation, or be omitted.
  const DEPOSIT_PROMPT = readSource('src', 'lib', 'ai', 'deposit-generation.ts');

  it('mandates section-symbol citation form', () => {
    expect(DEPOSIT_PROMPT).toContain('CITATION FORM IS MANDATORY');
  });

  it('forbids naming an act without its section', () => {
    expect(DEPOSIT_PROMPT).toContain('NEVER NAME AN ACT WITHOUT ITS SECTION');
  });

  it('tells the model an unciteable assertion must be dropped', () => {
    expect(DEPOSIT_PROMPT).toContain('DO NOT MAKE THE ASSERTION');
  });
});
