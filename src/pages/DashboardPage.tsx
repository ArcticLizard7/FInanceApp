import { useState } from 'react';
import {
  CheckSquare, AlertTriangle, Clock, Zap, CreditCard,
  Plus, FileSpreadsheet, Bell, BarChart2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useTaskStore } from '@/stores/taskStore';
import { usePaymentStore } from '@/stores/paymentStore';
import { StatCard } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { TaskCard } from '@/components/tasks/TaskCard';
import { QuickCapture } from '@/components/tasks/QuickCapture';
import { Modal } from '@/components/common/Modal';
import { TaskForm } from '@/components/tasks/TaskForm';
import { ApprovalBadge } from '@/components/payments/PaymentStatusBadge';
import { formatDate, formatCurrency, isOverdue, isDueToday, isDueSoon } from '@/utils/dateUtils';
import type { Task, PaymentRequest } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

export function DashboardPage() {
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspaceStore();
  const { addTask, updateTask, deleteTask, completeTask, duplicateTask, getWorkspaceTasks } = useTaskStore();
  const { getWorkspacePayments } = usePaymentStore();

  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const wsId = activeWorkspace?.id ?? '';
  const wsTasks = getWorkspaceTasks(wsId);
  const wsPayments = getWorkspacePayments(wsId);

  const overdueTasks   = wsTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled' && isOverdue(t.dueDate, t.status));
  const dueTodayTasks  = wsTasks.filter(t => t.status !== 'completed' && isDueToday(t.dueDate));
  const dueSoonTasks   = wsTasks.filter(t => t.status !== 'completed' && !isDueToday(t.dueDate) && isDueSoon(t.dueDate, 7));
  const priorityTasks  = wsTasks.filter(t => t.status !== 'completed' && (t.priority === 'high' || t.priority === 'critical'));
  const completedTotal = wsTasks.filter(t => t.status === 'completed').length;

  const upcomingPayments = wsPayments
    .filter(p => p.paymentStatus !== 'paid' && isDueSoon(p.dueDate, 21))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  // Simple category breakdown for mini chart
  const categoryData = ['payment_requests','invoices','approvals','reporting','vat_tax','payroll','project_finance','general_admin']
    .map(cat => ({
      name: cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).slice(0, 12),
      count: wsTasks.filter(t => t.category === cat && t.status !== 'completed').length,
    }))
    .filter(d => d.count > 0);

  const workspaceColour = activeWorkspace?.colour ?? '#6366f1';

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">
              {activeWorkspace?.name} · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" icon={<Bell className="w-4 h-4" />} onClick={() => navigate('/notifications')}>
              Reminders
            </Button>
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddTask(true)}>
              Add Task
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-4">
          <QuickCapture workspaceId={wsId} onAddTask={addTask} />
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { label: 'Add Task',            icon: <Plus className="w-3.5 h-3.5" />,           action: () => setShowAddTask(true) },
            { label: 'Add Payment Request', icon: <CreditCard className="w-3.5 h-3.5" />,     action: () => navigate('/payments?new=1') },
            { label: 'Import Excel',        icon: <FileSpreadsheet className="w-3.5 h-3.5" />, action: () => navigate('/import') },
            { label: 'View Reports',        icon: <BarChart2 className="w-3.5 h-3.5" />,       action: () => navigate('/reports') },
          ].map(q => (
            <Button key={q.label} variant="outline" size="sm" icon={q.icon} onClick={q.action}>
              {q.label}
            </Button>
          ))}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Due Today"
            value={dueTodayTasks.length}
            icon={<Clock className="w-5 h-5" />}
            colour="brand"
            onClick={() => navigate('/today')}
          />
          <StatCard
            label="Overdue"
            value={overdueTasks.length}
            icon={<AlertTriangle className="w-5 h-5" />}
            colour={overdueTasks.length > 0 ? 'red' : 'slate'}
            onClick={() => navigate('/tasks?filter=overdue')}
          />
          <StatCard
            label="Due This Week"
            value={dueSoonTasks.length}
            icon={<CheckSquare className="w-5 h-5" />}
            colour="amber"
            onClick={() => navigate('/timeline')}
          />
          <StatCard
            label="Completed"
            value={completedTotal}
            icon={<Zap className="w-5 h-5" />}
            colour="green"
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Task lists */}
          <div className="lg:col-span-2 space-y-6">
            {/* Overdue */}
            {overdueTasks.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Overdue ({overdueTasks.length})
                </h2>
                <div className="space-y-2">
                  {overdueTasks.slice(0, 5).map(t => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      onComplete={completeTask}
                      onEdit={setEditingTask}
                      onDelete={deleteTask}
                      onDuplicate={duplicateTask}
                      compact
                    />
                  ))}
                  {overdueTasks.length > 5 && (
                    <button onClick={() => navigate('/tasks?filter=overdue')} className="text-xs text-brand-600 hover:underline">
                      +{overdueTasks.length - 5} more overdue…
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* Due Today */}
            <section>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-500" /> Due Today ({dueTodayTasks.length})
              </h2>
              {dueTodayTasks.length === 0
                ? <p className="text-sm text-slate-400">Nothing due today.</p>
                : <div className="space-y-2">{dueTodayTasks.map(t => (
                  <TaskCard key={t.id} task={t} onComplete={completeTask} onEdit={setEditingTask} onDelete={deleteTask} onDuplicate={duplicateTask} compact />
                ))}</div>
              }
            </section>

            {/* Due This Week */}
            <section>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-amber-500" /> Next 7 Days ({dueSoonTasks.length})
              </h2>
              {dueSoonTasks.length === 0
                ? <p className="text-sm text-slate-400">Nothing due in the next 7 days.</p>
                : <div className="space-y-2">{dueSoonTasks.slice(0, 5).map(t => (
                  <TaskCard key={t.id} task={t} onComplete={completeTask} onEdit={setEditingTask} onDelete={deleteTask} onDuplicate={duplicateTask} compact />
                ))}</div>
              }
            </section>

            {/* Priority tasks */}
            {priorityTasks.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-orange-500" /> High Priority ({priorityTasks.length})
                </h2>
                <div className="space-y-2">
                  {priorityTasks.slice(0, 4).map(t => (
                    <TaskCard key={t.id} task={t} onComplete={completeTask} onEdit={setEditingTask} onDelete={deleteTask} onDuplicate={duplicateTask} compact />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right: Cashflow + Payments */}
          <div className="space-y-6">
            {/* Upcoming payments */}
            {!activeWorkspace?.hideFinanceFeatures && (
              <div className="bg-white rounded-xl border border-slate-100 shadow-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-slate-700">Upcoming Payments</h2>
                  <button onClick={() => navigate('/payments')} className="text-xs text-brand-600 hover:underline">View all</button>
                </div>
                {upcomingPayments.length === 0
                  ? <p className="text-sm text-slate-400 text-center py-4">No upcoming payments.</p>
                  : <div className="space-y-3">
                    {upcomingPayments.map(p => (
                      <UpcomingPaymentRow key={p.id} payment={p} />
                    ))}
                  </div>
                }

                {/* Total */}
                {upcomingPayments.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Total scheduled (3 weeks)</span>
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(upcomingPayments.reduce((s, p) => s + p.totalAmount, 0), activeWorkspace?.currency ?? 'GBP')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Task by category mini chart */}
            {categoryData.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-100 shadow-card p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-4">Open Tasks by Category</h2>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} width={90} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.1)', borderRadius: 8 }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={workspaceColour} opacity={0.7 + i * 0.03} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Task modal */}
      <Modal open={showAddTask} onClose={() => setShowAddTask(false)} title="Add Task" size="lg">
        <TaskForm
          onSave={data => { addTask(data); setShowAddTask(false); }}
          onCancel={() => setShowAddTask(false)}
        />
      </Modal>

      {/* Edit Task modal */}
      <Modal open={!!editingTask} onClose={() => setEditingTask(null)} title="Edit Task" size="lg">
        {editingTask && (
          <TaskForm
            initial={editingTask}
            onSave={data => { updateTask(editingTask.id, data); setEditingTask(null); }}
            onCancel={() => setEditingTask(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function UpcomingPaymentRow({ payment }: { payment: PaymentRequest }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-800 truncate">{payment.supplier}</p>
        <p className="text-xs text-slate-400 truncate">{payment.project}</p>
        <p className="text-xs text-slate-500 mt-0.5">{formatDate(payment.dueDate)}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-slate-800">{formatCurrency(payment.totalAmount, payment.currency)}</p>
        <ApprovalBadge status={payment.approvalStatus} />
      </div>
    </div>
  );
}
