import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useTaskStore } from '@/stores/taskStore';
import { TaskCard } from '@/components/tasks/TaskCard';
import { Modal } from '@/components/common/Modal';
import { TaskForm } from '@/components/tasks/TaskForm';
import { Button } from '@/components/common/Button';
import { cn } from '@/utils/cn';
import type { Task, TaskStatus } from '@/types';
import { statusLabel } from '@/utils/colorUtils';

const COLUMNS: { status: TaskStatus; colour: string }[] = [
  { status: 'todo',        colour: 'border-slate-200' },
  { status: 'in_progress', colour: 'border-blue-200' },
  { status: 'waiting',     colour: 'border-amber-200' },
  { status: 'completed',   colour: 'border-green-200' },
];

export function KanbanPage() {
  const { activeWorkspace } = useWorkspaceStore();
  const { getWorkspaceTasks, addTask, updateTask, deleteTask, completeTask, duplicateTask, moveTask } = useTaskStore();

  const [showAdd, setShowAdd] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo');
  const [dragging, setDragging] = useState<string | null>(null);

  const wsId = activeWorkspace?.id ?? '';
  const allTasks = getWorkspaceTasks(wsId).filter(t => t.status !== 'cancelled');

  const handleDrop = (status: TaskStatus) => {
    if (dragging) {
      moveTask(dragging, status);
      setDragging(null);
    }
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Kanban Board</h1>
          <p className="text-sm text-slate-500 mt-1">{activeWorkspace?.name}</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setDefaultStatus('todo'); setShowAdd(true); }}>
          Add Task
        </Button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 p-6 h-full min-w-max">
          {COLUMNS.map(col => {
            const colTasks = allTasks.filter(t => t.status === col.status);
            return (
              <div
                key={col.status}
                className="flex flex-col w-72 flex-shrink-0"
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(col.status)}
              >
                {/* Column header */}
                <div className={cn('flex items-center justify-between px-3 py-2.5 rounded-t-xl border-t-2 bg-slate-50', col.colour)}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">{statusLabel[col.status]}</span>
                    <span className="text-xs text-slate-400 bg-white px-1.5 py-0.5 rounded-full border border-slate-200">
                      {colTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => { setDefaultStatus(col.status); setShowAdd(true); }}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Cards */}
                <div className="flex-1 bg-slate-50 rounded-b-xl p-2 overflow-y-auto space-y-2 min-h-[400px]">
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => setDragging(task.id)}
                      onDragEnd={() => setDragging(null)}
                      className={cn('cursor-grab active:cursor-grabbing', dragging === task.id && 'opacity-50')}
                    >
                      <TaskCard
                        task={task}
                        onComplete={completeTask}
                        onEdit={setEditingTask}
                        onDelete={deleteTask}
                        onDuplicate={duplicateTask}
                        compact
                      />
                    </div>
                  ))}

                  {colTasks.length === 0 && (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl h-24 flex items-center justify-center">
                      <p className="text-xs text-slate-400">Drop here</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Task" size="lg">
        <TaskForm
          initial={{ status: defaultStatus }}
          onSave={data => { addTask(data); setShowAdd(false); }}
          onCancel={() => setShowAdd(false)}
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
