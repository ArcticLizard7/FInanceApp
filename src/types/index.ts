// ============================================================
// Core Type Definitions for FinanceFlow
// All records include workspaceId for multi-company isolation.
// When migrating to a backend, replace localStorage calls in
// services/storageService.ts with API calls — types stay the same.
// ============================================================

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'todo' | 'in_progress' | 'waiting' | 'completed' | 'cancelled';
export type RecurrenceInterval = 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'last_working_day_month' | 'quarterly' | 'annually' | 'custom';

export type TaskCategory =
  | 'payment_requests'
  | 'invoices'
  | 'approvals'
  | 'reporting'
  | 'vat_tax'
  | 'payroll'
  | 'project_finance'
  | 'general_admin'
  | 'personal';

export interface RecurrenceConfig {
  interval: RecurrenceInterval;
  customDays?: number; // used when interval === 'custom'
  endDate?: string;    // ISO date — stop generating after this date
  maxOccurrences?: number;
}

export interface ReminderConfig {
  type: 'same_day' | '1_day' | '3_days' | '1_week' | 'custom';
  customDays?: number;
  sent: boolean;
  sentAt?: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string; // object URL or future CDN URL
  uploadedAt: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Task {
  id: string;
  tenantId: string;
  workspaceId: string;
  title: string;
  description: string;
  category: TaskCategory;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;       // ISO date string
  assignedTo: string | null;    // Contact id
  assignedToName: string | null;
  assignedToEmail: string | null;
  delegatedBy: string | null;
  notes: string;
  attachments: Attachment[];
  checklist?: ChecklistItem[];
  recurrence: RecurrenceConfig | null;
  reminder: ReminderConfig | null;
  parentTaskId: string | null;  // for recurring child tasks
  linkedPaymentRequestId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

// ============================================================
// Payment Requests
// ============================================================

export type PaymentApprovalStatus = 'draft' | 'awaiting_approval' | 'approved' | 'on_hold' | 'rejected';
export type PaymentStatus = 'unpaid' | 'scheduled' | 'paid';
export type VatCode = 'S' | 'R' | 'Z' | 'M';

export interface VatBreakdownLine {
  netAmount: number;
  rate: number;
  vatAmount: number;
}

export interface PaymentRequest {
  id: string;
  tenantId: string;
  workspaceId: string;
  supplier: string;
  project: string;       // project/site name
  description: string;
  amount: number;        // GBP
  vatAmount: number;
  totalAmount: number;   // amount + vatAmount
  currency: string;      // default 'GBP'
  vatCode: VatCode;
  vatBreakdown: VatBreakdownLine[];
  dueDate: string;
  requestedBy: string;
  approvalStatus: PaymentApprovalStatus;
  paymentStatus: PaymentStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  scheduledDate: string | null;
  notes: string;
  linkedTaskId: string | null;
  recurrence: RecurrenceConfig | null;
  invoiceReference: string;
  purchaseOrderNumber: string;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Workspaces (companies / personal)
// ============================================================

export type WorkspaceType = 'company' | 'personal';

export interface Workspace {
  id: string;
  tenantId: string;
  name: string;
  type: WorkspaceType;
  colour: string;       // hex — used for sidebar accent
  currency: string;
  isDefault: boolean;
  isArchived: boolean;
  hideFinanceFeatures: boolean; // for personal workspace
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Contacts (for delegation)
// ============================================================

export interface Contact {
  id: string;
  tenantId: string;
  workspaceId: string;
  name: string;
  email: string;
  role: string;
  company: string;
  phone: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Notifications
// ============================================================

export type NotificationType =
  | 'deadline_approaching'
  | 'overdue'
  | 'reminder'
  | 'approval_required'
  | 'delegation_received'
  | 'payment_due'
  | 'system';

export interface Notification {
  id: string;
  tenantId: string;
  workspaceId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId: string | null;    // task or payment request id
  relatedType: 'task' | 'payment' | null;
  isRead: boolean;
  isDismissed: boolean;
  snoozedUntil: string | null;
  createdAt: string;
}

// ============================================================
// Excel Import
// ============================================================

export interface ExcelImportRow {
  [key: string]: string | number | boolean | Date | null;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
}

export interface ImportSession {
  id: string;
  tenantId: string;
  workspaceId: string;
  fileName: string;
  rows: ExcelImportRow[];
  columnMappings: ColumnMapping[];
  importType: 'tasks' | 'payments' | 'both';
  status: 'pending' | 'mapped' | 'validated' | 'imported' | 'error';
  errors: string[];
  importedCount: number;
  createdAt: string;
}

// ============================================================
// User Preferences
// ============================================================

export interface UserPreferences {
  activeWorkspaceId: string;
  theme: 'light'; // dark mode can be added later
  defaultTaskCategory: TaskCategory;
  defaultPriority: Priority;
  weekStartsOn: 0 | 1; // 0=Sunday, 1=Monday
  dateFormat: string;
  currency: string;
  sidebarCollapsed: boolean;
  notificationsEnabled: boolean;
}

// ============================================================
// Cashflow
// ============================================================

export interface CashflowWeek {
  weekStart: string;  // ISO date of Monday
  weekEnd: string;
  scheduled: number;
  approved: number;
  paid: number;
  overdue: number;
  items: PaymentRequest[];
}

// ============================================================
// Reports
// ============================================================

export interface ReportPeriod {
  label: string;
  startDate: string;
  endDate: string;
}

export interface TaskCompletionData {
  date: string;
  completed: number;
  created: number;
}

export interface PaymentTrendData {
  month: string;
  total: number;
  paid: number;
  pending: number;
}
