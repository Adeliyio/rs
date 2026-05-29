'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  LogOut,
  Plus,
  Receipt,
  Settings,
  Shield,
} from 'lucide-react';

import { signOut } from '@/lib/supabase/auth-actions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import type { CaseStatus, Wedge } from '@/types/enums';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CaseSummary {
  id: string;
  wedge: Wedge;
  jurisdiction: string;
  status: CaseStatus;
  updated_at: string;
}

interface SidebarProps {
  cases: CaseSummary[];
  activeCaseId?: string;
  userName?: string;
  userEmail?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const STATUS_LABELS: Record<CaseStatus, string> = {
  intake: 'In Progress',
  generated: 'Letter Ready',
  sent: 'Sent',
  awaiting: 'Awaiting Response',
  escalation_drafted: 'Escalation Ready',
  resolved: 'Resolved',
  closed: 'Closed',
};

const WEDGE_ICONS: Record<Wedge, typeof Shield> = {
  deposit: Shield,
  subscription: Receipt,
};

const WEDGE_LABELS: Record<Wedge, string> = {
  deposit: 'Security Deposit',
  subscription: 'Subscription',
};

/* All status pills in blue/neutral family — unified, calm */
function getStatusColor(status: CaseStatus): string {
  const colors: Record<CaseStatus, string> = {
    intake: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    generated: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
    sent: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
    awaiting: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
    escalation_drafted: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    resolved: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
    closed: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  };
  return colors[status];
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return String(diffMins) + 'm ago';
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return String(diffHrs) + 'h ago';
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return String(diffDays) + 'd ago';
  return String(Math.floor(diffDays / 30)) + 'mo ago';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Sidebar({
  cases,
  activeCaseId,
  userName,
  userEmail,
}: SidebarProps): React.JSX.Element {
  const pathname = usePathname();

  const activeCases = cases.filter(
    (c) => c.status !== 'resolved' && c.status !== 'closed'
  );
  const pastCases = cases.filter(
    (c) => c.status === 'resolved' || c.status === 'closed'
  );

  return (
    <aside className="flex h-screen w-72 flex-col bg-sidebar-background text-sidebar-foreground">
      {/* Brand mark */}
      <div className="flex h-16 items-center gap-3 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Shield className="h-4 w-4 text-white" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-white">
          Resolvaio
        </span>
      </div>

      {/* New Case Button */}
      <div className="px-4 pb-2">
        <Button
          asChild
          className="w-full justify-start gap-2 bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground"
          size="sm"
        >
          <Link href="/new">
            <Plus className="h-4 w-4" />
            New Case
          </Link>
        </Button>
      </div>

      {/* Subtle divider */}
      <div className="mx-4 border-t border-sidebar-border" />

      {/* Navigation */}
      <nav className="px-4 pt-3 pb-1">
        <Link
          href="/new"
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            pathname === '/new'
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
          )}
        >
          <Home className="h-4 w-4" />
          Home
        </Link>
      </nav>

      {/* Active Cases */}
      <div className="flex-1 overflow-y-auto px-4 pt-1">
        {activeCases.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-widest text-sidebar-muted">
              Active Cases
            </p>
            <div className="space-y-0.5">
              {activeCases.map((c) => {
                const WedgeIcon = WEDGE_ICONS[c.wedge];
                const isActive = activeCaseId === c.id;
                return (
                  <Link
                    key={c.id}
                    href={`/case/${c.id}`}
                    className={cn(
                      'group flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sidebar-accent">
                      <WedgeIcon className="h-3 w-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-[13px]">
                          {WEDGE_LABELS[c.wedge]}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'shrink-0 text-[10px] px-1.5 py-0 h-[18px] border',
                            getStatusColor(c.status)
                          )}
                        >
                          {STATUS_LABELS[c.status]}
                        </Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-sidebar-muted">
                        <span>{c.jurisdiction}</span>
                        <span className="text-sidebar-border">·</span>
                        <span>{timeAgo(c.updated_at)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Past Cases */}
        {pastCases.length > 0 && (
          <div>
            <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-widest text-sidebar-muted">
              Past Cases
            </p>
            <div className="space-y-0.5">
              {pastCases.map((c) => {
                const WedgeIcon = WEDGE_ICONS[c.wedge];
                return (
                  <Link
                    key={c.id}
                    href={`/case/${c.id}`}
                    className={cn(
                      'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                      activeCaseId === c.id
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sidebar-accent/50">
                      <WedgeIcon className="h-3 w-3 opacity-50" />
                    </div>
                    <span className="truncate text-[13px]">
                      {WEDGE_LABELS[c.wedge]} · {c.jurisdiction}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Subtle divider */}
      <div className="mx-4 border-t border-sidebar-border" />

      {/* User section */}
      <div className="px-4 py-3">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-[12px] font-medium text-blue-300">
            {userName?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-sidebar-accent-foreground">
              {userName ?? 'User'}
            </p>
            <p className="truncate text-[11px] text-sidebar-muted">
              {userEmail ?? ''}
            </p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="shrink-0 rounded-md p-1.5 text-sidebar-muted transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
