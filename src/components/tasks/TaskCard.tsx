import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, CheckCircle2, Circle, Calendar, User, RefreshCw, Edit2, Copy, Trash2, ListChecks } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatRelative, isOverdue, isDueToday } from '@/utils/dateUtils';
import { categoryColour, categoryLabel } from '@/utils/colorUtils';
import { PriorityBadge } from './PriorityBadge';
import { Badge } from '@/components/common/Badge';
import { useTaskStore } from '@/stores/taskStore';
import type { Task } from '@/types';

interface TaskCardProps {
  task: Task;
  onComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  compact?: boolean;
}

export function TaskCard({ task, onComplete, onEdit, onDelete, onDuplicate, compact = false }: TaskCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const updateTask = useTaskStore(s => s.updateTask);
  const overdue = isOverdue(task.dueDate, task.status);
  const dueToday = isDueToday(task.dueDate);
  const catColour = categoryColour[task.category];
  const isComplete = task.status === 'completed';
  const checklist = task.checklist ?? [];
  const checklistDone = checklist.filter(item => item.completed).length;

  const toggleChecklistItem = (itemId: string) => {
    updateTask(task.id, {
      checklist: checklist.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      ),
    });
  };

  useEffect(() => {
    if (!showMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showMenu]);

  return (
    <div
      className={cn(
        'bg-white border border-slate-100 rounded-xl shadow-card transition-all',
        isComplete && 'opacity-60',
        !isComplete && 'hover:shadow-card-hover',
        compact ? 'p-3' : 'p-4'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Completion toggle */}
        <button
          type="button"
          aria-label={isComplete ? `${task.title} is completed` : `Mark ${task.title} complete`}
          onClick={() => !isComplete && onComplete(task.id)}
          className={cn(
            'mt-0.5 flex-shrink-0 transition-colors',
            isComplete ? 'text-green-500' : 'text-slate-300 hover:text-brand-500'
          )}
        >
          {isComplete
            ? <CheckCircle2 className="w-5 h-5" />
            : <Circle className="w-5 h-5" />
          }
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn(
              'text-sm font-medium text-slate-800 leading-snug',
              isComplete && 'line-through text-slate-400'
            )}>
              {task.title}
            </p>

            {/* Menu */}
            <div ref={menuRef} className="relative flex-shrink-0">
              <button
                type="button"
                aria-label={`Open actions for ${task.title}`}
                aria-expanded={showMenu}
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-xl border border-slate-100 z-20 py-1 overflow-hidden">
                  {[
                    { icon: <Edit2 className="w-3.5 h-3.5" />, label: 'Edit', action: () => onEdit(task) },
                    { icon: <Copy className="w-3.5 h-3.5" />, label: 'Duplicate', action: () => onDuplicate(task.id) },
                    { icon: <Trash2 className="w-3.5 h-3.5" />, label: 'Delete', action: () => onDelete(task.id), danger: true },
                  ].map(item => (
                    <button
                      type="button"
                      key={item.label}
                      onClick={() => { item.action(); setShowMenu(false); }}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50',
                        item.danger ? 'text-red-600' : 'text-slate-600'
                      )}
                    >
                      {item.icon}{item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!compact && task.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p>
          )}

          {!compact && checklist.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {checklist.slice(0, 4).map(item => (
                <label key={item.id} className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => toggleChecklistItem(item.id)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className={cn(item.completed && 'line-through text-slate-400')}>{item.text}</span>
                </label>
              ))}
              {checklist.length > 4 && (
                <p className="text-xs text-slate-400 pl-6">+{checklist.length - 4} more</p>
              )}
            </div>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <PriorityBadge priority={task.priority} />

            <Badge className={`${catColour.bg} ${catColour.text}`}>
              {catColour.icon} {categoryLabel[task.category]}
            </Badge>

            {task.recurrence && (
              <Badge className="bg-purple-50 text-purple-700">
                <RefreshCw className="w-3 h-3" />
                {task.recurrence.interval}
              </Badge>
            )}

            {checklist.length > 0 && (
              <Badge className="bg-slate-50 text-slate-600">
                <ListChecks className="w-3 h-3" />
                {checklistDone}/{checklist.length}
              </Badge>
            )}

            {task.dueDate && (
              <span className={cn(
                'inline-flex items-center gap-1 text-xs',
                overdue ? 'text-red-600 font-medium' : dueToday ? 'text-amber-600 font-medium' : 'text-slate-500'
              )}>
                <Calendar className="w-3 h-3" />
                {formatRelative(task.dueDate)}
              </span>
            )}

            {task.assignedToName && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <User className="w-3 h-3" />
                {task.assignedToName}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
