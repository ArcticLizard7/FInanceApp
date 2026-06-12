import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { usePaymentStore } from '@/stores/paymentStore';
import { formatCurrency, formatDate, addDays, parseISO } from '@/utils/dateUtils';
import { ApprovalBadge, PaymentBadge } from '@/components/payments/PaymentStatusBadge';
import { isOverdue } from '@/utils/dateUtils';
import { cn } from '@/utils/cn';

interface WeekBucket {
  label: string;
  start: Date;
  end: Date;
  scheduled: number;
  approved: number;
  overdue: number;
  items: ReturnType<typeof usePaymentStore.getState>['payments'];
}

export function CashflowPage() {
  const { activeWorkspace } = useWorkspaceStore();
  const { getWorkspacePayments } = usePaymentStore();

  const wsId = activeWorkspace?.id ?? '';
  const currency = activeWorkspace?.currency ?? 'GBP';
  const payments = getWorkspacePayments(wsId).filter(p => p.paymentStatus !== 'paid');

  // Build 4-week buckets starting from today
  const buckets = useMemo<WeekBucket[]>(() => {
    const now = new Date();
    return Array.from({ length: 4 }, (_, i) => {
      const start = addDays(now, i * 7);
      const end   = addDays(now, (i + 1) * 7 - 1);
      const items = payments.filter(p => {
        const d = parseISO(p.dueDate);
        return d >= start && d <= end;
      });
      return {
        label: i === 0 ? 'This Week' : i === 1 ? 'Next Week' : `Wk ${i + 1}`,
        start, end,
        scheduled: items.filter(p => p.paymentStatus === 'scheduled').reduce((s, p) => s + p.totalAmount, 0),
        approved:  items.filter(p => p.approvalStatus === 'approved' && p.paymentStatus !== 'scheduled').reduce((s, p) => s + p.totalAmount, 0),
        overdue:   items.filter(p => isOverdue(p.dueDate)).reduce((s, p) => s + p.totalAmount, 0),
        items,
      };
    });
  }, [payments]);

  const overduePayments = payments.filter(p => isOverdue(p.dueDate)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const totalOutstanding = payments.reduce((s, p) => s + p.totalAmount, 0);
  const totalScheduled   = payments.filter(p => p.paymentStatus === 'scheduled').reduce((s, p) => s + p.totalAmount, 0);
  const totalApproved    = payments.filter(p => p.approvalStatus === 'approved' && p.paymentStatus !== 'paid').reduce((s, p) => s + p.totalAmount, 0);

  const chartData = buckets.map(b => ({
    name: b.label,
    'Scheduled':          b.scheduled / 1000,
    'Approved (unscheduled)': b.approved / 1000,
    'Overdue':            b.overdue / 1000,
  }));

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Cashflow Snapshot</h1>
          <p className="text-sm text-slate-500 mt-1">4-week payment outlook · {activeWorkspace?.name}</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-100 shadow-card p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Outstanding</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(totalOutstanding, currency)}</p>
            <p className="text-xs text-slate-400 mt-1">{payments.length} unpaid requests</p>
          </div>
          <div className="bg-white rounded-xl border border-green-100 shadow-card p-5">
            <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Scheduled</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(totalScheduled, currency)}</p>
            <p className="text-xs text-green-500 mt-1">Confirmed for payment</p>
          </div>
          <div className="bg-white rounded-xl border border-amber-100 shadow-card p-5">
            <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">Approved / Unscheduled</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{formatCurrency(totalApproved, currency)}</p>
            <p className="text-xs text-amber-500 mt-1">Approved, not yet scheduled</p>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-card p-6 mb-8">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Weekly Payment Forecast ({currency}k)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${currency} ${v}k`} />
              <Tooltip
                formatter={(value: number, name) => [formatCurrency(value * 1000, currency), name]}
                contentStyle={{ fontSize: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.1)', borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#e2e8f0" />
              <Bar dataKey="Scheduled"             stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Approved (unscheduled)" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Overdue"               stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly breakdown */}
        <div className="space-y-4 mb-8">
          {buckets.map(b => b.items.length > 0 && (
            <div key={b.label} className="bg-white rounded-xl border border-slate-100 shadow-card overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-slate-700">{b.label}</span>
                  <span className="text-xs text-slate-400 ml-2">
                    {formatDate(b.start, 'dd MMM')} – {formatDate(b.end, 'dd MMM')}
                  </span>
                </div>
                <span className="text-sm font-semibold text-slate-800">
                  {formatCurrency(b.items.reduce((s, p) => s + p.totalAmount, 0), currency)}
                </span>
              </div>
              <div className="divide-y divide-slate-50">
                {b.items.map(p => (
                  <div key={p.id} className={cn('flex items-center justify-between px-5 py-3 text-sm', isOverdue(p.dueDate) && 'bg-red-50/30')}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800 truncate">{p.supplier}</p>
                      <p className="text-xs text-slate-400">{p.project} · {p.invoiceReference} · Due {formatDate(p.dueDate)}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <ApprovalBadge status={p.approvalStatus} />
                      <PaymentBadge status={p.paymentStatus} />
                      <span className="font-semibold text-slate-800 whitespace-nowrap">{formatCurrency(p.totalAmount, p.currency)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Overdue */}
        {overduePayments.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-red-100">
              <h2 className="text-sm font-semibold text-red-700">Overdue Payments ({overduePayments.length})</h2>
            </div>
            <div className="divide-y divide-red-100">
              {overduePayments.map(p => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-red-800">{p.supplier}</p>
                    <p className="text-xs text-red-500">{p.project} · Due {formatDate(p.dueDate)}</p>
                  </div>
                  <span className="font-semibold text-red-700">{formatCurrency(p.totalAmount, p.currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
