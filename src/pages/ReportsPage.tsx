import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useTaskStore } from '@/stores/taskStore';
import { usePaymentStore } from '@/stores/paymentStore';
import { formatCurrency, parseISO, format, addDays } from '@/utils/dateUtils';
import { categoryLabel } from '@/utils/colorUtils';

export function ReportsPage() {
  const { activeWorkspace } = useWorkspaceStore();
  const { getWorkspaceTasks } = useTaskStore();
  const { getWorkspacePayments } = usePaymentStore();

  const wsId = activeWorkspace?.id ?? '';
  const currency = activeWorkspace?.currency ?? 'GBP';
  const tasks = getWorkspaceTasks(wsId);
  const payments = getWorkspacePayments(wsId);

  // Task completion by week (last 6 weeks)
  const weekData = Array.from({ length: 6 }, (_, i) => {
    const start = addDays(new Date(), -(5 - i) * 7);
    const end   = addDays(start, 6);
    const label = format(start, 'dd MMM');
    const completed = tasks.filter(t =>
      t.completedAt && parseISO(t.completedAt) >= start && parseISO(t.completedAt) <= end
    ).length;
    const created = tasks.filter(t =>
      parseISO(t.createdAt) >= start && parseISO(t.createdAt) <= end
    ).length;
    return { name: label, Completed: completed, Created: created };
  });

  // Task status breakdown
  const statusData = [
    { name: 'To Do',       value: tasks.filter(t => t.status === 'todo').length,        fill: '#6366f1' },
    { name: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, fill: '#0891b2' },
    { name: 'Waiting',     value: tasks.filter(t => t.status === 'waiting').length,     fill: '#f59e0b' },
    { name: 'Completed',   value: tasks.filter(t => t.status === 'completed').length,   fill: '#22c55e' },
  ].filter(d => d.value > 0);

  // Task by category
  const categoryData = Object.entries(categoryLabel).map(([cat, label]) => ({
    name: label.slice(0, 15),
    Open:      tasks.filter(t => t.category === cat && t.status !== 'completed').length,
    Completed: tasks.filter(t => t.category === cat && t.status === 'completed').length,
  })).filter(d => d.Open + d.Completed > 0);

  // Payment trend by month (last 6 months)
  const paymentTrend = Array.from({ length: 6 }, (_, i) => {
    const now = new Date();
    const month = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const label = format(month, 'MMM');
    const monthPayments = payments.filter(p => {
      const d = parseISO(p.createdAt);
      return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
    });
    return {
      name: label,
      'Total (£k)': parseFloat((monthPayments.reduce((s, p) => s + p.totalAmount, 0) / 1000).toFixed(1)),
      'Paid (£k)':  parseFloat((monthPayments.filter(p => p.paymentStatus === 'paid').reduce((s, p) => s + p.totalAmount, 0) / 1000).toFixed(1)),
    };
  });

  // Summary stats
  const completedThisWeek = tasks.filter(t => {
    if (!t.completedAt) return false;
    const d = parseISO(t.completedAt);
    return d >= addDays(new Date(), -7);
  }).length;
  const completedThisMonth = tasks.filter(t => {
    if (!t.completedAt) return false;
    const d = parseISO(t.completedAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const completionRate = tasks.length > 0
    ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100)
    : 0;
  const totalPaymentsValue = payments.reduce((s, p) => s + p.totalAmount, 0);
  const pendingApprovals = payments.filter(p => p.approvalStatus === 'awaiting_approval').length;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">{activeWorkspace?.name}</p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Completed This Week',  value: completedThisWeek,                colour: 'text-brand-600' },
            { label: 'Completed This Month', value: completedThisMonth,               colour: 'text-green-600' },
            { label: 'Completion Rate',       value: `${completionRate}%`,             colour: 'text-purple-600' },
            { label: 'Pending Approvals',     value: pendingApprovals,                 colour: 'text-amber-600' },
            { label: 'Total Payments Value',  value: formatCurrency(totalPaymentsValue, currency), colour: 'text-slate-700' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-100 shadow-card p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{k.label}</p>
              <p className={`text-xl font-bold mt-1 ${k.colour}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Task completion trend */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Task Activity — Last 6 Weeks</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weekData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.1)', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Completed" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Created"   stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Task status pie */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Task Status Breakdown</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                  {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.1)', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Category breakdown */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Tasks by Category</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryData} layout="vertical" margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} width={100} />
                <Tooltip contentStyle={{ fontSize: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.1)', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Open"      stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Completed" stackId="a" fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Payment trend */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Payment Requests — Last 6 Months (£k)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={paymentTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `£${v}k`} />
                <Tooltip
                  formatter={(v: number) => [`£${(v).toFixed(1)}k`]}
                  contentStyle={{ fontSize: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.1)', borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Total (£k)" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.7} />
                <Bar dataKey="Paid (£k)"  fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
