// ============================================================
// Auth Store — Multi-Tenant Edition
//
// Credential defaults (change immediately in production):
//   Platform admin:  superadmin / SuperAdmin123!
//   Demo tenant admin: admin / Admin123!
//
// Platform admin has tenantId = null and sees all tenants.
// When entering a tenant, viewingTenantId is set.
// activeTenantId = currentUser.tenantId ?? viewingTenantId
// ============================================================

import { create } from 'zustand';
import { uuidv4 } from '@/utils/id';
import { storage } from '@/services/storageService';
import { authService } from '@/services/authService';
import type { User, Session, DeviceToken, PendingMFA } from '@/types/auth';
import { DEMO_TENANT_ID } from '@/data/mockData';
import { runtimeConfig, useSupabaseBackend } from '@/config/runtime';
import { requireSupabase } from '@/services/supabaseClient';
import { profileFromRow } from '@/services/supabaseMappers';

// ── Storage keys ─────────────────────────────────────────────
const K = {
  users:        'auth_users',
  session:      'auth_session',
  deviceTokens: 'auth_device_tokens',
  pendingMFA:   'auth_pending_mfa',
} as const;

// ── Default credentials ──────────────────────────────────────
const PLATFORM_ADMIN_USERNAME = 'superadmin';
const PLATFORM_ADMIN_PASSWORD = 'SuperAdmin123!';
const TENANT_ADMIN_USERNAME   = 'admin';
const TENANT_ADMIN_PASSWORD   = 'Admin123!';

// ── Store interface ──────────────────────────────────────────

export type AuthError =
  | 'invalid_credentials'
  | 'account_disabled'
  | 'profile_unavailable'
  | 'mfa_required'
  | 'mfa_invalid'
  | 'mfa_expired'
  | 'session_expired';

interface AuthStore {
  // State
  currentUser:     User | null;
  session:         Session | null;
  pendingMFA:      PendingMFA | null;
  users:           User[];
  deviceTokens:    DeviceToken[];
  isInitialised:   boolean;

  // Tenant-viewing context (platform admin only)
  // When a platform_admin "enters" a tenant, this is set.
  viewingTenantId: string | null;

  // Computed: the tenant whose data is currently active
  // currentUser.tenantId for normal users; viewingTenantId for platform admin
  activeTenantId:  string | null;

  // Auth actions
  init:         () => Promise<void>;
  login:        (username: string, password: string, rememberDevice: boolean) => Promise<{ ok: boolean; error?: AuthError; mfaRequired?: boolean }>;
  verifyMFA:    (code: string) => Promise<{ ok: boolean; error?: AuthError }>;
  logout:       () => void;
  revokeDevice: (tokenId: string) => void;

  // Platform admin: enter / exit a tenant's context
  enterTenant: (tenantId: string) => void;
  exitTenant:  () => void;

  // User management (platform admin or tenant admin)
  createUser:             (data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt' | 'passwordHash' | 'salt'> & { password: string }) => Promise<User>;
  updateUser:             (id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>) => void;
  resetPassword:          (id: string, newPassword: string) => Promise<void>;
  deleteUser:             (id: string) => void;
  getDeviceTokensForUser: (userId: string) => DeviceToken[];
  revokeAllDevicesForUser:(userId: string) => void;

  // Queries scoped to a tenant (for tenant admin views)
  getUsersForTenant: (tenantId: string) => User[];
}

// ── Explicit types to avoid recursive inference ───────────────
type StoreSetter = (partial: Partial<AuthStore>) => void;
type StoreGetter = () => AuthStore;

async function loadVisibleProfiles(): Promise<User[]> {
  if (!useSupabaseBackend) return [];
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('*')
    .order('display_name');

  if (error) {
    console.error('Failed to load profiles', error);
    return [];
  }

  return (data ?? []).map(profileFromRow);
}

// ── Store ─────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>((set, get) => ({
  currentUser:     null,
  session:         null,
  pendingMFA:      null,
  users:           [],
  deviceTokens:    [],
  isInitialised:   false,
  viewingTenantId: null,
  activeTenantId:  null,

  // ── Initialise ────────────────────────────────────────────

  async init() {
    if (useSupabaseBackend) {
      const supabase = requireSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      const authUser = sessionData.session?.user ?? null;

      if (!authUser) {
        set({
          currentUser: null,
          session: null,
          pendingMFA: null,
          users: [],
          deviceTokens: [],
          isInitialised: true,
          viewingTenantId: null,
          activeTenantId: null,
        });
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error || !profile || !profile.is_active) {
        await supabase.auth.signOut();
        set({
          currentUser: null,
          session: null,
          pendingMFA: null,
          users: [],
          deviceTokens: [],
          isInitialised: true,
          viewingTenantId: null,
          activeTenantId: null,
        });
        return;
      }

      const currentUser = profileFromRow(profile);
      const visibleUsers = await loadVisibleProfiles();
      const session: Session = {
        userId: currentUser.id,
        token: sessionData.session?.access_token ?? '',
        deviceToken: null,
        expiresAt: sessionData.session?.expires_at
          ? new Date(sessionData.session.expires_at * 1000).toISOString()
          : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      };

      set({
        currentUser,
        session,
        pendingMFA: null,
        users: visibleUsers.length ? visibleUsers : [currentUser],
        deviceTokens: [],
        isInitialised: true,
        viewingTenantId: null,
        activeTenantId: currentUser.tenantId,
      });
      return;
    }

    let users = storage.get<User[] | null>(K.users, null);

    if (!users) {
      // ── First run: seed both default accounts ────────────────
      const paSalt  = authService.generateSalt();
      const paHash  = await authService.hashPassword(PLATFORM_ADMIN_PASSWORD, paSalt);
      const taSalt  = authService.generateSalt();
      const taHash  = await authService.hashPassword(TENANT_ADMIN_PASSWORD, taSalt);

      const platformAdmin: User = {
        id:              'user_platform_admin',
        username:        PLATFORM_ADMIN_USERNAME,
        displayName:     'Platform Administrator',
        email:           'superadmin@financeflow.local',
        passwordHash:    paHash,
        salt:            paSalt,
        role:            'platform_admin',
        tenantId:        null,
        workspaceAccess: [],
        isActive:        true,
        mfaEnabled:      true,
        createdAt:       new Date().toISOString(),
        updatedAt:       new Date().toISOString(),
        lastLoginAt:     null,
        createdBy:       null,
      };

      const tenantAdmin: User = {
        id:              'user_tenant_admin',
        username:        TENANT_ADMIN_USERNAME,
        displayName:     'Tenant Administrator',
        email:           'admin@demo.local',
        passwordHash:    taHash,
        salt:            taSalt,
        role:            'tenant_admin',
        tenantId:        DEMO_TENANT_ID,
        workspaceAccess: [],
        isActive:        true,
        mfaEnabled:      true,
        createdAt:       new Date().toISOString(),
        updatedAt:       new Date().toISOString(),
        lastLoginAt:     null,
        createdBy:       'user_platform_admin',
      };

      users = [platformAdmin, tenantAdmin];
      storage.set(K.users, users);

    } else {
      // ── Migration: upgrade existing data from v1 schema ──────
      let dirty = false;

      // 1. Rename 'administrator' role → 'tenant_admin'
      //    and ensure every non-platform user has a tenantId
      users = users.map(u => {
        const changes: Partial<User> = {};

        if ((u.role as string) === 'administrator') {
          changes.role     = 'tenant_admin';
          changes.tenantId = u.tenantId ?? DEMO_TENANT_ID;
          dirty = true;
        }

        // Fill missing tenantId for non-platform users
        if (!u.tenantId && u.role !== 'platform_admin') {
          changes.tenantId = DEMO_TENANT_ID;
          dirty = true;
        }

        return Object.keys(changes).length ? { ...u, ...changes } : u;
      });

      // 2. Inject platform admin if it doesn't exist yet
      const hasPlatformAdmin = users.some(u => u.role === 'platform_admin');
      if (!hasPlatformAdmin) {
        const paSalt = authService.generateSalt();
        const paHash = await authService.hashPassword(PLATFORM_ADMIN_PASSWORD, paSalt);
        users = [
          {
            id:              'user_platform_admin',
            username:        PLATFORM_ADMIN_USERNAME,
            displayName:     'Platform Administrator',
            email:           'superadmin@financeflow.local',
            passwordHash:    paHash,
            salt:            paSalt,
            role:            'platform_admin',
            tenantId:        null,
            workspaceAccess: [],
            isActive:        true,
            mfaEnabled:      true,
            createdAt:       new Date().toISOString(),
            updatedAt:       new Date().toISOString(),
            lastLoginAt:     null,
            createdBy:       null,
          },
          ...users,
        ];
        dirty = true;
      }

      if (dirty) storage.set(K.users, users);
    }

    const deviceTokens = storage.get<DeviceToken[]>(K.deviceTokens, []);

    // Restore session if valid
    const session = storage.get<Session | null>(K.session, null);
    let currentUser: User | null = null;

    if (session && new Date(session.expiresAt) > new Date()) {
      if (session.deviceToken) {
        const dt = deviceTokens.find(
          d => d.token === session.deviceToken && new Date(d.expiresAt) > new Date()
        );
        if (!dt) {
          storage.remove(K.session);
        } else {
          currentUser = users.find(u => u.id === session.userId) ?? null;
        }
      } else {
        currentUser = users.find(u => u.id === session.userId) ?? null;
      }
    } else if (session) {
      storage.remove(K.session);
    }

    const activeTenantId = currentUser?.tenantId ?? null;

    set({ users, deviceTokens, currentUser, session: currentUser ? session : null, isInitialised: true, activeTenantId });
  },

  // ── Login ─────────────────────────────────────────────────

  async login(username, password, rememberDevice) {
    if (useSupabaseBackend) {
      const supabase = requireSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username,
        password,
      });

      if (error || !data.user) return { ok: false, error: 'invalid_credentials' };

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        console.error('Failed to load signed-in profile', profileError);
        return { ok: false, error: 'profile_unavailable' };
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        return { ok: false, error: 'account_disabled' };
      }

      const currentUser = profileFromRow(profile);
      const visibleUsers = await loadVisibleProfiles();
      const session: Session = {
        userId: currentUser.id,
        token: data.session?.access_token ?? '',
        deviceToken: null,
        expiresAt: data.session?.expires_at
          ? new Date(data.session.expires_at * 1000).toISOString()
          : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      };

      set({
        currentUser,
        session,
        users: visibleUsers.length ? visibleUsers : [currentUser],
        activeTenantId: currentUser.tenantId,
        viewingTenantId: null,
        pendingMFA: null,
      });

      return { ok: true };
    }

    if (!runtimeConfig.enableDemoAuth) {
      return { ok: false, error: 'invalid_credentials' };
    }

    const users = get().users;
    const user  = users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) return { ok: false, error: 'invalid_credentials' };
    if (!user.isActive) return { ok: false, error: 'account_disabled' };

    const valid = await authService.verifyPassword(password, user.salt, user.passwordHash);
    if (!valid) return { ok: false, error: 'invalid_credentials' };

    const deviceTokens    = get().deviceTokens;
    const storedDevTok    = localStorage.getItem('ff_device_tok');
    const remembered      = storedDevTok
      ? deviceTokens.find(d => d.token === storedDevTok && d.userId === user.id && new Date(d.expiresAt) > new Date())
      : null;

    if (!user.mfaEnabled || remembered) {
      return createSession(user, remembered?.token ?? null, set, get);
    }

    const code      = authService.generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const pending: PendingMFA = { userId: user.id, code, expiresAt, rememberDevice };

    storage.set(K.pendingMFA, pending);
    set({ pendingMFA: pending });

    if (runtimeConfig.enableDemoAuth) {
      console.info(`[MFA] Code for ${user.displayName}: ${code}  (valid 5 min)`);
    }
    return { ok: true, mfaRequired: true };
  },

  // ── Verify MFA ────────────────────────────────────────────

  async verifyMFA(code) {
    if (useSupabaseBackend) return { ok: false, error: 'mfa_invalid' };

    const pending = get().pendingMFA ?? storage.get<PendingMFA | null>(K.pendingMFA, null);
    if (!pending) return { ok: false, error: 'mfa_expired' };

    if (new Date(pending.expiresAt) < new Date()) {
      storage.remove(K.pendingMFA);
      set({ pendingMFA: null });
      return { ok: false, error: 'mfa_expired' };
    }

    if (code.trim() !== pending.code) return { ok: false, error: 'mfa_invalid' };

    const user = get().users.find(u => u.id === pending.userId);
    if (!user) return { ok: false, error: 'invalid_credentials' };

    let deviceTokenStr: string | null = null;
    if (pending.rememberDevice) {
      deviceTokenStr = authService.generateToken();
      const dt: DeviceToken = {
        id:         uuidv4(),
        token:      deviceTokenStr,
        userId:     user.id,
        deviceName: authService.getDeviceName(),
        createdAt:  new Date().toISOString(),
        expiresAt:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const deviceTokens = [...get().deviceTokens, dt];
      storage.set(K.deviceTokens, deviceTokens);
      localStorage.setItem('ff_device_tok', deviceTokenStr);
      set({ deviceTokens });
    }

    storage.remove(K.pendingMFA);
    set({ pendingMFA: null });

    return createSession(user, deviceTokenStr, set, get);
  },

  // ── Logout ───────────────────────────────────────────────

  logout() {
    if (useSupabaseBackend) {
      requireSupabase().auth.signOut();
    }
    storage.remove(K.session);
    storage.remove(K.pendingMFA);
    set({ currentUser: null, session: null, pendingMFA: null, viewingTenantId: null, activeTenantId: null });
  },

  // ── Platform admin: enter / exit tenant context ───────────

  enterTenant(tenantId) {
    set({ viewingTenantId: tenantId, activeTenantId: tenantId });
    if (useSupabaseBackend) {
      Promise.all([
        import('@/stores/workspaceStore').then(m => m.useWorkspaceStore.getState().init()),
        import('@/stores/taskStore').then(m => m.useTaskStore.getState().init()),
        import('@/stores/paymentStore').then(m => m.usePaymentStore.getState().init()),
        import('@/stores/contactStore').then(m => m.useContactStore.getState().init()),
        import('@/stores/notificationStore').then(m => m.useNotificationStore.getState().init()),
        import('@/stores/budgetStore').then(m => m.useBudgetStore.getState().init()),
        import('@/stores/debtStore').then(m => m.useDebtStore.getState().init()),
      ]).catch(error => console.error('Failed to load tenant context', error));
    }
  },

  exitTenant() {
    set({ viewingTenantId: null, activeTenantId: null });
    if (useSupabaseBackend) {
      import('@/stores/workspaceStore').then(m => {
        m.useWorkspaceStore.setState({ workspaces: [], activeWorkspace: null });
      });
      import('@/stores/taskStore').then(m => m.useTaskStore.setState({ tasks: [] }));
      import('@/stores/paymentStore').then(m => m.usePaymentStore.setState({ payments: [] }));
      import('@/stores/contactStore').then(m => m.useContactStore.setState({ contacts: [] }));
      import('@/stores/notificationStore').then(m => m.useNotificationStore.setState({ notifications: [] }));
      import('@/stores/budgetStore').then(m => m.useBudgetStore.setState({ profiles: [], categories: [], budgets: [], incomes: [], transactions: [] }));
      import('@/stores/debtStore').then(m => m.useDebtStore.setState({ groups: [], accounts: [], repayments: [], balances: [] }));
    }
  },

  // ── Revoke device ─────────────────────────────────────────

  revokeDevice(tokenId) {
    const revoked     = get().deviceTokens.find(d => d.id === tokenId);
    const deviceTokens = get().deviceTokens.filter(d => d.id !== tokenId);
    storage.set(K.deviceTokens, deviceTokens);
    if (revoked && localStorage.getItem('ff_device_tok') === revoked.token) {
      localStorage.removeItem('ff_device_tok');
    }
    set({ deviceTokens });
  },

  // ── User management ───────────────────────────────────────

  async createUser(data) {
    if (useSupabaseBackend) {
      const supabase = requireSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const response = await fetch(`${runtimeConfig.supabaseUrl}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          apikey: runtimeConfig.supabaseAnonKey ?? '',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: data.username,
          displayName: data.displayName,
          email: data.email,
          password: data.password,
          role: data.role,
          tenantId: data.tenantId,
          workspaceAccess: data.workspaceAccess,
          isActive: data.isActive,
          mfaEnabled: data.mfaEnabled,
          createdBy: data.createdBy,
          sessionAccessToken: accessToken,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        const message = result?.error || 'Failed to create user.';
        console.error('Failed to create Supabase user', result);
        throw new Error(message);
      }

      if (!result?.profile) {
        throw new Error('User was created, but no profile was returned.');
      }

      const user = profileFromRow(result.profile);
      set({ users: [...get().users, user] });
      return user;
    }

    const { password, ...rest } = data;
    const salt = authService.generateSalt();
    const hash = await authService.hashPassword(password, salt);

    const user: User = {
      ...rest,
      id:           uuidv4(),
      passwordHash: hash,
      salt,
      createdAt:    new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
      lastLoginAt:  null,
    };

    const users = [...get().users, user];
    storage.set(K.users, users);
    set({ users });
    return user;
  },

  updateUser(id, updates) {
    if (useSupabaseBackend) {
      const supabaseUpdates = {
        ...(updates.displayName !== undefined && { display_name: updates.displayName }),
        ...(updates.email !== undefined && { email: updates.email }),
        ...(updates.role !== undefined && { role: updates.role }),
        ...(updates.tenantId !== undefined && { tenant_id: updates.tenantId }),
        ...(updates.workspaceAccess !== undefined && { workspace_access: updates.workspaceAccess }),
        ...(updates.isActive !== undefined && { is_active: updates.isActive }),
        ...(updates.mfaEnabled !== undefined && { mfa_enabled: updates.mfaEnabled }),
        updated_at: new Date().toISOString(),
      };
      requireSupabase().from('profiles').update(supabaseUpdates).eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to update profile', error);
      });
    }

    const users = get().users.map(u =>
      u.id === id ? { ...u, ...updates, updatedAt: new Date().toISOString() } : u
    );
    storage.set(K.users, users);
    const currentUser = users.find(u => u.id === get().currentUser?.id) ?? null;
    set({ users, currentUser });
  },

  async resetPassword(id, newPassword) {
    if (useSupabaseBackend) {
      throw new Error('Reset passwords through Supabase Auth.');
    }

    const salt = authService.generateSalt();
    const hash = await authService.hashPassword(newPassword, salt);
    get().updateUser(id, { passwordHash: hash, salt } as Partial<User>);
  },

  deleteUser(id) {
    if (useSupabaseBackend) {
      get().updateUser(id, { isActive: false } as Partial<User>);
      return;
    }

    if (id === get().currentUser?.id) return;
    const users = get().users.filter(u => u.id !== id);
    storage.set(K.users, users);
    get().revokeAllDevicesForUser(id);
    set({ users });
  },

  getDeviceTokensForUser(userId) {
    return get().deviceTokens.filter(d => d.userId === userId);
  },

  revokeAllDevicesForUser(userId) {
    const deviceTokens = get().deviceTokens.filter(d => d.userId !== userId);
    storage.set(K.deviceTokens, deviceTokens);
    set({ deviceTokens });
  },

  getUsersForTenant(tenantId) {
    return get().users.filter(u => u.tenantId === tenantId);
  },
}));

// ── Shared session creator ────────────────────────────────────

async function createSession(
  user: User,
  deviceToken: string | null,
  set: StoreSetter,
  get: StoreGetter,
): Promise<{ ok: boolean; error?: AuthError }> {
  const session: Session = {
    userId:      user.id,
    token:       authService.generateToken(),
    deviceToken,
    expiresAt:   new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt:   new Date().toISOString(),
  };

  storage.set(K.session, session);

  const users = get().users.map(u =>
    u.id === user.id ? { ...u, lastLoginAt: new Date().toISOString() } : u
  );
  storage.set(K.users, users);

  // activeTenantId for regular users = their tenantId
  // For platform_admin it starts as null (they pick a tenant from the platform dashboard)
  const activeTenantId = user.tenantId ?? null;

  set({ currentUser: user, session, users, activeTenantId, viewingTenantId: null });
  return { ok: true };
}
