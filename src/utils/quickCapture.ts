import { addDays, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday, startOfDay } from 'date-fns';
import type { Priority, RecurrenceConfig, TaskCategory } from '@/types';

interface ParsedQuickCapture {
  title: string;
  category: TaskCategory;
  priority: Priority;
  dueDate: string | null;
  recurrence: RecurrenceConfig | null;
  notes: string;
}

const dayParsers: Record<string, (date: Date) => Date> = {
  monday: nextMonday,
  mon: nextMonday,
  tuesday: nextTuesday,
  tue: nextTuesday,
  wednesday: nextWednesday,
  wed: nextWednesday,
  thursday: nextThursday,
  thu: nextThursday,
  friday: nextFriday,
  fri: nextFriday,
  saturday: nextSaturday,
  sat: nextSaturday,
  sunday: nextSunday,
  sun: nextSunday,
};

const inferDate = (text: string): string | null => {
  const lower = text.toLowerCase();
  const today = startOfDay(new Date());

  if (/\btoday\b/.test(lower)) return today.toISOString();
  if (/\btomorrow\b/.test(lower)) return addDays(today, 1).toISOString();
  if (/\bnext week\b/.test(lower)) return addDays(today, 7).toISOString();
  if (/\bnext month\b/.test(lower)) return addDays(today, 30).toISOString();

  const weekday = Object.keys(dayParsers).find(day => new RegExp(`\\b${day}\\b`).test(lower));
  if (weekday) return dayParsers[weekday](today).toISOString();

  const inDays = lower.match(/\bin\s+(\d+)\s+days?\b/);
  if (inDays) return addDays(today, Number(inDays[1])).toISOString();

  return null;
};

const inferPriority = (text: string): Priority => {
  const lower = text.toLowerCase();
  if (/(urgent|critical|asap|!!)/.test(lower)) return 'critical';
  if (/(important|high priority|!)/.test(lower)) return 'high';
  if (/(low priority|someday|maybe)/.test(lower)) return 'low';
  return 'medium';
};

const inferCategory = (text: string): TaskCategory => {
  const lower = text.toLowerCase();
  if (/(pay|payment|supplier|remittance)/.test(lower)) return 'payment_requests';
  if (/(invoice|receipt)/.test(lower)) return 'invoices';
  if (/(approve|approval|sign off|sign-off)/.test(lower)) return 'approvals';
  if (/(report|board pack|forecast|budget)/.test(lower)) return 'reporting';
  if (/(vat|tax|hmrc)/.test(lower)) return 'vat_tax';
  if (/(payroll|salary|salaries|pension)/.test(lower)) return 'payroll';
  if (/(site|project|development|plot)/.test(lower)) return 'project_finance';
  if (/(personal|home|family)/.test(lower)) return 'personal';
  return 'general_admin';
};

const inferRecurrence = (text: string): RecurrenceConfig | null => {
  const lower = text.toLowerCase();
  if (/\bevery day\b|\bdaily\b/.test(lower)) return { interval: 'daily' };
  if (/\bevery week\b|\bweekly\b/.test(lower)) return { interval: 'weekly' };
  if (/\bfortnightly\b|\bevery 2 weeks\b/.test(lower)) return { interval: 'fortnightly' };
  if (/\bevery month\b|\bmonthly\b/.test(lower)) return { interval: 'monthly' };
  if (/\blast working day\b|\blast business day\b/.test(lower)) return { interval: 'last_working_day_month' };
  if (/\bquarterly\b|\bevery quarter\b/.test(lower)) return { interval: 'quarterly' };
  if (/\bannually\b|\byearly\b|\bevery year\b/.test(lower)) return { interval: 'annually' };
  return null;
};

const cleanTitle = (text: string): string =>
  text
    .replace(/\b(today|tomorrow|next week|next month)\b/gi, '')
    .replace(/\bin\s+\d+\s+days?\b/gi, '')
    .replace(/\b(every day|daily|every week|weekly|fortnightly|every 2 weeks|every month|monthly|quarterly|every quarter|annually|yearly|every year)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

export const parseQuickCapture = (raw: string): ParsedQuickCapture => {
  const text = raw.trim();
  return {
    title: cleanTitle(text) || text,
    category: inferCategory(text),
    priority: inferPriority(text),
    dueDate: inferDate(text),
    recurrence: inferRecurrence(text),
    notes: text,
  };
};
