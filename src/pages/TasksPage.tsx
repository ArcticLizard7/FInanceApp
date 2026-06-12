import { useState, useMemo } from 'react';
import { Plus, Filter, Search } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useTaskStore } from '@/stores/taskStore';
import { TaskCard } from '@/components/tasks/TaskCard';
import { QuickCapture } from '@/components/tasks/QuickCapture';
import { Modal } from '@/components/common/Modal';
import { TaskForm } from '@/components/tasks/TaskForm';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { Select } from '@/components/common/Input';
import { categoryLabel, priorityLabel, statusLabel } from '@/utils/colorUtils';
import { isOverdue } from '@/utils/dateUtils';
import type { Task } from '@/types';

const CATEGORY_OPTIONS = [{ value: '', label: 'All Categories' }, ...Object.entries(categoryLabel).map(([v, l]) => ({ value: v, label: l }))];
const PRIORITY_OPTIONS = [{ value: '', label: 'All Priorities' }, ...Object.entries(priorityLabel).map(([v, l]) => ({ value: v, label: l }))];
const STATUS_OPTIONS   = [{ value: '', label: 'All Statuses' },   ...Object.entries(statusLabel).map(([v, l]) => ({ value: v, label: l }))];

export function TasksPage() {
  const { activeWorkspace } = useWorkspaceStore();
  const { getWorkspaceTasks, addTask, updateTask, deleteTask, completeTask, duplicateTask } = useTaskStore();

  const [showAdd, setShowAdd] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const wsId = activeWorkspace?.id ?? '';
  const allTasks = getWorkspaceTasks(wsId);

  const filtered = useMemo(() => {
    return allTasks.filter(t => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory && t.category !== filterCategory) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterStatus) {
        if (filterStatus === 'overdue') return isOverdue(t.dueDate, t.status);
        if (t.status !== filterStatus) return false;
      }
      return true;
    }).sort((a, b) => {
      // Sort: overdue first, then by due date, then priority
      const aOver = isOverdue(a.dueDate, a.status) ? 0 : 1;
      const bOver = isOverdue(b.dueDate, b.status) ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
  }, [allTasks, search, filterCategory, filterPriority, filterStatus]);

  const incomplete = filtered.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const complete   = filtered.filter(t => t.status === 'completed');

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Tasks</h1>
            <p className="text-sm text-slate-500 mt-1">{allTasks.filter(t => t.status !== 'completed').length} open · {allTasks.filter(t => t.status === 'completed').length} completed</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" icon={<Filter className="w-3.5 h-3.5" />} onClick={() => setShowFilters(!showFilters)}>
              Filter
            </Button>
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowAdd(true)}>Add Task</Button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <QuickCapture workspaceId={wsId} onAddTask={addTask} />
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="grid grid-cols-3 gap-3 mb-4 p-4 bg-slate-50 rounded-xl">
            <Select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              options={CATEGORY_OPTIONS}
            />
            <Select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              options={PRIORITY_OPTIONS}
            />
            <Select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              options={[...STATUS_OPTIONS, { value: 'overdue', label: 'Overdue' }]}
            />
          </div>
        )}

        {/* Task list */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Plus className="w-10 h-10" />}
            title="No tasks found"
            description="Add a task or adjust your filters."
            action={<Button onClick={() => setShowAdd(true)} icon={<Plus className="w-4 h-4" />}>Add Task</Button>}
          />
        ) : (
          <div className="space-y-6">
            {incomplete.length > 0 && (
              <div className="space-y-2">
                {incomplete.map(t => (
                  <TaskCard key={t.id} task={t} onComplete={completeTask} onEdit={setEditingTask} onDelete={deleteTask} onDuplicate={duplicateTask} />
                ))}
              </div>
            )}

            {complete.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Completed</h3>
                <div className="space-y-2">
                  {complete.slice(0, 10).map(t => (
                    <TaskCard key={t.id} task={t} onComplete={completeTask} onEdit={setEditingTask} onDelete={deleteTask} onDuplicate={duplicateTask} compact />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Task" size="lg">
        <TaskForm onSave={data => { addTask(data); setShowAdd(false); }} onCancel={() => setShowAdd(false)} />
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
