import { useState } from 'react';
import { CheckCircle2, Clock, CalendarDays, PauseCircle, ArrowRight } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useTaskStore } from '@/stores/taskStore';
import { TaskCard } from '@/components/tasks/TaskCard';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { TaskForm } from '@/components/tasks/TaskForm';
import { addDays, formatDate, isDueSoon, isOverdue, parseISO } from '@/utils/dateUtils';
import type { Task } from '@/types';

export function ReviewPage() {
  const { activeWorkspace } = useWorkspaceStore();
  const { getWorkspaceTasks, updateTask, deleteTask, completeTask, duplicateTask } = useTaskStore();
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const wsId = activeWorkspace?.id ?? '';
  const tasks = getWorkspaceTasks(wsId);
  const openTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');

  const overdue = openTasks.filter(t => isOverdue(t.dueDate, t.status));
  const waiting = openTasks.filter(t => t.status === 'waiting');
  const upcoming = openTasks
    .filter(t => !isOverdue(t.dueDate, t.status) && isDueSoon(t.dueDate, 7))
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  const stale = openTasks.filter(t => {
    const updated = parseISO(t.updatedAt);
    return !t.dueDate && updated < addDays(new Date(), -14);
  });
  const completedThisWeek = tasks.filter(t => t.completedAt && parseISO(t.completedAt) >= addDays(new Date(), -7));

  const moveToTomorrow = (task: Task) => {
    updateTask(task.id, { dueDate: addDays(new Date(), 1).toISOString(), status: task.status === 'waiting' ? 'todo' : task.status });
  };

  const moveToNextWeek = (task: Task) => {
    updateTask(task.id, { dueDate: addDays(new Date(), 7).toISOString(), status: task.status === 'waiting' ? 'todo' : task.status });
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Weekly Review</h1>
          <p className="text-sm text-slate-500 mt-1">{activeWorkspace?.name} · a quick reset for the next few days</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Overdue', value: overdue.length, icon: <Clock className="w-5 h-5" />, colour: 'text-red-600 bg-red-50 border-red-100' },
            { label: 'Waiting', value: waiting.length, icon: <PauseCircle className="w-5 h-5" />, colour: 'text-amber-600 bg-amber-50 border-amber-100' },
            { label: 'Next 7 Days', value: upcoming.length, icon: <CalendarDays className="w-5 h-5" />, colour: 'text-brand-600 bg-brand-50 border-brand-100' },
            { label: 'Completed', value: completedThisWeek.length, icon: <CheckCircle2 className="w-5 h-5" />, colour: 'text-green-600 bg-green-50 border-green-100' },
          ].map(item => (
            <div key={item.label} className={`rounded-xl border p-4 ${item.colour}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide opacity-80">{item.label}</p>
                {item.icon}
              </div>
              <p className="text-2xl font-bold mt-2">{item.value}</p>
            </div>
          ))}
        </div>

        <ReviewSection
          title="Needs a decision"
          tasks={[...overdue, ...stale].filter((task, index, arr) => arr.findIndex(t => t.id === task.id) === index)}
          empty="Nothing stale or overdue."
          onComplete={completeTask}
          onEdit={setEditingTask}
          onDelete={deleteTask}
          onDuplicate={duplicateTask}
          onTomorrow={moveToTomorrow}
          onNextWeek={moveToNextWeek}
        />

        <ReviewSection
          title="Waiting on someone"
          tasks={waiting}
          empty="No waiting items."
          onComplete={completeTask}
          onEdit={setEditingTask}
          onDelete={deleteTask}
          onDuplicate={duplicateTask}
          onTomorrow={moveToTomorrow}
          onNextWeek={moveToNextWeek}
        />

        <ReviewSection
          title="Coming up"
          tasks={upcoming}
          empty="No dated tasks in the next week."
          onComplete={completeTask}
          onEdit={setEditingTask}
          onDelete={deleteTask}
          onDuplicate={duplicateTask}
          onTomorrow={moveToTomorrow}
          onNextWeek={moveToNextWeek}
        />
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
    </div>
  );
}

interface ReviewSectionProps {
  title: string;
  tasks: Task[];
  empty: string;
  onComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onTomorrow: (task: Task) => void;
  onNextWeek: (task: Task) => void;
}

function ReviewSection({ title, tasks, empty, onComplete, onEdit, onDelete, onDuplicate, onTomorrow, onNextWeek }: ReviewSectionProps) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">{title} ({tasks.length})</h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-slate-400 py-4">{empty}</p>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <div key={task.id} className="space-y-2">
              <TaskCard task={task} onComplete={onComplete} onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicate} />
              <div className="flex items-center gap-2 pl-8">
                <Button variant="outline" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />} onClick={() => onTomorrow(task)}>
                  Tomorrow
                </Button>
                <Button variant="outline" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />} onClick={() => onNextWeek(task)}>
                  Next Week
                </Button>
                {task.dueDate && <span className="text-xs text-slate-400">Currently {formatDate(task.dueDate)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
