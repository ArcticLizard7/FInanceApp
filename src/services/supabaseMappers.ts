import type {
  BudgetCategory,
  BudgetProfile,
  BudgetTransaction,
  Contact,
  DebtAccount,
  DebtBalanceSnapshot,
  DebtGroup,
  DebtRepayment,
  MonthlyBudget,
  MonthlyBudgetIncome,
  Notification,
  PaymentRequest,
  Task,
  UserPreferences,
  Workspace,
} from '@/types';
import type { Tenant } from '@/types/tenant';
import type { User } from '@/types/auth';

const jsonArray = <T>(value: unknown, fallback: T[] = []): T[] =>
  Array.isArray(value) ? value as T[] : fallback;

export const profileFromRow = (row: any): User => ({
  id: row.id,
  username: row.username ?? row.email,
  displayName: row.display_name ?? row.email,
  email: row.email,
  passwordHash: '',
  salt: '',
  role: row.role,
  tenantId: row.tenant_id,
  workspaceAccess: row.workspace_access ?? [],
  isActive: row.is_active ?? true,
  mfaEnabled: row.mfa_enabled ?? false,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastLoginAt: row.last_login_at ?? null,
  createdBy: row.created_by,
});

export const tenantFromRow = (row: any): Tenant => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  colour: row.colour,
  plan: row.plan,
  status: row.status,
  settings: row.settings ?? {},
  contactName: row.contact_name ?? '',
  contactEmail: row.contact_email ?? '',
  notes: row.notes ?? '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by ?? '',
});

export const tenantToInsert = (tenant: Omit<Tenant, 'createdAt' | 'updatedAt'>) => ({
  id: tenant.id,
  name: tenant.name,
  slug: tenant.slug,
  colour: tenant.colour,
  plan: tenant.plan,
  status: tenant.status,
  settings: tenant.settings,
  contact_name: tenant.contactName,
  contact_email: tenant.contactEmail,
  notes: tenant.notes,
  created_by: tenant.createdBy || null,
});

export const workspaceFromRow = (row: any): Workspace => ({
  id: row.id,
  tenantId: row.tenant_id,
  name: row.name,
  type: row.type,
  colour: row.colour,
  currency: row.currency ?? 'GBP',
  isDefault: row.is_default,
  isArchived: row.is_archived,
  hideFinanceFeatures: row.hide_finance_features,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const workspaceToInsert = (workspace: Omit<Workspace, 'createdAt' | 'updatedAt'>) => ({
  id: workspace.id,
  tenant_id: workspace.tenantId,
  name: workspace.name,
  type: workspace.type,
  colour: workspace.colour,
  currency: workspace.currency,
  is_default: workspace.isDefault,
  is_archived: workspace.isArchived,
  hide_finance_features: workspace.hideFinanceFeatures,
});

export const preferencesFromRow = (row: any, fallback: UserPreferences): UserPreferences => ({
  ...fallback,
  ...(row?.preferences ?? {}),
  activeWorkspaceId: row?.active_workspace_id ?? row?.preferences?.activeWorkspaceId ?? fallback.activeWorkspaceId,
});

export const taskFromRow = (row: any): Task => ({
  id: row.id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  title: row.title,
  description: row.description ?? '',
  category: row.category,
  status: row.status,
  priority: row.priority,
  dueDate: row.due_date,
  assignedTo: row.assigned_to,
  assignedToName: row.assigned_to_name,
  assignedToEmail: row.assigned_to_email,
  delegatedBy: row.delegated_by,
  notes: row.notes ?? '',
  attachments: jsonArray(row.attachments),
  checklist: jsonArray(row.checklist),
  recurrence: row.recurrence,
  reminder: row.reminder,
  parentTaskId: row.parent_task_id,
  linkedPaymentRequestId: row.linked_payment_request_id,
  tags: row.tags ?? [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at,
});

export const taskToInsert = (task: Omit<Task, 'createdAt' | 'updatedAt'>) => ({
  id: task.id,
  tenant_id: task.tenantId,
  workspace_id: task.workspaceId,
  title: task.title,
  description: task.description,
  category: task.category,
  status: task.status,
  priority: task.priority,
  due_date: task.dueDate,
  assigned_to: task.assignedTo,
  assigned_to_name: task.assignedToName,
  assigned_to_email: task.assignedToEmail,
  delegated_by: null,
  notes: task.notes,
  attachments: task.attachments ?? [],
  checklist: task.checklist ?? [],
  recurrence: task.recurrence,
  reminder: task.reminder,
  parent_task_id: task.parentTaskId,
  linked_payment_request_id: task.linkedPaymentRequestId,
  tags: task.tags ?? [],
  completed_at: task.completedAt,
});

export const taskUpdatesToRow = (updates: Partial<Task>) => ({
  ...(updates.workspaceId !== undefined && { workspace_id: updates.workspaceId }),
  ...(updates.title !== undefined && { title: updates.title }),
  ...(updates.description !== undefined && { description: updates.description }),
  ...(updates.category !== undefined && { category: updates.category }),
  ...(updates.status !== undefined && { status: updates.status }),
  ...(updates.priority !== undefined && { priority: updates.priority }),
  ...(updates.dueDate !== undefined && { due_date: updates.dueDate }),
  ...(updates.assignedTo !== undefined && { assigned_to: updates.assignedTo }),
  ...(updates.assignedToName !== undefined && { assigned_to_name: updates.assignedToName }),
  ...(updates.assignedToEmail !== undefined && { assigned_to_email: updates.assignedToEmail }),
  ...(updates.notes !== undefined && { notes: updates.notes }),
  ...(updates.attachments !== undefined && { attachments: updates.attachments }),
  ...(updates.checklist !== undefined && { checklist: updates.checklist }),
  ...(updates.recurrence !== undefined && { recurrence: updates.recurrence }),
  ...(updates.reminder !== undefined && { reminder: updates.reminder }),
  ...(updates.parentTaskId !== undefined && { parent_task_id: updates.parentTaskId }),
  ...(updates.linkedPaymentRequestId !== undefined && { linked_payment_request_id: updates.linkedPaymentRequestId }),
  ...(updates.tags !== undefined && { tags: updates.tags }),
  ...(updates.completedAt !== undefined && { completed_at: updates.completedAt }),
  updated_at: new Date().toISOString(),
});

export const paymentFromRow = (row: any): PaymentRequest => ({
  id: row.id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  supplier: row.supplier,
  project: row.project ?? '',
  description: row.description ?? '',
  amount: Number(row.amount ?? 0),
  vatAmount: Number(row.vat_amount ?? 0),
  totalAmount: Number(row.total_amount ?? 0),
  currency: row.currency ?? 'GBP',
  vatCode: row.vat_code ?? 'S',
  vatBreakdown: jsonArray(row.vat_breakdown),
  dueDate: row.due_date,
  requestedBy: row.requested_by ?? '',
  approvalStatus: row.approval_status,
  paymentStatus: row.payment_status,
  approvedBy: row.approved_by,
  approvedAt: row.approved_at,
  paidAt: row.paid_at,
  scheduledDate: row.scheduled_date,
  notes: row.notes ?? '',
  linkedTaskId: row.linked_task_id,
  recurrence: row.recurrence,
  invoiceReference: row.invoice_reference ?? '',
  purchaseOrderNumber: row.purchase_order_number ?? '',
  attachments: jsonArray(row.attachments),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const paymentToInsert = (payment: Omit<PaymentRequest, 'createdAt' | 'updatedAt'>) => ({
  id: payment.id,
  tenant_id: payment.tenantId,
  workspace_id: payment.workspaceId,
  supplier: payment.supplier,
  project: payment.project,
  description: payment.description,
  amount: payment.amount,
  vat_amount: payment.vatAmount,
  total_amount: payment.totalAmount,
  currency: payment.currency,
  vat_code: payment.vatCode,
  vat_breakdown: payment.vatBreakdown ?? [],
  due_date: payment.dueDate,
  requested_by: payment.requestedBy,
  approval_status: payment.approvalStatus,
  payment_status: payment.paymentStatus,
  approved_by: payment.approvedBy,
  approved_at: payment.approvedAt,
  paid_at: payment.paidAt,
  scheduled_date: payment.scheduledDate,
  notes: payment.notes,
  linked_task_id: payment.linkedTaskId,
  recurrence: payment.recurrence,
  invoice_reference: payment.invoiceReference,
  purchase_order_number: payment.purchaseOrderNumber,
  attachments: payment.attachments ?? [],
});

export const paymentUpdatesToRow = (updates: Partial<PaymentRequest>) => ({
  ...(updates.workspaceId !== undefined && { workspace_id: updates.workspaceId }),
  ...(updates.supplier !== undefined && { supplier: updates.supplier }),
  ...(updates.project !== undefined && { project: updates.project }),
  ...(updates.description !== undefined && { description: updates.description }),
  ...(updates.amount !== undefined && { amount: updates.amount }),
  ...(updates.vatAmount !== undefined && { vat_amount: updates.vatAmount }),
  ...(updates.totalAmount !== undefined && { total_amount: updates.totalAmount }),
  ...(updates.currency !== undefined && { currency: updates.currency }),
  ...(updates.vatCode !== undefined && { vat_code: updates.vatCode }),
  ...(updates.vatBreakdown !== undefined && { vat_breakdown: updates.vatBreakdown }),
  ...(updates.dueDate !== undefined && { due_date: updates.dueDate }),
  ...(updates.requestedBy !== undefined && { requested_by: updates.requestedBy }),
  ...(updates.approvalStatus !== undefined && { approval_status: updates.approvalStatus }),
  ...(updates.paymentStatus !== undefined && { payment_status: updates.paymentStatus }),
  ...(updates.approvedBy !== undefined && { approved_by: updates.approvedBy }),
  ...(updates.approvedAt !== undefined && { approved_at: updates.approvedAt }),
  ...(updates.paidAt !== undefined && { paid_at: updates.paidAt }),
  ...(updates.scheduledDate !== undefined && { scheduled_date: updates.scheduledDate }),
  ...(updates.notes !== undefined && { notes: updates.notes }),
  ...(updates.linkedTaskId !== undefined && { linked_task_id: updates.linkedTaskId }),
  ...(updates.recurrence !== undefined && { recurrence: updates.recurrence }),
  ...(updates.invoiceReference !== undefined && { invoice_reference: updates.invoiceReference }),
  ...(updates.purchaseOrderNumber !== undefined && { purchase_order_number: updates.purchaseOrderNumber }),
  ...(updates.attachments !== undefined && { attachments: updates.attachments }),
  updated_at: new Date().toISOString(),
});

export const contactFromRow = (row: any): Contact => ({
  id: row.id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  name: row.name,
  email: row.email ?? '',
  role: row.role ?? '',
  company: row.company ?? '',
  phone: row.phone ?? '',
  notes: row.notes ?? '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const contactToInsert = (contact: Omit<Contact, 'createdAt' | 'updatedAt'>) => ({
  id: contact.id,
  tenant_id: contact.tenantId,
  workspace_id: contact.workspaceId,
  name: contact.name,
  email: contact.email,
  role: contact.role,
  company: contact.company,
  phone: contact.phone,
  notes: contact.notes,
});

export const notificationFromRow = (row: any): Notification => ({
  id: row.id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  type: row.type,
  title: row.title,
  message: row.message,
  relatedId: row.related_id,
  relatedType: row.related_type,
  isRead: row.is_read,
  isDismissed: row.is_dismissed,
  snoozedUntil: row.snoozed_until,
  createdAt: row.created_at,
});

export const notificationToInsert = (notification: Omit<Notification, 'createdAt'>) => ({
  id: notification.id,
  tenant_id: notification.tenantId,
  workspace_id: notification.workspaceId,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  related_id: notification.relatedId,
  related_type: notification.relatedType,
  is_read: notification.isRead,
  is_dismissed: notification.isDismissed,
  snoozed_until: notification.snoozedUntil,
});

export const budgetProfileFromRow = (row: any): BudgetProfile => ({
  id: row.id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  name: row.name,
  colour: row.colour,
  isDefault: row.is_default,
  includeInConsolidated: row.include_in_consolidated,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const budgetProfileToInsert = (profile: BudgetProfile) => ({
  id: profile.id,
  tenant_id: profile.tenantId,
  workspace_id: profile.workspaceId,
  name: profile.name,
  colour: profile.colour,
  is_default: profile.isDefault,
  include_in_consolidated: profile.includeInConsolidated,
  created_at: profile.createdAt,
  updated_at: profile.updatedAt,
});

export const budgetProfileUpdatesToRow = (updates: Partial<BudgetProfile>) => ({
  ...(updates.name !== undefined && { name: updates.name }),
  ...(updates.colour !== undefined && { colour: updates.colour }),
  ...(updates.includeInConsolidated !== undefined && { include_in_consolidated: updates.includeInConsolidated }),
  updated_at: new Date().toISOString(),
});

export const budgetCategoryFromRow = (row: any): BudgetCategory => ({
  id: row.id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  budgetId: row.budget_id,
  name: row.name,
  colour: row.colour,
  keywords: row.keywords ?? [],
  isDefault: row.is_default,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const budgetCategoryToInsert = (category: BudgetCategory) => ({
  id: category.id,
  tenant_id: category.tenantId,
  workspace_id: category.workspaceId,
  budget_id: category.budgetId,
  name: category.name,
  colour: category.colour,
  keywords: category.keywords ?? [],
  is_default: category.isDefault,
  created_at: category.createdAt,
  updated_at: category.updatedAt,
});

export const budgetCategoryUpdatesToRow = (updates: Partial<BudgetCategory>) => ({
  ...(updates.name !== undefined && { name: updates.name }),
  ...(updates.colour !== undefined && { colour: updates.colour }),
  ...(updates.keywords !== undefined && { keywords: updates.keywords }),
  updated_at: new Date().toISOString(),
});

export const monthlyBudgetFromRow = (row: any): MonthlyBudget => ({
  id: row.id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  budgetId: row.budget_id,
  month: row.month,
  categoryId: row.category_id,
  amount: Number(row.amount ?? 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const monthlyBudgetToInsert = (budget: MonthlyBudget) => ({
  id: budget.id,
  tenant_id: budget.tenantId,
  workspace_id: budget.workspaceId,
  budget_id: budget.budgetId,
  month: budget.month,
  category_id: budget.categoryId,
  amount: budget.amount,
  created_at: budget.createdAt,
  updated_at: budget.updatedAt,
});

export const monthlyBudgetIncomeFromRow = (row: any): MonthlyBudgetIncome => ({
  id: row.id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  budgetId: row.budget_id,
  month: row.month,
  amount: Number(row.amount ?? 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const monthlyBudgetIncomeToInsert = (income: MonthlyBudgetIncome) => ({
  id: income.id,
  tenant_id: income.tenantId,
  workspace_id: income.workspaceId,
  budget_id: income.budgetId,
  month: income.month,
  amount: income.amount,
  created_at: income.createdAt,
  updated_at: income.updatedAt,
});

export const budgetTransactionFromRow = (row: any): BudgetTransaction => ({
  id: row.id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  budgetId: row.budget_id,
  date: row.date,
  description: row.description,
  amount: Number(row.amount ?? 0),
  direction: row.direction,
  categoryId: row.category_id,
  debtAllocation: row.debt_allocation,
  source: row.source,
  importBatchId: row.import_batch_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const budgetTransactionToInsert = (transaction: BudgetTransaction) => ({
  id: transaction.id,
  tenant_id: transaction.tenantId,
  workspace_id: transaction.workspaceId,
  budget_id: transaction.budgetId,
  date: transaction.date,
  description: transaction.description,
  amount: transaction.amount,
  direction: transaction.direction,
  category_id: transaction.categoryId,
  debt_allocation: transaction.debtAllocation,
  source: transaction.source,
  import_batch_id: transaction.importBatchId,
  created_at: transaction.createdAt,
  updated_at: transaction.updatedAt,
});

export const budgetTransactionUpdatesToRow = (updates: Partial<BudgetTransaction>) => ({
  ...(updates.date !== undefined && { date: updates.date }),
  ...(updates.description !== undefined && { description: updates.description }),
  ...(updates.amount !== undefined && { amount: updates.amount }),
  ...(updates.direction !== undefined && { direction: updates.direction }),
  ...(updates.categoryId !== undefined && { category_id: updates.categoryId }),
  ...(updates.debtAllocation !== undefined && { debt_allocation: updates.debtAllocation }),
  ...(updates.source !== undefined && { source: updates.source }),
  ...(updates.importBatchId !== undefined && { import_batch_id: updates.importBatchId }),
  updated_at: new Date().toISOString(),
});

export const debtGroupFromRow = (row: any): DebtGroup => ({
  id: row.id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  name: row.name,
  colour: row.colour,
  isDefault: row.is_default,
  includeInConsolidated: row.include_in_consolidated,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const debtGroupToInsert = (group: DebtGroup) => ({
  id: group.id,
  tenant_id: group.tenantId,
  workspace_id: group.workspaceId,
  name: group.name,
  colour: group.colour,
  is_default: group.isDefault,
  include_in_consolidated: group.includeInConsolidated,
  created_at: group.createdAt,
  updated_at: group.updatedAt,
});

export const debtGroupUpdatesToRow = (updates: Partial<DebtGroup>) => ({
  ...(updates.name !== undefined && { name: updates.name }),
  ...(updates.colour !== undefined && { colour: updates.colour }),
  ...(updates.includeInConsolidated !== undefined && { include_in_consolidated: updates.includeInConsolidated }),
  updated_at: new Date().toISOString(),
});

export const debtAccountFromRow = (row: any): DebtAccount => ({
  id: row.id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  groupId: row.group_id,
  name: row.name,
  lender: row.lender ?? '',
  type: row.type,
  openingBalance: Number(row.opening_balance ?? 0),
  interestRate: Number(row.interest_rate ?? 0),
  minimumPayment: Number(row.minimum_payment ?? 0),
  paymentDueDay: row.payment_due_day,
  startDate: row.start_date,
  termMonths: row.term_months,
  notes: row.notes ?? '',
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const debtAccountToInsert = (account: DebtAccount) => ({
  id: account.id,
  tenant_id: account.tenantId,
  workspace_id: account.workspaceId,
  group_id: account.groupId,
  name: account.name,
  lender: account.lender,
  type: account.type,
  opening_balance: account.openingBalance,
  interest_rate: account.interestRate,
  minimum_payment: account.minimumPayment,
  payment_due_day: account.paymentDueDay,
  start_date: account.startDate,
  term_months: account.termMonths,
  notes: account.notes,
  status: account.status,
  created_at: account.createdAt,
  updated_at: account.updatedAt,
});

export const debtAccountUpdatesToRow = (updates: Partial<DebtAccount>) => ({
  ...(updates.groupId !== undefined && { group_id: updates.groupId }),
  ...(updates.name !== undefined && { name: updates.name }),
  ...(updates.lender !== undefined && { lender: updates.lender }),
  ...(updates.type !== undefined && { type: updates.type }),
  ...(updates.openingBalance !== undefined && { opening_balance: updates.openingBalance }),
  ...(updates.interestRate !== undefined && { interest_rate: updates.interestRate }),
  ...(updates.minimumPayment !== undefined && { minimum_payment: updates.minimumPayment }),
  ...(updates.paymentDueDay !== undefined && { payment_due_day: updates.paymentDueDay }),
  ...(updates.startDate !== undefined && { start_date: updates.startDate }),
  ...(updates.termMonths !== undefined && { term_months: updates.termMonths }),
  ...(updates.notes !== undefined && { notes: updates.notes }),
  ...(updates.status !== undefined && { status: updates.status }),
  updated_at: new Date().toISOString(),
});

export const debtRepaymentFromRow = (row: any): DebtRepayment => ({
  id: row.id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  groupId: row.group_id,
  debtId: row.debt_id,
  date: row.date,
  amount: Number(row.amount ?? 0),
  notes: row.notes ?? '',
  sourceTransactionId: row.source_transaction_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const debtRepaymentToInsert = (repayment: DebtRepayment) => ({
  id: repayment.id,
  tenant_id: repayment.tenantId,
  workspace_id: repayment.workspaceId,
  group_id: repayment.groupId,
  debt_id: repayment.debtId,
  date: repayment.date,
  amount: repayment.amount,
  notes: repayment.notes,
  source_transaction_id: repayment.sourceTransactionId ?? null,
  created_at: repayment.createdAt,
  updated_at: repayment.updatedAt,
});

export const debtBalanceSnapshotFromRow = (row: any): DebtBalanceSnapshot => ({
  id: row.id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  groupId: row.group_id,
  debtId: row.debt_id,
  date: row.date,
  balance: Number(row.balance ?? 0),
  notes: row.notes ?? '',
  sourceTransactionId: row.source_transaction_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const debtBalanceSnapshotToInsert = (snapshot: DebtBalanceSnapshot) => ({
  id: snapshot.id,
  tenant_id: snapshot.tenantId,
  workspace_id: snapshot.workspaceId,
  group_id: snapshot.groupId,
  debt_id: snapshot.debtId,
  date: snapshot.date,
  balance: snapshot.balance,
  notes: snapshot.notes,
  source_transaction_id: snapshot.sourceTransactionId ?? null,
  created_at: snapshot.createdAt,
  updated_at: snapshot.updatedAt,
});
