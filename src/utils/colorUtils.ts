import type { Priority, TaskStatus, PaymentApprovalStatus, PaymentStatus, TaskCategory } from '@/types';

export const priorityColour: Record<Priority, { bg: string; text: string; border: string; dot: string }> = {
  low:      { bg: 'bg-slate-100',   text: 'text-slate-600',  border: 'border-slate-200', dot: 'bg-slate-400' },
  medium:   { bg: 'bg-amber-50',    text: 'text-amber-700',  border: 'border-amber-200', dot: 'bg-amber-400' },
  high:     { bg: 'bg-orange-50',   text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  critical: { bg: 'bg-red-50',      text: 'text-red-700',    border: 'border-red-200',   dot: 'bg-red-500' },
};

export const statusColour: Record<TaskStatus, { bg: string; text: string }> = {
  todo:        { bg: 'bg-slate-100',  text: 'text-slate-600' },
  in_progress: { bg: 'bg-blue-50',    text: 'text-blue-700' },
  waiting:     { bg: 'bg-amber-50',   text: 'text-amber-700' },
  completed:   { bg: 'bg-green-50',   text: 'text-green-700' },
  cancelled:   { bg: 'bg-slate-100',  text: 'text-slate-400' },
};

export const approvalStatusColour: Record<PaymentApprovalStatus, { bg: string; text: string }> = {
  draft:             { bg: 'bg-slate-100',  text: 'text-slate-600' },
  awaiting_approval: { bg: 'bg-amber-50',   text: 'text-amber-700' },
  approved:          { bg: 'bg-green-50',   text: 'text-green-700' },
  on_hold:           { bg: 'bg-orange-50',  text: 'text-orange-700' },
  rejected:          { bg: 'bg-red-50',     text: 'text-red-700' },
};

export const paymentStatusColour: Record<PaymentStatus, { bg: string; text: string }> = {
  unpaid:    { bg: 'bg-slate-100',  text: 'text-slate-600' },
  scheduled: { bg: 'bg-purple-50',  text: 'text-purple-700' },
  paid:      { bg: 'bg-green-50',   text: 'text-green-700' },
};

export const categoryColour: Record<TaskCategory, { bg: string; text: string; icon: string }> = {
  payment_requests: { bg: 'bg-blue-50',    text: 'text-blue-700',    icon: '💳' },
  invoices:         { bg: 'bg-indigo-50',  text: 'text-indigo-700',  icon: '🧾' },
  approvals:        { bg: 'bg-amber-50',   text: 'text-amber-700',   icon: '✅' },
  reporting:        { bg: 'bg-violet-50',  text: 'text-violet-700',  icon: '📊' },
  vat_tax:          { bg: 'bg-red-50',     text: 'text-red-700',     icon: '🏛️' },
  payroll:          { bg: 'bg-green-50',   text: 'text-green-700',   icon: '👥' },
  project_finance:  { bg: 'bg-cyan-50',    text: 'text-cyan-700',    icon: '🏗️' },
  general_admin:    { bg: 'bg-slate-50',   text: 'text-slate-700',   icon: '📁' },
  personal:         { bg: 'bg-pink-50',    text: 'text-pink-700',    icon: '🌿' },
};

export const categoryLabel: Record<TaskCategory, string> = {
  payment_requests: 'Payment Requests',
  invoices:         'Invoices',
  approvals:        'Approvals',
  reporting:        'Reporting',
  vat_tax:          'VAT / Tax',
  payroll:          'Payroll / Salaries',
  project_finance:  'Project Finance',
  general_admin:    'General Admin',
  personal:         'Personal',
};

export const priorityLabel: Record<Priority, string> = {
  low:      'Low',
  medium:   'Medium',
  high:     'High',
  critical: 'Critical',
};

export const statusLabel: Record<TaskStatus, string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
  waiting:     'Waiting',
  completed:   'Completed',
  cancelled:   'Cancelled',
};

export const approvalStatusLabel: Record<PaymentApprovalStatus, string> = {
  draft:             'Draft',
  awaiting_approval: 'Awaiting Approval',
  approved:          'Approved',
  on_hold:           'On Hold',
  rejected:          'Rejected',
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  unpaid:    'Unpaid',
  scheduled: 'Scheduled',
  paid:      'Paid',
};

export const recurrenceLabel: Record<string, string> = {
  daily:        'Daily',
  weekly:       'Weekly',
  fortnightly:  'Fortnightly',
  monthly:      'Monthly',
  last_working_day_month: 'Last working day of month',
  quarterly:    'Quarterly',
  annually:     'Annually',
  custom:       'Custom',
};
