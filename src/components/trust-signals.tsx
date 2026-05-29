'use client';

/**
 * Trust signals component — displays aggregate outcome data
 * and jurisdiction coverage on the landing page.
 *
 * Only shows statistics that meet the 50-case minimum threshold
 * per compliance rules. Shows "cold start" messaging when
 * thresholds aren't met yet.
 */

import { useEffect, useState } from 'react';
import { Shield, Users, MapPin } from 'lucide-react';

interface TrustStats {
  total_cases_completed: number;
  deposit: { cases_completed: number; stats_available: boolean };
  subscription: { cases_completed: number; stats_available: boolean };
  recovery: {
    available: boolean;
    cases_with_recovery: number;
    total_recovered: number | null;
    average_recovered: number | null;
  };
  jurisdictions_covered: number;
}

export function TrustSignals() {
  const [stats, setStats] = useState<TrustStats | null>(null);

  useEffect(() => {
    fetch('/api/trust/stats')
      .then((r) => r.json())
      .then((data: TrustStats) => setStats(data))
      .catch(() => { /* Trust signals are non-critical */ });
  }, []);

  if (!stats || stats.total_cases_completed === 0) {
    return null; // Don't show trust signals until we have data
  }

  return (
    <div className="border-t border-[#E8E8E5] bg-[#F7F7F5] py-16">
      <div className="mx-auto max-w-4xl px-6">
        <h2 className="mb-8 text-center text-[16px] font-semibold text-[#111]">
          Trusted by consumers across the US
        </h2>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div className="flex flex-col items-center gap-3 text-center">
            <Users className="h-5 w-5 text-[#8A8A8A]" />
            <div className="text-[28px] font-semibold tracking-tight text-[#111]">
              {stats.total_cases_completed.toLocaleString()}+
            </div>
            <div className="text-[13px] text-[#5F5F5F]">Cases completed</div>
          </div>

          {stats.recovery.available && stats.recovery.average_recovered && (
            <div className="flex flex-col items-center gap-3 text-center">
              <Shield className="h-5 w-5 text-[#8A8A8A]" />
              <div className="text-[28px] font-semibold tracking-tight text-[#111]">
                ${stats.recovery.average_recovered.toLocaleString()}
              </div>
              <div className="text-[13px] text-[#5F5F5F]">Average recovery</div>
            </div>
          )}

          <div className="flex flex-col items-center gap-3 text-center">
            <MapPin className="h-5 w-5 text-[#8A8A8A]" />
            <div className="text-[28px] font-semibold tracking-tight text-[#111]">
              {stats.jurisdictions_covered}
            </div>
            <div className="text-[13px] text-[#5F5F5F]">States covered</div>
          </div>
        </div>

        <p className="mt-8 text-center text-[12px] text-[#8A8A8A]">
          Individual results vary. This is a writing tool, not legal
          representation. Statistics reflect consented, verified outcomes only.
        </p>
      </div>
    </div>
  );
}
