import { create } from 'zustand';
import { uuidv4 } from '@/utils/id';
import type { PaymentRequest, PaymentApprovalStatus, PaymentStatus } from '@/types';
import { storage } from '@/services/storageService';
import { defaultPayments, DEMO_TENANT_ID } from '@/data/mockData';
import { recurringService } from '@/services/recurringService';
import { useAuthStore } from '@/stores/authStore';
import { useSupabaseBackend } from '@/config/runtime';
import { requireSupabase } from '@/services/supabaseClient';
import { paymentFromRow, paymentToInsert, paymentUpdatesToRow } from '@/services/supabaseMappers';

interface PaymentStore {
  payments: PaymentRequest[];
  init: () => Promise<void> | void;
  getWorkspacePayments: (workspaceId: string) => PaymentRequest[];
  addPayment: (payment: Omit<PaymentRequest, 'id' | 'createdAt' | 'updatedAt' | 'tenantId' | 'attachments'> & {
    tenantId?: string;
    attachments?: PaymentRequest['attachments'];
  }) => PaymentRequest;
  updatePayment: (id: string, updates: Partial<PaymentRequest>) => void;
  deletePayment: (id: string) => void;
  updateApprovalStatus: (id: string, status: PaymentApprovalStatus, approvedBy?: string) => void;
  markAsPaid: (id: string) => void;
  schedulePayment: (id: string, scheduledDate: string) => void;
  importPayments: (payments: PaymentRequest[]) => void;
}

const KEY = 'payments';

const normalisePayment = (payment: PaymentRequest): PaymentRequest => ({
  ...payment,
  attachments: payment.attachments ?? [],
  vatCode: payment.vatCode ?? 'S',
  vatBreakdown: payment.vatBreakdown ?? [],
});

export const usePaymentStore = create<PaymentStore>((set, get) => ({
  payments: [],

  async init() {
    if (useSupabaseBackend) {
      const { activeTenantId } = useAuthStore.getState();
      if (!activeTenantId) {
        set({ payments: [] });
        return;
      }

      const { data, error } = await requireSupabase()
        .from('payment_requests')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('due_date', { nullsFirst: false });

      if (error) {
        console.error('Failed to load payments', error);
        set({ payments: [] });
        return;
      }

      set({ payments: (data ?? []).map(paymentFromRow).map(normalisePayment) });
      return;
    }

    const raw = storage.get<PaymentRequest[] | null>(KEY, null);
    let payments = (raw ?? defaultPayments).map(normalisePayment);
    if (!raw) {
      storage.set(KEY, payments);
    } else {
      const needsMigration = payments.some(p => !p.tenantId || !p.attachments);
      if (needsMigration) {
        payments = payments.map(p => normalisePayment(p.tenantId ? p : { ...p, tenantId: DEMO_TENANT_ID }));
        storage.set(KEY, payments);
      }
    }
    set({ payments });
  },

  getWorkspacePayments(workspaceId) {
    const { activeTenantId } = useAuthStore.getState();
    return get().payments.filter(p =>
      p.workspaceId === workspaceId &&
      (!activeTenantId || p.tenantId === activeTenantId)
    );
  },

  addPayment(data) {
    const { activeTenantId } = useAuthStore.getState();
    const payment: PaymentRequest = {
      ...data,
      tenantId: data.tenantId || activeTenantId || '',
      attachments: data.attachments ?? [],
      id: useSupabaseBackend ? crypto.randomUUID() : `pr_${uuidv4().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const payments = [...get().payments, payment];
    if (useSupabaseBackend) {
      requireSupabase().from('payment_requests').insert(paymentToInsert(payment)).then(({ error }) => {
        if (error) console.error('Failed to create payment', error);
      });
    } else {
      storage.set(KEY, payments);
    }
    set({ payments });
    return payment;
  },

  updatePayment(id, updates) {
    const payments = get().payments.map(p =>
      p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    );
    if (useSupabaseBackend) {
      requireSupabase()
        .from('payment_requests')
        .update(paymentUpdatesToRow(updates))
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('Failed to update payment', error);
        });
    } else {
      storage.set(KEY, payments);
    }
    set({ payments });
  },

  deletePayment(id) {
    const payments = get().payments.filter(p => p.id !== id);
    if (useSupabaseBackend) {
      requireSupabase().from('payment_requests').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to delete payment', error);
      });
    } else {
      storage.set(KEY, payments);
    }
    set({ payments });
  },

  updateApprovalStatus(id, status, approvedBy) {
    const updates: Partial<PaymentRequest> = { approvalStatus: status };
    if (status === 'approved') {
      updates.approvedBy = approvedBy ?? 'Finance Manager';
      updates.approvedAt = new Date().toISOString();
    }
    get().updatePayment(id, updates);
  },

  markAsPaid(id) {
    const payment = get().payments.find(p => p.id === id);
    if (!payment) return;

    const updated: PaymentRequest = {
      ...payment,
      paymentStatus: 'paid' as PaymentStatus,
      paidAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let payments = get().payments.map(p => p.id === id ? updated : p);

    const next = recurringService.generateNextPaymentRequest(updated);
    if (next) payments = [...payments, next];

    if (useSupabaseBackend) {
      const supabase = requireSupabase();
      supabase
        .from('payment_requests')
        .update(paymentUpdatesToRow(updated))
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('Failed to mark payment paid', error);
        });

      if (next) {
        const nextPayment = { ...next, id: crypto.randomUUID() };
        payments = payments.map(p => p.id === next.id ? nextPayment : p);
        supabase.from('payment_requests').insert(paymentToInsert(nextPayment)).then(({ error }) => {
          if (error) console.error('Failed to create recurring payment', error);
        });
      }
    } else {
      storage.set(KEY, payments);
    }
    set({ payments });
  },

  schedulePayment(id, scheduledDate) {
    get().updatePayment(id, { paymentStatus: 'scheduled', scheduledDate });
  },

  importPayments(newPayments) {
    if (useSupabaseBackend) {
      const supabasePayments = newPayments.map(p => ({ ...p, id: crypto.randomUUID() }));
      const payments = [...get().payments, ...supabasePayments];
      requireSupabase()
        .from('payment_requests')
        .insert(supabasePayments.map(p => paymentToInsert(p)))
        .then(({ error }) => {
          if (error) console.error('Failed to import payments', error);
        });
      set({ payments });
    } else {
      const payments = [...get().payments, ...newPayments];
      storage.set(KEY, payments);
      set({ payments });
    }
  },
}));
