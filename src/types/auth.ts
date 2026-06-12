// ============================================================
// Auth Types — Multi-Tenant Edition
// Role hierarchy (highest → lowest):
//   platform_admin  → owner of the SaaS platform, no tenantId
//   tenant_admin    → manages one tenant (users + workspaces)
//   finance_director / finance_manager / accounts_assistant
//                   → work within a tenant, scoped to workspaces
//
// When migrating to a real backend:
//   - Replace localStorage tokens with HttpOnly cookies
//   - Replace SHA-256 client hashing with server-side bcrypt/Argon2
//   - Replace OTP generation with server-side RFC 6238 TOTP
//   - Enforce tenantId via row-level security / JWT claims
// ============================================================

export type UserRole =
  | 'platform_admin'
  | 'tenant_admin'
  | 'finance_director'
  | 'finance_manager'
  | 'accounts_assistant';

export const ROLE_LABELS: Record<UserRole, string> = {
  platform_admin:     'Platform Administrator',
  tenant_admin:       'Tenant Administrator',
  finance_director:   'Finance Director',
  finance_manager:    'Finance Manager',
  accounts_assistant: 'Accounts Assistant',
};

// Permissions per role — extend as features are added
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  platform_admin:     ['*'],
  tenant_admin:       ['*'],
  finance_director:   ['tasks', 'payments', 'reports', 'cashflow', 'contacts'],
  finance_manager:    ['tasks', 'payments', 'reports', 'cashflow', 'contacts', 'import'],
  accounts_assistant: ['tasks', 'payments'],
};

// Roles that can manage users within their scope
export const ADMIN_ROLES: UserRole[] = ['platform_admin', 'tenant_admin'];

// Whether a role is platform-level (no tenantId)
export function isPlatformRole(role: UserRole): boolean {
  return role === 'platform_admin';
}

// Whether a role can manage tenant-level resources
export function isTenantAdmin(role: UserRole): boolean {
  return role === 'platform_admin' || role === 'tenant_admin';
}

export interface User {
  id: string;
  username: string;           // globally unique login handle
  displayName: string;
  email: string;
  passwordHash: string;       // SHA-256(password + salt), hex
  salt: string;               // random hex salt
  role: UserRole;
  tenantId: string | null;    // null for platform_admin only
  workspaceAccess: string[];  // workspace IDs within tenant; empty = all
  isActive: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  createdBy: string | null;   // user ID of creator
}

export interface Session {
  userId: string;
  token: string;              // random hex session token
  deviceToken: string | null; // set if device was remembered
  expiresAt: string;          // ISO — 24 h from login
  createdAt: string;
}

export interface DeviceToken {
  id: string;
  token: string;              // random hex, 64 chars
  userId: string;
  deviceName: string;         // e.g. "Chrome on Windows"
  createdAt: string;
  expiresAt: string;          // 30 days
}

// Ephemeral — lives only in memory during MFA step, persisted briefly to localStorage
export interface PendingMFA {
  userId: string;
  code: string;               // 6-digit OTP
  expiresAt: string;          // 5 minutes
  rememberDevice: boolean;
}
