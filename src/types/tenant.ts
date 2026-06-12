// ============================================================
// Tenant (top-level organisation) Types
// Each tenant is a completely isolated data partition.
// When migrating to a real backend:
//   - Row-level security (e.g. Supabase RLS) enforces tenantId
//   - JWT claims carry tenantId — never trust the client
// ============================================================

export type TenantPlan = 'trial' | 'standard' | 'enterprise';
export type TenantStatus = 'active' | 'suspended' | 'archived';

export interface TenantSettings {
  maxUsers: number;           // 0 = unlimited
  maxWorkspaces: number;
  enableExcelImport: boolean;
  enableEmailDelegation: boolean;
  enableReports: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;               // url-safe identifier, unique
  colour: string;
  plan: TenantPlan;
  status: TenantStatus;
  settings: TenantSettings;
  contactName: string;        // primary contact
  contactEmail: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;          // platform admin user id
}

export const DEFAULT_TENANT_SETTINGS: TenantSettings = {
  maxUsers: 0,
  maxWorkspaces: 0,
  enableExcelImport: true,
  enableEmailDelegation: true,
  enableReports: true,
};

export const PLAN_LABELS: Record<TenantPlan, string> = {
  trial:      'Trial',
  standard:   'Standard',
  enterprise: 'Enterprise',
};

export const PLAN_COLOUR: Record<TenantPlan, string> = {
  trial:      'bg-slate-100 text-slate-600',
  standard:   'bg-blue-50 text-blue-700',
  enterprise: 'bg-purple-50 text-purple-700',
};

export const STATUS_COLOUR: Record<TenantStatus, string> = {
  active:    'bg-green-50 text-green-700',
  suspended: 'bg-amber-50 text-amber-700',
  archived:  'bg-slate-100 text-slate-400',
};
