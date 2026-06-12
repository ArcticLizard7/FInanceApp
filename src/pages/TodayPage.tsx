import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Plus, AlertTriangle, Bell, CreditCard, CheckCircle2 } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useTaskStore } from '@/stores/taskStore';
import { usePaymentStore } from '@/stores/paymentStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { TaskCard } from '@/components/tasks/TaskCard';
import { QuickCapture } from '@/components/tasks/QuickCapture';
import { Modal } from '@/components/common/Modal';
import { TaskForm } from '@/components/tasks/TaskForm';
import { ApprovalBadge } from '@/components/payments/PaymentStatusBadge';
import { Button } from '@/components/common/Button';
import { formatCurrency, isOverdue, isDueToday } from '@/utils/dateUtils';
import type { Task } from '@/types';

export function TodayPage() {
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspaceStore();
  const { getWorkspaceTasks, addTask, updateTask, deleteTask, completeTask, duplicateTask } = useTaskStore();
  const { getWorkspacePayments } = usePaymentStore();
  const { getWorkspaceNotifications, markRead } = useNotificationStore();

  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const wsId = activeWorkspace?.id ?? '';
  const wsTasks = getWorkspaceTasks(wsId);
  const wsPayments = getWorkspacePayments(wsId);
  const notifications = getWorkspaceNotifications(wsId).filter(n => !n.isRead);

  const todayTasks    = wsTasks.filter(t => t.status !== 'completed' && isDueToday(t.dueDate));
  const overdueTasks  = wsTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled' && isOverdue(t.dueDate, t.status));
  const paymentsToday = wsPayments.filter(p => p.paymentStatus !== 'paid' && isDueToday(p.dueDate));
  const completedToday = wsTasks.filter(t => t.completedAt && isDueToday(t.completedAt));

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-50 rounded-xl">
              <Sun className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{greeting}</h1>
              <p className="text-sm text-slate-500">
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                {' · '}{activeWorkspace?.name}
              </p>
            </div>
          </div>

          {/* Daily summary */}
          <div className="mt-4 p-4 bg-slate-50 rounded-xl flex flex-wrap gap-4 text-sm">
            <span className="text-slate-600"><strong className="text-slate-800">{todayTasks.length}</strong> due today</span>
            {overdueTasks.length > 0 && (
              <span className="text-red-600"><strong>{overdueTasks.length}</strong> overdue</span>
            )}
            <span className="text-green-600"><strong>{completedToday.length}</strong> completed today</span>
            {!activeWorkspace?.hideFinanceFeatures && paymentsToday.length > 0 && (
              <span className="text-orange-600"><strong>{paymentsToday.length}</strong> payment(s) due</span>
            )}
          </div>
        </div>

        <div className="mb-8 space-y-3">
          <QuickCapture workspaceId={wsId} onAddTask={addTask} />
          <Button variant="outline" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddTask(true)} className="w-full justify-center">
            Open Full Task Form
          </Button>
          <Button variant="ghost" onClick={() => navigate('/review')} className="w-full justify-center">
            Weekly Review
          </Button>
        </div>

        {/* Overdue */}
        {overdueTasks.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" /> Overdue ({overdueTasks.length})
            </h2>
            <div className="space-y-2">
              {overdueTasks.map(t => (
                <TaskCard key={t.id} task={t} onComplete={completeTask} onEdit={setEditingTask} onDelete={deleteTask} onDuplicate={duplicateTask} />
              ))}
            </div>
          </section>
        )}

        {/* Due Today */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
            Today's Tasks ({todayTasks.length})
          </h2>
          {todayTasks.length === 0
            ? <p className="text-sm text-slate-400 py-4 text-center">No tasks scheduled for today.</p>
            : <div className="space-y-2">{todayTasks.map(t => (
              <TaskCard key={t.id} task={t} onComplete={completeTask} onEdit={setEditingTask} onDelete={deleteTask} onDuplicate={duplicateTask} />
            ))}</div>
          }
        </section>

        {/* Payments due today */}
        {!activeWorkspace?.hideFinanceFeatures && paymentsToday.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-3 flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5" /> Payment Actions Due Today
            </h2>
            <div className="space-y-2">
              {paymentsToday.map(p => (
                <div key={p.id} className="bg-white border border-orange-100 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.supplier}</p>
                    <p className="text-xs text-slate-500">{p.project} · {p.invoiceReference}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800">{formatCurrency(p.totalAmount, p.currency)}</p>
                    <ApprovalBadge status={p.approvalStatus} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Notifications / Reminders */}
        {notifications.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-brand-500" /> Reminders & Alerts
            </h2>
            <div className="space-y-2">
              {notifications.slice(0, 5).map(n => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className="bg-brand-50 border border-brand-100 rounded-xl p-4 cursor-pointer hover:bg-brand-100 transition-colors"
                >
                  <p className="text-sm font-medium text-brand-800">{n.title}</p>
                  <p className="text-xs text-brand-600 mt-1">{n.message}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Completed today */}
        {completedToday.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> Completed Today ({completedToday.length})
            </h2>
            <div className="space-y-2 opacity-70">
              {completedToday.map(t => (
                <TaskCard key={t.id} task={t} onComplete={completeTask} onEdit={setEditingTask} onDelete={deleteTask} onDuplicate={duplicateTask} compact />
              ))}
            </div>
          </section>
        )}
      </div>

      <Modal open={showAddTask} onClose={() => setShowAddTask(false)} title="Quick Add Task" size="lg">
        <TaskForm
          initial={{ dueDate: new Date().toISOString() }}
          onSave={data => { addTask(data); setShowAddTask(false); }}
          onCancel={() => setShowAddTask(false)}
        />
      </Modal>

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
