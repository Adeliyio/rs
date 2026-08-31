'use client';

/**
 * Account settings page — data export and deletion.
 *
 * Surfaces GDPR/CCPA rights:
 * - Data export (GET /api/account/export)
 * - Account deletion (DELETE /api/account/delete)
 */

import { useState, useCallback, useEffect } from 'react';
import { Download, Trash2, AlertTriangle, Loader2, CreditCard, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { authClient } from '@/lib/auth-client';

/** The server (api/account/delete) requires this exact confirmation phrase. The
 *  two-step "Yes, delete everything" button is the UI gate; it sends the phrase
 *  so client and server agree on one contract. */
const DELETE_CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';

interface SubscriptionData {
  id: string;
  plan: string;
  status: string;
  polar_subscription_id: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

export default function SettingsPage(): React.JSX.Element {
  // Settings is where the full account email lives (it's removed from the
  // always-on sidebar). Show it so the user can confirm WHICH account they're
  // about to export or delete data for.
  const { data: session } = authClient.useSession();
  const accountName = session?.user?.name ?? null;
  const accountEmail = session?.user?.email ?? null;

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [subLoading, setSubLoading] = useState(true);

  useEffect(() => {
    fetch('/api/account/subscription')
      .then((r) => r.json())
      .then((data: { subscription: SubscriptionData | null }) => {
        setSubscription(data.subscription);
      })
      .catch(() => { /* non-critical */ })
      .finally(() => setSubLoading(false));
  }, []);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);
    try {
      const res = await fetch('/api/account/export');
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resolvaio-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        // The two-step confirm button IS the gate; send the phrase the server
        // requires so the DELETE request validates (previously no body was sent,
        // so the request could never satisfy the schema).
        body: JSON.stringify({ confirmation: DELETE_CONFIRMATION_PHRASE }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? 'Deletion failed');
      }
      // Clear the client auth session before leaving, mirroring the sidebar
      // logout — don't rely solely on the server having invalidated the session.
      try {
        await authClient.signOut();
      } catch {
        // best-effort — the account is already deleted; still redirect out.
      }
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deletion failed');
      setIsDeleting(false);
    }
  }, []);

  return (
    <div className="mx-auto max-w-2xl py-4">
      <h1 className="text-[28px] font-semibold tracking-tight">Account Settings</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Manage your account data and privacy preferences.
      </p>

      {/* Signed-in account — the canonical home for the full email. Confirms
          whose data the Export / Delete actions below will affect. */}
      {(accountName || accountEmail) && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border bg-card px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[14px] font-semibold text-primary">
            {(accountName ?? accountEmail ?? 'U')[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Signed in as
            </p>
            {accountName && (
              <p className="truncate text-[14px] font-medium text-foreground">{accountName}</p>
            )}
            {accountEmail && (
              <p className="truncate text-[13px] text-muted-foreground">{accountEmail}</p>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Data export */}
      <Card className="mt-8">
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <Download className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h2 className="text-[16px] font-semibold">Export Your Data</h2>
              <p className="mt-1.5 text-[14px] leading-[1.7] text-muted-foreground">
                Download a JSON file containing all your cases, letters, sequences,
                documents, and other account data. This does not delete anything.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4"
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-1.5 h-4 w-4" />
                    Download My Data
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription management */}
      <Card className="mt-4">
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h2 className="text-[16px] font-semibold">Subscription & Billing</h2>
              {subLoading ? (
                <p className="mt-1.5 text-[14px] text-muted-foreground">Loading...</p>
              ) : subscription ? (
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl border bg-muted/30 px-4 py-3 text-[14px]">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {subscription.plan === 'annual_unlimited'
                          ? 'Annual Unlimited'
                          : 'Monthly Unlimited'}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                        subscription.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {subscription.status === 'active' ? 'Active' : subscription.status}
                      </span>
                    </div>
                    {subscription.current_period_end && (
                      <p className="mt-1.5 text-[13px] text-muted-foreground">
                        {subscription.cancel_at_period_end
                          ? `Cancels on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                          : `Renews on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                        }
                      </p>
                    )}
                  </div>
                  {/* Polar customer portal. TODO(M4.5): generate a per-customer
                      portal session server-side (polar.customerSessions.create /
                      the @polar-sh/nextjs CustomerPortal adapter) for a
                      deep-linked, authenticated portal. For now this links to
                      Polar's hosted portal entry, which is not blocking. */}
                  <a
                    href="https://polar.sh/purchases/subscriptions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[14px] text-primary transition-colors hover:text-primary/80"
                  >
                    Manage subscription on Polar
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                <p className="mt-1.5 text-[14px] leading-[1.7] text-muted-foreground">
                  No active subscription. Purchase a subscription plan from
                  the dashboard to get unlimited access to deposit demand letters.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account deletion */}
      <Card className="mt-4 border-destructive/20">
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/5">
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <h2 className="text-[16px] font-semibold text-destructive">Delete Account</h2>
              <p className="mt-1.5 text-[14px] leading-[1.7] text-muted-foreground">
                Permanently delete your account and all associated data. This includes
                all cases, letters, sequences, documents, and payment records. This
                action cannot be undone.
              </p>

              {!deleteConfirm ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 border-destructive/30 text-destructive hover:bg-destructive/5"
                  onClick={() => setDeleteConfirm(true)}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete My Account
                </Button>
              ) : (
                <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <p className="text-[14px] font-medium text-destructive">
                      Are you sure? This cannot be undone.
                    </p>
                  </div>
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    All your data will be permanently deleted, including cases,
                    letters, documents, and your authentication account.
                  </p>
                  <div className="mt-4 flex gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteConfirm(false)}
                      disabled={isDeleting}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        'Yes, Delete Everything'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy info */}
      <p className="mt-10 text-[12px] text-muted-foreground/70 leading-relaxed">
        Resolvaio respects your right to data portability and deletion under
        GDPR, CCPA, and similar privacy regulations. Data export includes all
        personally identifiable information we store. Account deletion removes
        all data from our systems including authentication records.
      </p>
    </div>
  );
}
