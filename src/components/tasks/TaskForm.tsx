import { useState } from 'react';
import { Input, Textarea, Select } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import type { Task, Priority, TaskStatus, TaskCategory, RecurrenceInterval } from '@/types';
import { categoryLabel, priorityLabel, statusLabel, recurrenceLabel } from '@/utils/colorUtils';
import { useContactStore } from '@/stores/contactStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { emailService } from '@/services/emailService';
import { formatDate } from '@/utils/dateUtils';
import { uuidv4 } from '@/utils/id';
import { buildChecklistFromTemplate, taskTemplates } from '@/data/taskTemplates';

type TaskDraft = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'attachments' | 'tags' | 'tenantId'>;

interface TaskFormProps {
  initial?: Partial<Task>;
  onSave: (data: TaskDraft) => void;
  onCancel: () => void;
}

const CATEGORIES = Object.entries(categoryLabel).map(([value, label]) => ({ value, label }));
const PRIORITIES = Object.entries(priorityLabel).map(([value, label]) => ({ value, label }));
const STATUSES = Object.entries(statusLabel).map(([value, label]) => ({ value, label }));
const RECURRENCES = Object.entries(recurrenceLabel).map(([value, label]) => ({ value, label }));

export function TaskForm({ initial, onSave, onCancel }: TaskFormProps) {
  const { activeWorkspace } = useWorkspaceStore();
  const { getWorkspaceContacts } = useContactStore();
  const contacts = getWorkspaceContacts(activeWorkspace?.id ?? '');

  const [form, setForm] = useState<TaskDraft>({
    workspaceId: activeWorkspace?.id ?? '',
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    category: initial?.category ?? 'general_admin',
    status: initial?.status ?? 'todo',
    priority: initial?.priority ?? 'medium',
    dueDate: initial?.dueDate ?? null,
    assignedTo: initial?.assignedTo ?? null,
    assignedToName: initial?.assignedToName ?? null,
    assignedToEmail: initial?.assignedToEmail ?? null,
    delegatedBy: initial?.delegatedBy ?? null,
    notes: initial?.notes ?? '',
    checklist: initial?.checklist ?? [],
    recurrence: initial?.recurrence ?? null,
    reminder: initial?.reminder ?? null,
    parentTaskId: initial?.parentTaskId ?? null,
    linkedPaymentRequestId: initial?.linkedPaymentRequestId ?? null,
    completedAt: initial?.completedAt ?? null,
  });

  const [recurringEnabled, setRecurringEnabled] = useState(!!initial?.recurrence);
  const [checklistText, setChecklistText] = useState(
    initial?.checklist?.map(item => item.text).join('\n') ?? ''
  );
  const [sendEmail, setSendEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const applyTemplate = (templateId: string) => {
    const template = taskTemplates.find(t => t.id === templateId);
    if (!template) return;
    const checklist = buildChecklistFromTemplate(template.checklist);
    setForm(prev => ({
      ...prev,
      title: prev.title || template.title,
      category: template.category,
      priority: template.priority,
      recurrence: template.recurrence,
      checklist,
    }));
    setChecklistText(template.checklist.join('\n'));
    setRecurringEnabled(!!template.recurrence);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required.';
    if (sendEmail && !form.assignedToEmail) e.assignedToEmail = 'Email required for delegation.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const checklist = checklistText
      .split('\n')
      .map(text => text.trim())
      .filter(Boolean)
      .map((text, index) => ({
        id: form.checklist?.[index]?.id ?? `check_${uuidv4().slice(0, 8)}`,
        text,
        completed: form.checklist?.[index]?.completed ?? false,
      }));
    const data = { ...form, checklist, recurrence: recurringEnabled ? form.recurrence : null };
    onSave(data);

    if (sendEmail && form.assignedToEmail && form.assignedToName) {
      setSending(true);
      await emailService.sendDelegationEmail({
        taskTitle: form.title,
        taskDescription: form.description,
        dueDate: form.dueDate ? formatDate(form.dueDate) : 'Not set',
        priority: form.priority,
        notes: form.notes,
        delegatedBy: 'Finance Manager',
        recipientName: form.assignedToName,
        recipientEmail: form.assignedToEmail,
      });
      setSending(false);
    }
  };

  const handleContactChange = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    set('assignedTo', contact?.id ?? null);
    set('assignedToName', contact?.name ?? null);
    set('assignedToEmail', contact?.email ?? null);
  };

  return (
    <div className="space-y-4">
      <Select
        label="Template"
        value=""
        onChange={e => applyTemplate(e.target.value)}
        options={taskTemplates.map(template => ({ value: template.id, label: template.name }))}
        placeholder="— Start from optional template —"
      />

      <Input
        label="Title *"
        value={form.title}
        onChange={e => set('title', e.target.value)}
        error={errors.title}
        placeholder="e.g. Monthly payment run"
      />

      <Textarea
        label="Description"
        value={form.description}
        onChange={e => set('description', e.target.value)}
        placeholder="Add more detail…"
        rows={2}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Category"
          value={form.category}
          onChange={e => set('category', e.target.value as TaskCategory)}
          options={CATEGORIES}
        />
        <Select
          label="Priority"
          value={form.priority}
          onChange={e => set('priority', e.target.value as Priority)}
          options={PRIORITIES}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Status"
          value={form.status}
          onChange={e => set('status', e.target.value as TaskStatus)}
          options={STATUSES}
        />
        <Input
          label="Due Date"
          type="date"
          value={form.dueDate ? form.dueDate.slice(0, 10) : ''}
          onChange={e => set('dueDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
        />
      </div>

      {/* Delegation */}
      <div className="space-y-2">
        <Select
          label="Assign / Delegate To"
          value={form.assignedTo ?? ''}
          onChange={e => handleContactChange(e.target.value)}
          options={contacts.map(c => ({ value: c.id, label: `${c.name} (${c.role})` }))}
          placeholder="— Select contact —"
        />
        {form.assignedTo && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={e => setSendEmail(e.target.checked)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-600">Send delegation email to {form.assignedToName}</span>
          </label>
        )}
      </div>

      <Textarea
        label="Notes"
        value={form.notes}
        onChange={e => set('notes', e.target.value)}
        placeholder="Internal notes…"
        rows={2}
      />

      <Textarea
        label="Checklist"
        value={checklistText}
        onChange={e => setChecklistText(e.target.value)}
        placeholder="One optional step per line"
        rows={3}
      />

      {/* Recurrence */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={recurringEnabled}
            onChange={e => setRecurringEnabled(e.target.checked)}
            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm font-medium text-slate-700">Recurring task</span>
        </label>
        {recurringEnabled && (
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={form.recurrence?.interval ?? 'monthly'}
              onChange={e => {
                const interval = e.target.value as RecurrenceInterval;
                set('recurrence', { interval, customDays: interval === 'custom' ? 7 : undefined });
              }}
              options={RECURRENCES}
            />
            {form.recurrence?.interval === 'custom' && (
              <Input
                type="number"
                min="1"
                value={form.recurrence.customDays ?? 7}
                onChange={e => set('recurrence', { interval: 'custom', customDays: Math.max(1, Number(e.target.value) || 1) })}
                hint="Every N days"
              />
            )}
          </div>
        )}
      </div>

      {/* Reminder */}
      <Select
        label="Reminder"
        value={form.reminder?.type ?? ''}
        onChange={e => set('reminder', e.target.value ? { type: e.target.value as 'same_day', sent: false } : null)}
        options={[
          { value: 'same_day', label: 'Same day' },
          { value: '1_day',    label: '1 day before' },
          { value: '3_days',   label: '3 days before' },
          { value: '1_week',   label: '1 week before' },
        ]}
        placeholder="— No reminder —"
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} loading={sending}>
          {initial?.title ? 'Save Changes' : 'Add Task'}
        </Button>
      </div>
    </div>
  );
}
