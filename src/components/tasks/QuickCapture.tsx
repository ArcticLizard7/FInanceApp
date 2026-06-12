import { useState } from 'react';
import { Sparkles, Plus } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { parseQuickCapture } from '@/utils/quickCapture';
import type { Task } from '@/types';

interface QuickCaptureProps {
  workspaceId: string;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'tenantId' | 'attachments' | 'tags' | 'checklist'>) => void;
}

export function QuickCapture({ workspaceId, onAddTask }: QuickCaptureProps) {
  const [value, setValue] = useState('');

  const save = () => {
    const parsed = parseQuickCapture(value);
    if (!parsed.title.trim() || !workspaceId) return;

    onAddTask({
      workspaceId,
      title: parsed.title,
      description: '',
      category: parsed.category,
      status: 'todo',
      priority: parsed.priority,
      dueDate: parsed.dueDate,
      assignedTo: null,
      assignedToName: null,
      assignedToEmail: null,
      delegatedBy: null,
      notes: parsed.notes,
      recurrence: parsed.recurrence,
      reminder: parsed.dueDate ? { type: '1_day', sent: false } : null,
      parentTaskId: null,
      linkedPaymentRequestId: null,
      completedAt: null,
    });
    setValue('');
  };

  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-card p-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-brand-500 flex-shrink-0" />
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') save();
          }}
          placeholder="Capture a task, reminder, payment, or follow-up..."
          className="flex-1 min-w-0 text-sm border-none focus:outline-none focus:ring-0 placeholder:text-slate-400"
        />
        <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={save} disabled={!value.trim() || !workspaceId}>
          Add
        </Button>
      </div>
    </div>
  );
}
