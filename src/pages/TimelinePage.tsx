import { useState } from 'react';
import { Calendar, AlertTriangle, Clock } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useTaskStore } from '@/stores/taskStore';
import { usePaymentStore } from '@/stores/paymentStore';
import { TaskCard } from '@/components/tasks/TaskCard';
import { Modal } from '@/components/common/Modal';
import { TaskForm } from '@/components/tasks/TaskForm';
import { ApprovalBadge } from '@/components/payments/PaymentStatusBadge';
import { formatDate, formatCurrency, isOverdue, isDueToday, addDays, parseISO } from '@/utils/dateUtils';
import { cn } from '@/utils/cn';
import type { Task } from '@/types';

type Period = 'today' | 'tomorrow' | '7days' | '30days' | 'overdue';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'overdue',  label: 'Overdue' },
  { id: 'today',    label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: '7days',    label: 'Next 7 Days' },
  { id: '30days',   label: 'Next 30 Days' },
];

export function TimelinePage() {
  const { activeWorkspace } = useWorkspaceStore();
  const { getWorkspaceTasks, updateTask, deleteTask, completeTask, duplicateTask } = useTaskStore();
  const { getWorkspacePayments } = usePaymentStore();

  const [period, setPeriod] = useState<Period>('today');
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const wsId = activeWorkspace?.id ?? '';
  const tasks = getWorkspaceTasks(wsId).filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const payments = getWorkspacePayments(wsId).filter(p => p.paymentStatus !== 'paid');

  const now = new Date();
  const in7 = addDays(now, 7);
  const in30 = addDays(now, 30);

  const filterTasks = (p: Period) => {
    return tasks.filter(t => {
      if (!t.dueDate) return false;
      const d = parseISO(t.dueDate);
      switch (p) {
        case 'overdue':  return isOverdue(t.dueDate, t.status);
        case 'today':    return isDueToday(t.dueDate);
        case 'tomorrow': return d >= addDays(now, 1) && d < addDays(now, 2);
        case '7days':    return d > addDays(now, 1) && d <= in7;
        case '30days':   return d > in7 && d <= in30;
        default:         return false;
      }
    }).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  };

  const filterPayments = (p: Period) => {
    return payments.filter(pay => {
      if (!pay.dueDate) return false;
      const d = parseISO(pay.dueDate);
      switch (p) {
        case 'overdue':  return isOverdue(pay.dueDate);
        case 'today':    return isDueToday(pay.dueDate);
        case 'tomorrow': return d >= addDays(now, 1) && d < addDays(now, 2);
        case '7days':    return d > addDays(now, 1) && d <= in7;
        case '30days':   return d > in7 && d <= in30;
        default:         return false;
      }
    }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  };

  const currentTasks = filterTasks(period);
  const currentPayments = filterPayments(period);
  const showFinance = !activeWorkspace?.hideFinanceFeatures;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Timeline</h1>
          <p className="text-sm text-slate-500 mt-1">Tasks and payment deadlines by time period</p>
        </div>

        {/* Period tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6">
          {PERIODS.map(p => {
            const count = filterTasks(p.id).length + (showFinance ? filterPayments(p.id).length : 0);
            return (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
                  period === p.id
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {p.id === 'overdue' && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                {p.id === 'today' && <Clock className="w-3.5 h-3.5 text-brand-500" />}
                <span className="hidden sm:inline">{p.label}</span>
                {count > 0 && (
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full font-semibold',
                    p.id === 'overdue' ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-600'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {currentTasks.length === 0 && currentPayments.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nothing in this period.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tasks */}
            {currentTasks.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Tasks ({currentTasks.length})
                </h3>
                <div className="space-y-2">
                  {currentTasks.map(t => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      onComplete={completeTask}
                      onEdit={setEditingTask}
                      onDelete={deleteTask}
                      onDuplicate={duplicateTask}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Payments */}
            {showFinance && currentPayments.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Payment Deadlines ({currentPayments.length})
                </h3>
                <div className="space-y-2">
                  {currentPayments.map(p => (
                    <div key={p.id} className="bg-white border border-slate-100 rounded-xl p-4 flex items-center gap-4 shadow-card">
                      <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                        <Calendar className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{p.supplier}</p>
                        <p className="text-xs text-slate-500">{p.project} · {p.invoiceReference}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-slate-800">{formatCurrency(p.totalAmount, p.currency)}</p>
                        <p className="text-xs text-slate-500">{formatDate(p.dueDate)}</p>
                        <ApprovalBadge status={p.approvalStatus} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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
