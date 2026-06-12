import { create } from 'zustand';
import { uuidv4 } from '@/utils/id';
import type { Notification } from '@/types';
import { storage } from '@/services/storageService';
import { defaultNotifications, DEMO_TENANT_ID } from '@/data/mockData';
import { addDays } from '@/utils/dateUtils';
import { useAuthStore } from '@/stores/authStore';
import { useSupabaseBackend } from '@/config/runtime';
import { requireSupabase } from '@/services/supabaseClient';
import { notificationFromRow, notificationToInsert } from '@/services/supabaseMappers';

interface NotificationStore {
  notifications: Notification[];
  init: () => Promise<void> | void;
  getWorkspaceNotifications: (workspaceId: string) => Notification[];
  getUnreadCount: (workspaceId: string) => number;
  addNotification: (n: Omit<Notification, 'id' | 'createdAt' | 'isRead' | 'isDismissed' | 'snoozedUntil'>) => void;
  markRead: (id: string) => void;
  markAllRead: (workspaceId: string) => void;
  dismiss: (id: string) => void;
  snooze: (id: string, days: number) => void;
}

const KEY = 'notifications';

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],

  async init() {
    if (useSupabaseBackend) {
      const { activeTenantId } = useAuthStore.getState();
      if (!activeTenantId) {
        set({ notifications: [] });
        return;
      }

      const { data, error } = await requireSupabase()
        .from('notifications')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load notifications', error);
        set({ notifications: [] });
        return;
      }

      set({ notifications: (data ?? []).map(notificationFromRow) });
      return;
    }

    const raw = storage.get<Notification[] | null>(KEY, null);
    let notifications = raw ?? defaultNotifications;
    if (!raw) {
      storage.set(KEY, defaultNotifications);
    } else {
      const needsMigration = notifications.some(n => !n.tenantId);
      if (needsMigration) {
        notifications = notifications.map(n => n.tenantId ? n : { ...n, tenantId: DEMO_TENANT_ID });
        storage.set(KEY, notifications);
      }
    }
    set({ notifications });
  },

  getWorkspaceNotifications(workspaceId) {
    const { activeTenantId } = useAuthStore.getState();
    const now = new Date().toISOString();
    return get().notifications.filter(n =>
      n.workspaceId === workspaceId &&
      (!activeTenantId || n.tenantId === activeTenantId) &&
      !n.isDismissed &&
      (!n.snoozedUntil || n.snoozedUntil < now)
    );
  },

  getUnreadCount(workspaceId) {
    return get().getWorkspaceNotifications(workspaceId).filter(n => !n.isRead).length;
  },

  addNotification(data) {
    const { activeTenantId } = useAuthStore.getState();
    const n: Notification = {
      ...data,
      tenantId: data.tenantId || activeTenantId || '',
      id: useSupabaseBackend ? crypto.randomUUID() : `n_${uuidv4().slice(0, 8)}`,
      isRead: false,
      isDismissed: false,
      snoozedUntil: null,
      createdAt: new Date().toISOString(),
    };
    const notifications = [n, ...get().notifications];
    if (useSupabaseBackend) {
      requireSupabase().from('notifications').insert(notificationToInsert(n)).then(({ error }) => {
        if (error) console.error('Failed to create notification', error);
      });
    } else {
      storage.set(KEY, notifications);
    }
    set({ notifications });
  },

  markRead(id) {
    const notifications = get().notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
    if (useSupabaseBackend) {
      requireSupabase().from('notifications').update({ is_read: true }).eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to mark notification read', error);
      });
    } else {
      storage.set(KEY, notifications);
    }
    set({ notifications });
  },

  markAllRead(workspaceId) {
    const notifications = get().notifications.map(n =>
      n.workspaceId === workspaceId ? { ...n, isRead: true } : n
    );
    if (useSupabaseBackend) {
      requireSupabase()
        .from('notifications')
        .update({ is_read: true })
        .eq('workspace_id', workspaceId)
        .then(({ error }) => {
          if (error) console.error('Failed to mark notifications read', error);
        });
    } else {
      storage.set(KEY, notifications);
    }
    set({ notifications });
  },

  dismiss(id) {
    const notifications = get().notifications.map(n => n.id === id ? { ...n, isDismissed: true } : n);
    if (useSupabaseBackend) {
      requireSupabase().from('notifications').update({ is_dismissed: true }).eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to dismiss notification', error);
      });
    } else {
      storage.set(KEY, notifications);
    }
    set({ notifications });
  },

  snooze(id, days) {
    const snoozedUntil = addDays(new Date(), days).toISOString();
    const notifications = get().notifications.map(n => n.id === id ? { ...n, snoozedUntil } : n);
    if (useSupabaseBackend) {
      requireSupabase().from('notifications').update({ snoozed_until: snoozedUntil }).eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to snooze notification', error);
      });
    } else {
      storage.set(KEY, notifications);
    }
    set({ notifications });
  },
}));
