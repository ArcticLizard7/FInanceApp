// ============================================================
// Tenant Store
// Manages the list of tenants (organisations).
// Only platform_admin can create / update / delete tenants.
// When migrating to a backend: replace storage calls with API.
// ============================================================

import { create } from 'zustand';
import { uuidv4 } from '@/utils/id';
import { storage } from '@/services/storageService';
import type { Tenant, TenantSettings } from '@/types/tenant';
import { DEFAULT_TENANT_SETTINGS } from '@/types/tenant';
import { defaultTenant, DEMO_TENANT_ID } from '@/data/mockData';
import { useSupabaseBackend } from '@/config/runtime';
import { requireSupabase } from '@/services/supabaseClient';
import { tenantFromRow, tenantToInsert } from '@/services/supabaseMappers';

const K = { tenants: 'tenants' } as const;

export interface CreateTenantInput {
  name: string;
  slug: string;
  colour: string;
  plan: Tenant['plan'];
  contactName: string;
  contactEmail: string;
  notes: string;
  settings?: Partial<TenantSettings>;
}

interface TenantStore {
  tenants: Tenant[];
  isInitialised: boolean;

  init: () => Promise<void> | void;

  // CRUD
  createTenant:  (input: CreateTenantInput, createdBy: string) => Promise<Tenant>;
  updateTenant:  (id: string, updates: Partial<Omit<Tenant, 'id' | 'createdAt' | 'createdBy'>>) => void;
  deleteTenant:  (id: string) => void;

  // Queries
  getTenant:           (id: string) => Tenant | undefined;
  getTenantBySlug:     (slug: string) => Tenant | undefined;
  isSlugTaken:         (slug: string, excludeId?: string) => boolean;
}

export const useTenantStore = create<TenantStore>((set, get) => ({
  tenants:       [],
  isInitialised: false,

  async init() {
    if (useSupabaseBackend) {
      const { data, error } = await requireSupabase()
        .from('tenants')
        .select('*')
        .order('name');

      if (error) {
        console.error('Failed to load tenants', error);
        set({ tenants: [], isInitialised: true });
        return;
      }

      set({ tenants: (data ?? []).map(tenantFromRow), isInitialised: true });
      return;
    }

    const existing = storage.get<Tenant[] | null>(K.tenants, null);
    if (!existing) {
      // First run — seed with the demo tenant
      const tenants = [defaultTenant];
      storage.set(K.tenants, tenants);
      set({ tenants, isInitialised: true });
    } else {
      // Migration: ensure the demo tenant exists even on upgraded installs
      const hasDemoTenant = existing.some(t => t.id === DEMO_TENANT_ID);
      if (!hasDemoTenant) {
        const tenants = [defaultTenant, ...existing];
        storage.set(K.tenants, tenants);
        set({ tenants, isInitialised: true });
      } else {
        set({ tenants: existing, isInitialised: true });
      }
    }
  },

  async createTenant(input, createdBy) {
    const tenant: Tenant = {
      id:           useSupabaseBackend ? crypto.randomUUID() : uuidv4(),
      name:         input.name.trim(),
      slug:         input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').trim(),
      colour:       input.colour,
      plan:         input.plan,
      status:       'active',
      settings:     { ...DEFAULT_TENANT_SETTINGS, ...input.settings },
      contactName:  input.contactName.trim(),
      contactEmail: input.contactEmail.trim(),
      notes:        input.notes.trim(),
      createdAt:    new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
      createdBy,
    };
    const tenants = [...get().tenants, tenant];
    if (useSupabaseBackend) {
      const { data, error } = await requireSupabase()
        .from('tenants')
        .insert(tenantToInsert(tenant))
        .select('*')
        .single();

      if (error) {
        console.error('Failed to create tenant', error);
        throw error;
      }

      const createdTenant = tenantFromRow(data);
      set({ tenants: [...get().tenants, createdTenant] });
      return createdTenant;
    } else {
      storage.set(K.tenants, tenants);
    }
    set({ tenants });
    return tenant;
  },

  updateTenant(id, updates) {
    const tenants = get().tenants.map(t =>
      t.id === id
        ? { ...t, ...updates, updatedAt: new Date().toISOString() }
        : t
    );
    if (useSupabaseBackend) {
      requireSupabase()
        .from('tenants')
        .update({
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.slug !== undefined && { slug: updates.slug }),
          ...(updates.colour !== undefined && { colour: updates.colour }),
          ...(updates.plan !== undefined && { plan: updates.plan }),
          ...(updates.status !== undefined && { status: updates.status }),
          ...(updates.settings !== undefined && { settings: updates.settings }),
          ...(updates.contactName !== undefined && { contact_name: updates.contactName }),
          ...(updates.contactEmail !== undefined && { contact_email: updates.contactEmail }),
          ...(updates.notes !== undefined && { notes: updates.notes }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('Failed to update tenant', error);
        });
    } else {
      storage.set(K.tenants, tenants);
    }
    set({ tenants });
  },

  deleteTenant(id) {
    if (id === DEMO_TENANT_ID) return; // protect the demo tenant
    const tenants = get().tenants.filter(t => t.id !== id);
    if (useSupabaseBackend) {
      requireSupabase().from('tenants').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to delete tenant', error);
      });
    } else {
      storage.set(K.tenants, tenants);
    }
    set({ tenants });
  },

  getTenant(id) {
    return get().tenants.find(t => t.id === id);
  },

  getTenantBySlug(slug) {
    return get().tenants.find(t => t.slug === slug.toLowerCase());
  },

  isSlugTaken(slug, excludeId) {
    const normalised = slug.toLowerCase();
    return get().tenants.some(t => t.slug === normalised && t.id !== excludeId);
  },
}));
