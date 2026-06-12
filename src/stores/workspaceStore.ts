import { create } from 'zustand';
import { uuidv4 } from '@/utils/id';
import type { Workspace, UserPreferences } from '@/types';
import { storage } from '@/services/storageService';
import { defaultWorkspaces, defaultPreferences, DEMO_TENANT_ID } from '@/data/mockData';
import { useAuthStore } from '@/stores/authStore';
import { useSupabaseBackend } from '@/config/runtime';
import { requireSupabase } from '@/services/supabaseClient';
import { preferencesFromRow, workspaceFromRow, workspaceToInsert } from '@/services/supabaseMappers';

interface WorkspaceStore {
  workspaces: Workspace[];
  preferences: UserPreferences;
  activeWorkspace: Workspace | null;

  init: () => Promise<void> | void;
  setActiveWorkspace: (id: string) => void;

  // Returns workspaces visible in the current tenant context
  getVisibleWorkspaces: () => Workspace[];

  addWorkspace:     (ws: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'> & { tenantId?: string }) => Workspace;
  updateWorkspace:  (id: string, updates: Partial<Workspace>) => void;
  archiveWorkspace: (id: string) => void;
  deleteWorkspace:  (id: string) => void;
  updatePreferences:(updates: Partial<UserPreferences>) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces:      [],
  preferences:     defaultPreferences,
  activeWorkspace: null,

  async init() {
    if (useSupabaseBackend) {
      const { currentUser, activeTenantId } = useAuthStore.getState();
      if (!currentUser || !activeTenantId) {
        set({ workspaces: [], preferences: defaultPreferences, activeWorkspace: null });
        return;
      }

      const supabase = requireSupabase();
      const [{ data: workspaceRows, error: workspaceError }, { data: prefsRow }] = await Promise.all([
        supabase.from('workspaces').select('*').eq('tenant_id', activeTenantId).order('name'),
        supabase.from('user_preferences').select('*').eq('user_id', currentUser.id).maybeSingle(),
      ]);

      if (workspaceError) {
        console.error('Failed to load workspaces', workspaceError);
        set({ workspaces: [], preferences: defaultPreferences, activeWorkspace: null });
        return;
      }

      const workspaces = (workspaceRows ?? []).map(workspaceFromRow);
      const preferences = preferencesFromRow(prefsRow, {
        ...defaultPreferences,
        activeWorkspaceId: workspaces.find(w => w.isDefault)?.id ?? workspaces[0]?.id ?? '',
      });
      const active =
        workspaces.find(w => w.id === preferences.activeWorkspaceId) ??
        workspaces.find(w => w.isDefault) ??
        workspaces[0] ??
        null;

      set({ workspaces, preferences, activeWorkspace: active });
      return;
    }

    const rawWorkspaces = storage.get<Workspace[] | null>('workspaces', null);
    let workspaces      = rawWorkspaces ?? defaultWorkspaces;
    if (!rawWorkspaces) {
      storage.set('workspaces', defaultWorkspaces);
    } else {
      // Migration: backfill missing tenantId
      const needsMigration = workspaces.some(w => !w.tenantId || !w.currency);
      if (needsMigration) {
        workspaces = workspaces.map(w => ({
          ...w,
          tenantId: w.tenantId || DEMO_TENANT_ID,
          currency: w.currency || 'GBP',
        }));
        storage.set('workspaces', workspaces);
      }
    }

    const rawPrefs  = storage.get<UserPreferences | null>('preferences', null);
    const preferences = rawPrefs ?? defaultPreferences;
    if (!rawPrefs) storage.set('preferences', defaultPreferences);

    const active =
      workspaces.find(w => w.id === preferences.activeWorkspaceId) ??
      workspaces.find(w => w.isDefault) ??
      workspaces[0] ??
      null;

    set({ workspaces, preferences, activeWorkspace: active });
  },

  getVisibleWorkspaces() {
    const { currentUser, activeTenantId } = useAuthStore.getState();
    const all = get().workspaces;

    // No tenant context yet (platform admin not inside a tenant)
    if (!activeTenantId) return [];

    // Filter to current tenant
    const tenantWs = all.filter(w => w.tenantId === activeTenantId && !w.isArchived);

    // If the user has specific workspace restrictions, apply them
    if (currentUser && currentUser.workspaceAccess.length > 0) {
      return tenantWs.filter(w => currentUser.workspaceAccess.includes(w.id));
    }

    return tenantWs;
  },

  setActiveWorkspace(id) {
    const ws = get().workspaces.find(w => w.id === id) ?? null;
    const prefs = { ...get().preferences, activeWorkspaceId: id };
    if (useSupabaseBackend) {
      const { currentUser } = useAuthStore.getState();
      if (currentUser) {
        requireSupabase()
          .from('user_preferences')
          .upsert({
            user_id: currentUser.id,
            active_workspace_id: id,
            preferences: prefs,
            updated_at: new Date().toISOString(),
          })
          .then(({ error }) => {
            if (error) console.error('Failed to update preferences', error);
          });
      }
    } else {
      storage.set('preferences', prefs);
    }
    set({ activeWorkspace: ws, preferences: prefs });
  },

  addWorkspace(data) {
    const { activeTenantId } = useAuthStore.getState();
    const ws: Workspace = {
      ...data,
      tenantId:  data.tenantId || activeTenantId || '',
      currency:  data.currency || 'GBP',
      id:        useSupabaseBackend ? crypto.randomUUID() : `ws_${uuidv4().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const workspaces = [...get().workspaces, ws];
    if (useSupabaseBackend) {
      requireSupabase().from('workspaces').insert(workspaceToInsert(ws)).then(({ error }) => {
        if (error) console.error('Failed to create workspace', error);
      });
    } else {
      storage.set('workspaces', workspaces);
    }
    set({ workspaces });
    return ws;
  },

  updateWorkspace(id, updates) {
    const workspaces = get().workspaces.map(w =>
      w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w
    );
    if (useSupabaseBackend) {
      requireSupabase()
        .from('workspaces')
        .update({
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.type !== undefined && { type: updates.type }),
          ...(updates.colour !== undefined && { colour: updates.colour }),
          ...(updates.currency !== undefined && { currency: updates.currency }),
          ...(updates.isDefault !== undefined && { is_default: updates.isDefault }),
          ...(updates.isArchived !== undefined && { is_archived: updates.isArchived }),
          ...(updates.hideFinanceFeatures !== undefined && { hide_finance_features: updates.hideFinanceFeatures }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('Failed to update workspace', error);
        });
    } else {
      storage.set('workspaces', workspaces);
    }
    const activeWorkspace = workspaces.find(w => w.id === get().activeWorkspace?.id) ?? null;
    set({ workspaces, activeWorkspace });
  },

  archiveWorkspace(id) {
    get().updateWorkspace(id, { isArchived: true });
  },

  deleteWorkspace(id) {
    const workspaces = get().workspaces.filter(w => w.id !== id);
    if (useSupabaseBackend) {
      requireSupabase().from('workspaces').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to delete workspace', error);
      });
    } else {
      storage.set('workspaces', workspaces);
    }
    set({ workspaces });
  },

  updatePreferences(updates) {
    const preferences = { ...get().preferences, ...updates };
    if (useSupabaseBackend) {
      const { currentUser } = useAuthStore.getState();
      if (currentUser) {
        requireSupabase()
          .from('user_preferences')
          .upsert({
            user_id: currentUser.id,
            active_workspace_id: preferences.activeWorkspaceId || null,
            preferences,
            updated_at: new Date().toISOString(),
          })
          .then(({ error }) => {
            if (error) console.error('Failed to update preferences', error);
          });
      }
    } else {
      storage.set('preferences', preferences);
    }
    set({ preferences });
  },
}));
