import { create } from 'zustand';
import { uuidv4 } from '@/utils/id';
import type { Contact } from '@/types';
import { storage } from '@/services/storageService';
import { defaultContacts, DEMO_TENANT_ID } from '@/data/mockData';
import { useAuthStore } from '@/stores/authStore';
import { useSupabaseBackend } from '@/config/runtime';
import { requireSupabase } from '@/services/supabaseClient';
import { contactFromRow, contactToInsert } from '@/services/supabaseMappers';

interface ContactStore {
  contacts: Contact[];
  init: () => Promise<void> | void;
  getWorkspaceContacts: (workspaceId: string) => Contact[];
  addContact: (c: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'> & { tenantId?: string }) => Contact;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;
}

const KEY = 'contacts';

export const useContactStore = create<ContactStore>((set, get) => ({
  contacts: [],

  async init() {
    if (useSupabaseBackend) {
      const { activeTenantId } = useAuthStore.getState();
      if (!activeTenantId) {
        set({ contacts: [] });
        return;
      }

      const { data, error } = await requireSupabase()
        .from('contacts')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('name');

      if (error) {
        console.error('Failed to load contacts', error);
        set({ contacts: [] });
        return;
      }

      set({ contacts: (data ?? []).map(contactFromRow) });
      return;
    }

    const raw = storage.get<Contact[] | null>(KEY, null);
    let contacts = raw ?? defaultContacts;
    if (!raw) {
      storage.set(KEY, defaultContacts);
    } else {
      const needsMigration = contacts.some(c => !c.tenantId);
      if (needsMigration) {
        contacts = contacts.map(c => c.tenantId ? c : { ...c, tenantId: DEMO_TENANT_ID });
        storage.set(KEY, contacts);
      }
    }
    set({ contacts });
  },

  getWorkspaceContacts(workspaceId) {
    const { activeTenantId } = useAuthStore.getState();
    return get().contacts.filter(c =>
      c.workspaceId === workspaceId &&
      (!activeTenantId || c.tenantId === activeTenantId)
    );
  },

  addContact(data) {
    const { activeTenantId } = useAuthStore.getState();
    const contact: Contact = {
      ...data,
      tenantId: data.tenantId || activeTenantId || '',
      id: useSupabaseBackend ? crypto.randomUUID() : `c_${uuidv4().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const contacts = [...get().contacts, contact];
    if (useSupabaseBackend) {
      requireSupabase().from('contacts').insert(contactToInsert(contact)).then(({ error }) => {
        if (error) console.error('Failed to create contact', error);
      });
    } else {
      storage.set(KEY, contacts);
    }
    set({ contacts });
    return contact;
  },

  updateContact(id, updates) {
    const contacts = get().contacts.map(c =>
      c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
    );
    if (useSupabaseBackend) {
      requireSupabase()
        .from('contacts')
        .update({
          ...(updates.workspaceId !== undefined && { workspace_id: updates.workspaceId }),
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.email !== undefined && { email: updates.email }),
          ...(updates.role !== undefined && { role: updates.role }),
          ...(updates.company !== undefined && { company: updates.company }),
          ...(updates.phone !== undefined && { phone: updates.phone }),
          ...(updates.notes !== undefined && { notes: updates.notes }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('Failed to update contact', error);
        });
    } else {
      storage.set(KEY, contacts);
    }
    set({ contacts });
  },

  deleteContact(id) {
    const contacts = get().contacts.filter(c => c.id !== id);
    if (useSupabaseBackend) {
      requireSupabase().from('contacts').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to delete contact', error);
      });
    } else {
      storage.set(KEY, contacts);
    }
    set({ contacts });
  },
}));
