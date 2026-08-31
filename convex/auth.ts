import { betterAuth, type BetterAuthOptions } from 'better-auth/minimal';
import { emailOTP } from 'better-auth/plugins/email-otp';
import {
  createClient,
  type GenericCtx,
  type AuthFunctions,
} from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { Resend as ResendAPI } from 'resend';

import { components, internal } from './_generated/api';
import { internalAction } from './_generated/server';
import type { DataModel, Id } from './_generated/dataModel';
import authConfig from './auth.config';

/**
 * Better Auth configuration — replaces @convex-dev/auth (Convex Auth).
 *
 * WHY THE SWITCH: Convex Auth's session-token verification requires the backend
 * to fetch its own JWKS discovery document over its public URL, which never
 * resolved reliably on the self-hosted Coolify deployment (AuthProviderDiscovery
 * -Failed). Better Auth + the `convex` plugin support a STATIC JWKS baked into
 * the JWKS env var, so the backend never fetches its own URL. That is the fix.
 *
 * ARCHITECTURE:
 * - The Better Auth component (registered in convex.config.ts) owns its own
 *   user / session / account / verification / jwks tables INSIDE the component
 *   namespace. They are NOT in our app schema.
 * - Our app `users` table (convex/schema.ts) is a thin mirror the app reads for
 *   `email` / `name`. It is populated by the onCreate trigger below, which also
 *   calls `setUserId` so the component's user doc carries our app users id (the
 *   `userId` field the `convex` plugin adds). That link is the bridge every
 *   authorization check resolves through (convex/lib/authz.ts).
 *
 * PROVIDERS:
 * - emailAndPassword: email + password. Verification is an 8-digit OTP CODE
 *   emailed via Resend (emailOTP plugin), not a magic link — preserving the
 *   existing sign-up UX. Password reset uses the same OTP mechanism.
 * - google: OAuth. Requires AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET.
 *
 * ENV (Convex FUNCTION env store — `npx convex env set`, NOT container env):
 *   BETTER_AUTH_SECRET, SITE_URL (public app origin), JWKS (static, generated
 *   via `npx convex run auth:generateJwk | npx convex env set JWKS`),
 *   AUTH_RESEND_KEY, EMAIL_FROM, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET.
 */

const siteUrl = process.env.SITE_URL!;

/**
 * Origins auth requests are allowed from, and the cookie domain that lets the
 * session be shared across them.
 *
 * UX: visitors sign up / log in on the ROOT marketing domain (resolvaio.com) and
 * are only sent to the APP subdomain (app.resolvaio.com) AFTER login. So Better
 * Auth must trust the root origin (else "Invalid origin" 403 on sign-up), and
 * the session cookie must be readable on BOTH domains.
 *
 * Derived from SITE_URL (the app origin, e.g. https://app.resolvaio.com) so
 * nothing is hardcoded: `app.resolvaio.com` → registrable root `resolvaio.com`,
 * cookie domain `.resolvaio.com` (leading dot = valid for the root + every
 * subdomain). A localhost SITE_URL yields no cross-subdomain config.
 */
function siteOrigins(): {
  trustedOrigins: string[];
  cookieDomain: string | undefined;
} {
  const host = new URL(siteUrl).hostname; // e.g. app.resolvaio.com
  if (host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return { trustedOrigins: [siteUrl], cookieDomain: undefined };
  }
  const labels = host.split('.');
  // Registrable root = last two labels (resolvaio.com). Adequate for the
  // resolvaio.com / *.resolvaio.com setup; not a public-suffix-list parser.
  const root = labels.slice(-2).join('.');
  return {
    trustedOrigins: [
      siteUrl,
      `https://${root}`,
      `https://www.${root}`,
    ],
    cookieDomain: `.${root}`,
  };
}

/**
 * Returns the JWKS env var ONLY if it is present and valid JSON, else undefined.
 *
 * Mirrors the identical guard in auth.config.ts. Both the `convex()` plugin here
 * and `getAuthConfigProvider()` in the auth config JSON.parse this value at
 * MODULE LOAD. On the bootstrap deploy (before `auth:generateJwk` has ever run)
 * JWKS is absent or a placeholder, and an unguarded parse throws during Convex's
 * module analysis — failing the whole push. Guarding both sides identically lets
 * the first deploy complete; once the real key is set the static JWKS takes over.
 */
function validJwks(): string | undefined {
  const raw = process.env.JWKS;
  if (!raw) return undefined;
  try {
    JSON.parse(raw);
    return raw;
  } catch {
    return undefined;
  }
}

/** Emails an OTP code via Resend. Preserves the former ResendOTP copy. */
async function sendOtpEmail(
  email: string,
  otp: string,
  type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email',
): Promise<void> {
  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) {
    throw new Error('AUTH_RESEND_KEY is not set');
  }
  const from = process.env.EMAIL_FROM ?? 'Resolvaio <onboarding@resolvaio.com>';
  const resend = new ResendAPI(apiKey);

  const isReset = type === 'forget-password';
  const subject = isReset
    ? 'Reset your Resolvaio password'
    : 'Confirm your Resolvaio account';
  const text = isReset
    ? `Your Resolvaio password reset code is ${otp}. It expires in 15 minutes. If you did not request this, you can ignore this email.`
    : `Your Resolvaio confirmation code is ${otp}. It expires in 15 minutes.`;

  const { error } = await resend.emails.send({
    from,
    to: [email],
    subject,
    text,
  });
  if (error) {
    throw new Error(JSON.stringify(error));
  }
}

/**
 * The Better Auth component client. Exposes the DB adapter, HTTP route
 * registration, current-user lookup, and the trigger callback plumbing.
 *
 * The `triggers.user.onCreate` callback runs in the APP mutation context every
 * time the component creates a user, so it can write our mirror `users` row and
 * link it back (writing the component user's `userId` field). `authFunctions`
 * points the component at the internal mutations `triggersApi()` generates
 * (exported below).
 */
// Typed reference to the trigger callbacks (exported from triggersApi() below).
// Annotating as AuthFunctions and reading them off `internal` through a typed
// const stops TypeScript from traversing `typeof auth` back into `authComponent`
// while inferring the createClient argument — which is the circular-inference
// error. The runtime values are the same internal FunctionReferences.
const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, authUser) => {
        // Mirror the Better Auth user into our app `users` table (the FK target
        // for cases / subscriptions / etc.), then link the component's user doc
        // to it so authorization can resolve app id → BA identity and back.
        //
        // We call the component adapter directly (rather than
        // `authComponent.setUserId`) so this closure does not reference
        // `authComponent` inside its own initializer — that self-reference is
        // what triggers TS's circular-inference error. The runtime effect is
        // identical to setUserId (updateOne user._id → { userId }).
        const userId = await ctx.db.insert('users', {
          email: authUser.email,
          name: authUser.name ?? undefined,
        });
        await ctx.runMutation(components.betterAuth.adapter.updateOne, {
          input: {
            model: 'user',
            where: [{ field: '_id', value: authUser._id }],
            update: { userId },
          },
        });
      },
      onDelete: async (ctx, authUser) => {
        // Remove the mirror row when the component deletes the auth user. The
        // `userId` field carries our app users id (set at sign-up).
        const linkedId = authUser.userId as Id<'users'> | undefined;
        if (linkedId) {
          const existing = await ctx.db.get(linkedId);
          if (existing) {
            await ctx.db.delete(linkedId);
          }
        }
      },
    },
  },
});

/**
 * Better Auth options for a given Convex context.
 *
 * Split out from `createAuth` and annotated `satisfies BetterAuthOptions` — this
 * gives the (large) options object a concrete type, which breaks the circular
 * type inference between `authComponent`, `createAuth`, and the `internal.auth.*`
 * references (the adapter's documented pattern).
 */
const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const { trustedOrigins, cookieDomain } = siteOrigins();
  return {
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    // Session JWTs are minted/verified with a STATIC JWKS (see auth.config.ts).
    // Trust the root marketing domain (+www) as well as the app subdomain, so
    // sign-up/login works on resolvaio.com before the post-login hand-off to
    // app.resolvaio.com.
    trustedOrigins,
    // Share the session cookie across resolvaio.com ↔ app.resolvaio.com by
    // scoping it to the registrable root (.resolvaio.com). Without this the
    // cookie defaults to the baseURL host (app.*) and the root-domain login
    // would set a cookie the app subdomain cannot read.
    ...(cookieDomain
      ? {
          advanced: {
            crossSubDomainCookies: { enabled: true, domain: cookieDomain },
          },
        }
      : {}),
    emailAndPassword: {
      enabled: true,
      // Require the emailed OTP before the account is usable (matches the old
      // email-verification gate). The emailOTP plugin sends the code.
      requireEmailVerification: true,
    },
    socialProviders: {
      google: {
        clientId: process.env.AUTH_GOOGLE_ID ?? '',
        clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
      },
    },
    plugins: [
      emailOTP({
        otpLength: 8,
        expiresIn: 60 * 15, // 15 minutes, matching the former maxAge
        // Send the verification OTP on sign-up automatically…
        sendVerificationOnSignUp: true,
        // …and route ALL email verification through the OTP (not the default
        // link), so `requireEmailVerification` above is satisfied by the 8-digit
        // code flow the UI implements — no magic-link path is ever used.
        overrideDefaultEmailVerification: true,
        async sendVerificationOTP({ email, otp, type }) {
          await sendOtpEmail(email, otp, type);
        },
      }),
      convex({ authConfig, jwks: validJwks() }),
    ],
  } satisfies BetterAuthOptions;
};

/**
 * Builds the Better Auth instance for a given Convex context. Called by the
 * component for every auth HTTP request and by our server helpers.
 */
export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx));

/**
 * Trigger callbacks the component invokes in app context. Generated by
 * `triggersApi()`; wired to the component via `authFunctions` above. They must
 * be exported so `internal.auth.onCreate/onUpdate/onDelete` resolve.
 */
export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

/**
 * Generate (if absent) and return the current static JWKS document. Run once
 * per deployment to populate the JWKS env var the backend uses to verify
 * session tokens without any self-URL discovery:
 *
 *   npx convex run auth:generateJwk | npx convex env set JWKS
 *
 * Returns the JWKS as a JSON ARRAY string — the exact shape the library's
 * `getAuthConfigProvider({ jwks })` / `convex({ jwks })` consume: they
 * `JSON.parse` the value and call `.map()` on it (createPublicJwks expects
 * `JwksDoc[]`). Returning a single element instead (`jwks[0]`) yields an object
 * and crashes with "a.map is not a function". Convex serializes this return
 * value, so `npx convex run auth:generateJwk | npx convex env set JWKS` stores
 * the array JSON verbatim.
 */
export const generateJwk = internalAction({
  args: {},
  handler: async (ctx) => {
    const auth = createAuth(ctx);
    const jwks = await auth.api.getLatestJwks();
    return JSON.stringify(jwks);
  },
});

/**
 * Delete and regenerate the JWKS (key rotation), returning the new document as
 * a JSON string. After running, update the JWKS env var:
 *
 *   npx convex run auth:rotateKeys | npx convex env set JWKS
 */
export const rotateKeys = internalAction({
  args: {},
  handler: async (ctx) => {
    const auth = createAuth(ctx);
    const jwks = await auth.api.rotateKeys();
    return JSON.stringify(jwks);
  },
});
