import {
  format,
  formatDistance,
  isToday,
  isTomorrow,
  isPast,
  isThisWeek,
  addDays,
  addWeeks,
  addMonths,
  addQuarters,
  addYears,
  startOfWeek,
  endOfWeek,
  endOfMonth,
  startOfDay,
  subDays,
  isWeekend,
  parseISO,
  differenceInDays,
  isBefore,
  isAfter,
  isValid,
} from 'date-fns';
import type { RecurrenceConfig } from '@/types';

export const formatDate = (date: string | Date | null, fmt = 'dd MMM yyyy'): string => {
  if (!date) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '—';
  return format(d, fmt);
};

export const formatDateShort = (date: string | Date | null): string =>
  formatDate(date, 'dd/MM/yy');

export const formatDateTime = (date: string | Date | null): string =>
  formatDate(date, 'dd MMM yyyy HH:mm');

export const formatCurrency = (amount: number, currency = 'GBP'): string =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);

export const formatRelative = (date: string | Date | null): string => {
  if (!date) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '—';
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  if (isPast(d)) return `${differenceInDays(new Date(), d)}d overdue`;
  return formatDistance(d, new Date(), { addSuffix: true });
};

export const isOverdue = (date: string | null, status?: string): boolean => {
  if (!date || status === 'completed' || status === 'cancelled') return false;
  const d = parseISO(date);
  return isValid(d) && isPast(startOfDay(d)) && !isToday(d);
};

export const isDueToday = (date: string | null): boolean => {
  if (!date) return false;
  const d = parseISO(date);
  return isValid(d) && isToday(d);
};

export const isDueSoon = (date: string | null, days = 7): boolean => {
  if (!date) return false;
  const d = parseISO(date);
  if (!isValid(d)) return false;
  const cutoff = addDays(new Date(), days);
  return isAfter(d, new Date()) && isBefore(d, cutoff);
};

export const getWeekRange = (date: Date = new Date()): { start: Date; end: Date } => ({
  start: startOfWeek(date, { weekStartsOn: 1 }),
  end: endOfWeek(date, { weekStartsOn: 1 }),
});

const getLastWorkingDayOfNextMonth = (from: Date): Date => {
  let day = endOfMonth(addMonths(from, 1));
  while (isWeekend(day)) {
    day = subDays(day, 1);
  }
  return day;
};

// Compute the next occurrence date for a recurring task
export const getNextOccurrence = (
  fromDate: string,
  config: RecurrenceConfig
): string | null => {
  const base = parseISO(fromDate);
  if (!isValid(base)) return null;

  let next: Date;
  switch (config.interval) {
    case 'daily':        next = addDays(base, 1); break;
    case 'weekly':       next = addWeeks(base, 1); break;
    case 'fortnightly':  next = addWeeks(base, 2); break;
    case 'monthly':      next = addMonths(base, 1); break;
    case 'last_working_day_month': next = getLastWorkingDayOfNextMonth(base); break;
    case 'quarterly':    next = addQuarters(base, 1); break;
    case 'annually':     next = addYears(base, 1); break;
    case 'custom':       next = addDays(base, config.customDays ?? 1); break;
    default:             return null;
  }

  if (config.endDate && isAfter(next, parseISO(config.endDate))) return null;
  return next.toISOString();
};

export const toISODateString = (date: Date): string =>
  format(date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");

export { isToday, isTomorrow, isPast, isThisWeek, addDays, parseISO, format };
