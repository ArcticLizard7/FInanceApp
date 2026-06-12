// ============================================================
// Recurring Task/Payment Service
// Handles generating the next occurrence when one is completed.
// ============================================================

import { uuidv4 } from '@/utils/id';
import type { Task, PaymentRequest } from '@/types';
import { getNextOccurrence } from '@/utils/dateUtils';

export const recurringService = {
  // Call this when a recurring task is marked complete.
  // Returns the new task to be added, or null if no more occurrences.
  generateNextTask(completed: Task): Task | null {
    if (!completed.recurrence || !completed.dueDate) return null;

    const nextDate = getNextOccurrence(completed.dueDate, completed.recurrence);
    if (!nextDate) return null;

    const next: Task = {
      ...completed,
      id: uuidv4(),
      status: 'todo',
      dueDate: nextDate,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parentTaskId: completed.parentTaskId ?? completed.id,
      reminder: completed.reminder
        ? { ...completed.reminder, sent: false, sentAt: undefined }
        : null,
    };

    return next;
  },

  generateNextPaymentRequest(completed: PaymentRequest): PaymentRequest | null {
    if (!completed.recurrence) return null;

    const nextDate = getNextOccurrence(completed.dueDate, completed.recurrence);
    if (!nextDate) return null;

    return {
      ...completed,
      id: uuidv4(),
      approvalStatus: 'draft',
      paymentStatus: 'unpaid',
      approvedBy: null,
      approvedAt: null,
      paidAt: null,
      scheduledDate: null,
      dueDate: nextDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
};
