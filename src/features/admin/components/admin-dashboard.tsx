'use client';

/**
 * Admin dashboard — client component.
 *
 * Provides: case overview, audit log viewer, webhook DLQ,
 * payment reconciliation, and basic metrics.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface DashboardStats {
  total_cases: number;
  cases_by_status: Record<string, number>;
  cases_by_wedge: Record<string, number>;
  recent_generations: number;
  pending_deadlines: number;
  failed_webhooks: number;
}

interface MonitorAlert {
  id: string;
  statute_id: string;
  citation: string;
  jurisdiction: string;
  kb_entry_id: string;
  change_summary: string;
  severity: 'info' | 'warning' | 'critical';
  confidence: number;
  source_urls: string[];
  status: 'new' | 'acknowledged' | 'dismissed';
  acknowledged_by: string | null;
  created_at: string;
}

interface MonitorRun {
  id: string;
  started_at: string;
  completed_at: string | null;
  statutes_checked: number;
  changes_detected: number;
  status: 'running' | 'completed' | 'failed';
  error: string | null;
}

type AdminTab = 'overview' | 'cases' | 'audit' | 'webhooks' | 'payments' | 'law-monitor';

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [cases, setCases] = useState<Record<string, unknown>[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<Record<string, unknown>[]>([]);
  const [payments, setPayments] = useState<Record<string, unknown>[]>([]);
  const [refundingTxn, setRefundingTxn] = useState<string | null>(null);
  const [monitorAlerts, setMonitorAlerts] = useState<MonitorAlert[]>([]);
  const [latestMonitorRun, setLatestMonitorRun] = useState<MonitorRun | null>(null);
  const [unacknowledgedAlertCount, setUnacknowledgedAlertCount] = useState(0);
  const [triggeringMonitorRun, setTriggeringMonitorRun] = useState(false);
  const [processingAlertId, setProcessingAlertId] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = (await res.json()) as DashboardStats;
        setStats(data);
      }
    } catch { /* non-critical */ }
  }, []);

  const fetchCases = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cases');
      if (res.ok) {
        const data = (await res.json()) as { cases: Record<string, unknown>[] };
        setCases(data.cases ?? []);
      }
    } catch { /* non-critical */ }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/audit-logs');
      if (res.ok) {
        const data = (await res.json()) as { logs: Record<string, unknown>[] };
        setAuditLogs(data.logs ?? []);
      }
    } catch { /* non-critical */ }
  }, []);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/webhooks');
      if (res.ok) {
        const data = (await res.json()) as { events: Record<string, unknown>[] };
        setWebhookEvents(data.events ?? []);
      }
    } catch { /* non-critical */ }
  }, []);

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/payments');
      if (res.ok) {
        const data = (await res.json()) as { payments: Record<string, unknown>[] };
        setPayments(data.payments ?? []);
      }
    } catch { /* non-critical */ }
  }, []);

  const fetchMonitorAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/monitor-alerts');
      if (res.ok) {
        const data = (await res.json()) as {
          alerts: MonitorAlert[];
          latest_run: MonitorRun | null;
          unacknowledged_count: number;
        };
        setMonitorAlerts(data.alerts ?? []);
        setLatestMonitorRun(data.latest_run);
        setUnacknowledgedAlertCount(data.unacknowledged_count);
      }
    } catch { /* non-critical */ }
  }, []);

  const handleMonitorAction = useCallback(async (alertId: string, action: 'acknowledge' | 'dismiss') => {
    setProcessingAlertId(alertId);
    try {
      const res = await fetch('/api/admin/monitor-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId, action }),
      });
      if (res.ok) {
        void fetchMonitorAlerts();
      }
    } catch { /* non-critical */ }
    setProcessingAlertId(null);
  }, [fetchMonitorAlerts]);

  const handleTriggerMonitorRun = useCallback(async () => {
    if (!confirm('Run the law monitor now? This will check all tracked statutes for changes.')) {
      return;
    }
    setTriggeringMonitorRun(true);
    try {
      await fetch('/api/admin/monitor-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch { /* non-critical */ }
    setTriggeringMonitorRun(false);
  }, []);

  const handleRefund = useCallback(async (orderId: string) => {
    if (!confirm(`Are you sure you want to refund order ${orderId}? This cannot be undone.`)) {
      return;
    }
    setRefundingTxn(orderId);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      });
      if (res.ok) {
        void fetchPayments();
      }
    } catch { /* non-critical */ }
    setRefundingTxn(null);
  }, [fetchPayments]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'cases') void fetchCases();
    if (activeTab === 'audit') void fetchAuditLogs();
    if (activeTab === 'webhooks') void fetchWebhooks();
    if (activeTab === 'payments') void fetchPayments();
    if (activeTab === 'law-monitor') void fetchMonitorAlerts();
  }, [activeTab, fetchCases, fetchAuditLogs, fetchWebhooks, fetchPayments, fetchMonitorAlerts]);

  const TABS: { id: AdminTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'cases', label: 'Cases' },
    { id: 'audit', label: 'Audit Log' },
    { id: 'webhooks', label: 'Webhooks' },
    { id: 'payments', label: 'Payments' },
    { id: 'law-monitor', label: `Law Monitor${unacknowledgedAlertCount > 0 ? ` (${unacknowledgedAlertCount})` : ''}` },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-2xl font-bold text-neutral-900">Admin Dashboard</h1>

        {/* Tab navigation */}
        <div className="mb-6 flex gap-1 rounded-lg bg-neutral-100 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-neutral-500">Total Cases</p>
                <p className="text-3xl font-bold">{stats.total_cases}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-neutral-500">Recent Generations</p>
                <p className="text-3xl font-bold">{stats.recent_generations}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-neutral-500">Pending Deadlines</p>
                <p className="text-3xl font-bold">{stats.pending_deadlines}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-neutral-500">Failed Webhooks</p>
                <p className="text-3xl font-bold text-red-600">{stats.failed_webhooks}</p>
              </CardContent>
            </Card>

            <Card className="sm:col-span-2">
              <CardContent className="p-4">
                <p className="mb-2 text-sm font-medium text-neutral-500">Cases by Status</p>
                {Object.entries(stats.cases_by_status).map(([status, count]) => (
                  <div key={status} className="flex justify-between py-1 text-sm">
                    <span className="text-neutral-700">{status}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="sm:col-span-2">
              <CardContent className="p-4">
                <p className="mb-2 text-sm font-medium text-neutral-500">Cases by Wedge</p>
                {Object.entries(stats.cases_by_wedge).map(([wedge, count]) => (
                  <div key={wedge} className="flex justify-between py-1 text-sm">
                    <span className="text-neutral-700">{wedge}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Cases list */}
        {activeTab === 'cases' && (
          <div className="rounded-lg border bg-white">
            <div className="border-b px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">All Cases</p>
                <Button size="sm" variant="outline" onClick={fetchCases}>Refresh</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-neutral-50 text-left">
                    <th className="px-4 py-2 font-medium">ID</th>
                    <th className="px-4 py-2 font-medium">Wedge</th>
                    <th className="px-4 py-2 font-medium">Jurisdiction</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Payment</th>
                    <th className="px-4 py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c['id'] as string} className="border-b hover:bg-neutral-50">
                      <td className="px-4 py-2 font-mono text-xs">{(c['id'] as string).slice(0, 8)}...</td>
                      <td className="px-4 py-2">{c['wedge'] as string}</td>
                      <td className="px-4 py-2">{c['jurisdiction'] as string}</td>
                      <td className="px-4 py-2">
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">{c['status'] as string}</span>
                      </td>
                      <td className="px-4 py-2">{c['payment_status'] as string}</td>
                      <td className="px-4 py-2 text-xs text-neutral-500">{c['created_at'] as string}</td>
                    </tr>
                  ))}
                  {cases.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">No cases found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Audit logs */}
        {activeTab === 'audit' && (
          <div className="rounded-lg border bg-white">
            <div className="border-b px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Audit Log (last 50)</p>
                <Button size="sm" variant="outline" onClick={fetchAuditLogs}>Refresh</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-neutral-50 text-left">
                    <th className="px-4 py-2 font-medium">Case</th>
                    <th className="px-4 py-2 font-medium">Model</th>
                    <th className="px-4 py-2 font-medium">Prompt</th>
                    <th className="px-4 py-2 font-medium">Citations</th>
                    <th className="px-4 py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log['id'] as string} className="border-b hover:bg-neutral-50">
                      <td className="px-4 py-2 font-mono text-xs">{((log['case_id'] as string) ?? '').slice(0, 8)}...</td>
                      <td className="px-4 py-2 text-xs">{log['model_version'] as string}</td>
                      <td className="px-4 py-2 text-xs">{log['prompt_version'] as string}</td>
                      <td className="px-4 py-2 text-xs">{JSON.stringify(log['citation_validation_result'])?.slice(0, 40)}...</td>
                      <td className="px-4 py-2 text-xs text-neutral-500">{log['created_at'] as string}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">No audit logs</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Webhooks */}
        {activeTab === 'webhooks' && (
          <div className="rounded-lg border bg-white">
            <div className="border-b px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Webhook Events (last 50)</p>
                <Button size="sm" variant="outline" onClick={fetchWebhooks}>Refresh</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-neutral-50 text-left">
                    <th className="px-4 py-2 font-medium">Event ID</th>
                    <th className="px-4 py-2 font-medium">Provider</th>
                    <th className="px-4 py-2 font-medium">Processed</th>
                    <th className="px-4 py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {webhookEvents.map((ev) => (
                    <tr key={ev['id'] as string} className="border-b hover:bg-neutral-50">
                      <td className="px-4 py-2 font-mono text-xs">{ev['event_id'] as string}</td>
                      <td className="px-4 py-2">{ev['provider'] as string}</td>
                      <td className="px-4 py-2">
                        {ev['processed_at'] ? (
                          <span className="text-green-600">Yes</span>
                        ) : (
                          <span className="text-red-600">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-neutral-500">{ev['created_at'] as string}</td>
                    </tr>
                  ))}
                  {webhookEvents.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-500">No webhook events</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payments */}
        {activeTab === 'payments' && (
          <div className="rounded-lg border bg-white">
            <div className="border-b px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Payment Transactions</p>
                <Button size="sm" variant="outline" onClick={fetchPayments}>Refresh</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-neutral-50 text-left">
                    <th className="px-4 py-2 font-medium">Transaction</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Amount</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Created</th>
                    <th className="px-4 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p['id'] as string} className="border-b hover:bg-neutral-50">
                      <td className="px-4 py-2 font-mono text-xs">{(p['order_id'] as string)?.slice(0, 16)}...</td>
                      <td className="px-4 py-2 text-xs">{p['event_type'] as string}</td>
                      <td className="px-4 py-2">{p['currency'] as string} {((p['amount'] as number) / 100).toFixed(2)}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          p['status'] === 'paid' ? 'bg-green-100 text-green-700' :
                          p['status'] === 'refunded' ? 'bg-red-100 text-red-700' :
                          'bg-neutral-100 text-neutral-700'
                        }`}>{p['status'] as string}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-neutral-500">{p['created_at'] as string}</td>
                      <td className="px-4 py-2">
                        {p['status'] === 'paid' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-600 hover:bg-red-50"
                            onClick={() => handleRefund(p['order_id'] as string)}
                            disabled={refundingTxn === p['order_id']}
                          >
                            {refundingTxn === p['order_id'] ? 'Refunding...' : 'Refund'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">No payment transactions found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Law Monitor */}
        {activeTab === 'law-monitor' && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-neutral-500">Last Run</p>
                  <p className="text-lg font-bold">
                    {latestMonitorRun
                      ? new Date(latestMonitorRun.started_at).toLocaleDateString()
                      : 'Never'}
                  </p>
                  {latestMonitorRun && (
                    <p className={`text-xs ${
                      latestMonitorRun.status === 'completed' ? 'text-green-600' :
                      latestMonitorRun.status === 'failed' ? 'text-red-600' :
                      'text-amber-600'
                    }`}>
                      {latestMonitorRun.status === 'completed'
                        ? `${latestMonitorRun.statutes_checked} checked, ${latestMonitorRun.changes_detected} changes`
                        : latestMonitorRun.status === 'failed'
                          ? `Failed: ${latestMonitorRun.error?.slice(0, 50) ?? 'unknown'}`
                          : 'Running...'}
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-neutral-500">Unacknowledged Alerts</p>
                  <p className={`text-3xl font-bold ${unacknowledgedAlertCount > 0 ? 'text-amber-600' : ''}`}>
                    {unacknowledgedAlertCount}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-neutral-500">Manual Run</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1"
                    onClick={handleTriggerMonitorRun}
                    disabled={triggeringMonitorRun}
                  >
                    {triggeringMonitorRun ? 'Starting...' : 'Run Now'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Alerts table */}
            <div className="rounded-lg border bg-white">
              <div className="border-b px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Law Monitor Alerts</p>
                  <Button size="sm" variant="outline" onClick={fetchMonitorAlerts}>Refresh</Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-neutral-50 text-left">
                      <th className="px-4 py-2 font-medium">Severity</th>
                      <th className="px-4 py-2 font-medium">Statute</th>
                      <th className="px-4 py-2 font-medium">Jurisdiction</th>
                      <th className="px-4 py-2 font-medium">Summary</th>
                      <th className="px-4 py-2 font-medium">Confidence</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Detected</th>
                      <th className="px-4 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monitorAlerts.map((alert) => (
                      <tr key={alert.id} className="border-b hover:bg-neutral-50">
                        <td className="px-4 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                            alert.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
                            'bg-accent text-accent-foreground'
                          }`}>{alert.severity}</span>
                        </td>
                        <td className="px-4 py-2 text-xs font-mono">{alert.citation}</td>
                        <td className="px-4 py-2">{alert.jurisdiction}</td>
                        <td className="max-w-xs truncate px-4 py-2 text-xs" title={alert.change_summary}>
                          {alert.change_summary}
                        </td>
                        <td className="px-4 py-2 text-xs">{Math.round(alert.confidence * 100)}%</td>
                        <td className="px-4 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs ${
                            alert.status === 'new' ? 'bg-amber-100 text-amber-700' :
                            alert.status === 'acknowledged' ? 'bg-green-100 text-green-700' :
                            'bg-neutral-100 text-neutral-500'
                          }`}>{alert.status}</span>
                        </td>
                        <td className="px-4 py-2 text-xs text-neutral-500">
                          {new Date(alert.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2">
                          {alert.status === 'new' && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => handleMonitorAction(alert.id, 'acknowledge')}
                                disabled={processingAlertId === alert.id}
                              >
                                Ack
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-neutral-500"
                                onClick={() => handleMonitorAction(alert.id, 'dismiss')}
                                disabled={processingAlertId === alert.id}
                              >
                                Dismiss
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {monitorAlerts.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-neutral-500">No law monitor alerts</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
