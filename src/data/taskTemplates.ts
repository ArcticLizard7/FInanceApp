import type { ChecklistItem, Priority, RecurrenceConfig, TaskCategory } from '@/types';
import { uuidv4 } from '@/utils/id';

export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  category: TaskCategory;
  priority: Priority;
  recurrence: RecurrenceConfig | null;
  checklist: string[];
}

export const taskTemplates: TaskTemplate[] = [
  {
    id: 'payment-run',
    name: 'Monthly payment run',
    title: 'Monthly payment run',
    category: 'payment_requests',
    priority: 'high',
    recurrence: { interval: 'monthly' },
    checklist: ['Review supplier list', 'Check invoices and POs', 'Confirm approvals', 'Schedule payments', 'Send remittance notes'],
  },
  {
    id: 'vat-prep',
    name: 'VAT prep',
    title: 'Prepare VAT return',
    category: 'vat_tax',
    priority: 'high',
    recurrence: { interval: 'quarterly' },
    checklist: ['Export transactions', 'Review input VAT', 'Review output VAT', 'Check exceptions', 'Submit return'],
  },
  {
    id: 'board-report',
    name: 'Board report',
    title: 'Prepare board report',
    category: 'reporting',
    priority: 'high',
    recurrence: { interval: 'monthly' },
    checklist: ['Update cashflow', 'Update project notes', 'Summarise risks', 'Check charts', 'Send draft'],
  },
  {
    id: 'weekly-review',
    name: 'Weekly review',
    title: 'Weekly review',
    category: 'general_admin',
    priority: 'medium',
    recurrence: { interval: 'weekly' },
    checklist: ['Clear overdue tasks', 'Review waiting items', 'Pick next priorities', 'Archive stale tasks'],
  },
  {
    id: 'inbox-clear',
    name: 'Inbox clear-down',
    title: 'Inbox clear-down',
    category: 'general_admin',
    priority: 'medium',
    recurrence: null,
    checklist: ['Reply to quick messages', 'Turn follow-ups into tasks', 'File reference emails', 'Defer non-urgent items'],
  },
];

export const buildChecklistFromTemplate = (items: string[]): ChecklistItem[] =>
  items.map(text => ({
    id: `check_${uuidv4().slice(0, 8)}`,
    text,
    completed: false,
  }));
