import { create } from 'zustand';
import { uuidv4 } from '@/utils/id';
import { storage } from '@/services/storageService';
import { useAuthStore } from '@/stores/authStore';
import type {
  DebtAccount,
  DebtBalanceSnapshot,
  DebtGroup,
  DebtRepayment,
} from '@/types';

const GROUPS_KEY = 'debt_groups';
const ACCOUNTS_KEY = 'debt_accounts';
const REPAYMENTS_KEY = 'debt_repayments';
const BALANCES_KEY = 'debt_balance_snapshots';

interface DebtStore {
  groups: DebtGroup[];
  accounts: DebtAccount[];
  repayments: DebtRepayment[];
  balances: DebtBalanceSnapshot[];
  init: () => void;
  getWorkspaceGroups: (workspaceId: string) => DebtGroup[];
  addGroup: (workspaceId: string, name: string) => DebtGroup;
  updateGroup: (id: string, updates: Partial<Pick<DebtGroup, 'name' | 'colour' | 'includeInConsolidated'>>) => void;
  deleteGroup: (id: string) => void;
  getGroupAccounts: (workspaceId: string, groupId: string) => DebtAccount[];
  getIncludedAccounts: (workspaceId: string) => DebtAccount[];
  addAccount: (workspaceId: string, groupId: string, data: Omit<DebtAccount, 'id' | 'tenantId' | 'workspaceId' | 'groupId' | 'createdAt' | 'updatedAt'>) => DebtAccount;
  updateAccount: (id: string, updates: Partial<DebtAccount>) => void;
  deleteAccount: (id: string) => void;
  addRepayment: (workspaceId: string, groupId: string, debtId: string, data: Pick<DebtRepayment, 'date' | 'amount' | 'notes' | 'sourceTransactionId'>) => DebtRepayment;
  addBalanceSnapshot: (workspaceId: string, groupId: string, debtId: string, data: Pick<DebtBalanceSnapshot, 'date' | 'balance' | 'notes' | 'sourceTransactionId'>) => DebtBalanceSnapshot;
  getDebtRepayments: (debtId: string) => DebtRepayment[];
  getDebtBalances: (debtId: string) => DebtBalanceSnapshot[];
  getCurrentBalance: (debt: DebtAccount) => number;
}

const nowIso = () => new Date().toISOString();
const defaultGroupId = (workspaceId: string) => `dg_default_${workspaceId}`;

const makeGroup = (workspaceId: string, tenantId: string, name: string, isDefault = false): DebtGroup => ({
  id: isDefault ? defaultGroupId(workspaceId) : `dg_${uuidv4().slice(0, 8)}`,
  tenantId,
  workspaceId,
  name: name.trim(),
  colour: isDefault ? '#7c3aed' : '#0f766e',
  isDefault,
  includeInConsolidated: true,
  createdAt: nowIso(),
  updatedAt: nowIso(),
});

export const useDebtStore = create<DebtStore>((set, get) => ({
  groups: [],
  accounts: [],
  repayments: [],
  balances: [],

  init() {
    set({
      groups: storage.get<DebtGroup[]>(GROUPS_KEY, []),
      accounts: storage.get<DebtAccount[]>(ACCOUNTS_KEY, []),
      repayments: storage.get<DebtRepayment[]>(REPAYMENTS_KEY, []),
      balances: storage.get<DebtBalanceSnapshot[]>(BALANCES_KEY, []),
    });
  },

  getWorkspaceGroups(workspaceId) {
    const { activeTenantId } = useAuthStore.getState();
    if (!workspaceId || !activeTenantId) return [];

    let groups = get().groups.filter(group =>
      group.workspaceId === workspaceId && group.tenantId === activeTenantId
    );

    if (groups.length === 0) {
      const defaultGroup = makeGroup(workspaceId, activeTenantId, 'Main Debts', true);
      groups = [defaultGroup];
      const allGroups = [...get().groups, defaultGroup];
      const accounts = get().accounts.map(account =>
        account.workspaceId === workspaceId && !account.groupId ? { ...account, groupId: defaultGroup.id } : account
      );
      const repayments = get().repayments.map(repayment =>
        repayment.workspaceId === workspaceId && !repayment.groupId ? { ...repayment, groupId: defaultGroup.id } : repayment
      );
      const balances = get().balances.map(balance =>
        balance.workspaceId === workspaceId && !balance.groupId ? { ...balance, groupId: defaultGroup.id } : balance
      );

      storage.set(GROUPS_KEY, allGroups);
      storage.set(ACCOUNTS_KEY, accounts);
      storage.set(REPAYMENTS_KEY, repayments);
      storage.set(BALANCES_KEY, balances);
      set({ groups: allGroups, accounts, repayments, balances });
    }

    return groups;
  },

  addGroup(workspaceId, name) {
    const { activeTenantId } = useAuthStore.getState();
    const group = makeGroup(workspaceId, activeTenantId ?? '', name || 'New Debt Group');
    const groups = [...get().groups, group];
    storage.set(GROUPS_KEY, groups);
    set({ groups });
    return group;
  },

  updateGroup(id, updates) {
    const groups = get().groups.map(group =>
      group.id === id
        ? { ...group, ...updates, name: updates.name ?? group.name, updatedAt: nowIso() }
        : group
    );
    storage.set(GROUPS_KEY, groups);
    set({ groups });
  },

  deleteGroup(id) {
    const group = get().groups.find(item => item.id === id);
    if (!group || group.isDefault) return;
    const groups = get().groups.filter(item => item.id !== id);
    const accountIds = get().accounts.filter(account => account.groupId === id).map(account => account.id);
    const accounts = get().accounts.filter(account => account.groupId !== id);
    const repayments = get().repayments.filter(repayment => !accountIds.includes(repayment.debtId));
    const balances = get().balances.filter(balance => !accountIds.includes(balance.debtId));
    storage.set(GROUPS_KEY, groups);
    storage.set(ACCOUNTS_KEY, accounts);
    storage.set(REPAYMENTS_KEY, repayments);
    storage.set(BALANCES_KEY, balances);
    set({ groups, accounts, repayments, balances });
  },

  getGroupAccounts(workspaceId, groupId) {
    const { activeTenantId } = useAuthStore.getState();
    return get().accounts.filter(account =>
      account.workspaceId === workspaceId &&
      account.groupId === groupId &&
      (!activeTenantId || account.tenantId === activeTenantId)
    );
  },

  getIncludedAccounts(workspaceId) {
    const includedGroupIds = get().getWorkspaceGroups(workspaceId)
      .filter(group => group.includeInConsolidated)
      .map(group => group.id);
    const { activeTenantId } = useAuthStore.getState();
    return get().accounts.filter(account =>
      account.workspaceId === workspaceId &&
      includedGroupIds.includes(account.groupId) &&
      (!activeTenantId || account.tenantId === activeTenantId)
    );
  },

  addAccount(workspaceId, groupId, data) {
    const { activeTenantId } = useAuthStore.getState();
    const account: DebtAccount = {
      ...data,
      id: `debt_${uuidv4().slice(0, 8)}`,
      tenantId: activeTenantId ?? '',
      workspaceId,
      groupId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const accounts = [...get().accounts, account];
    storage.set(ACCOUNTS_KEY, accounts);
    set({ accounts });
    return account;
  },

  updateAccount(id, updates) {
    const accounts = get().accounts.map(account =>
      account.id === id ? { ...account, ...updates, updatedAt: nowIso() } : account
    );
    storage.set(ACCOUNTS_KEY, accounts);
    set({ accounts });
  },

  deleteAccount(id) {
    const accounts = get().accounts.filter(account => account.id !== id);
    const repayments = get().repayments.filter(repayment => repayment.debtId !== id);
    const balances = get().balances.filter(balance => balance.debtId !== id);
    storage.set(ACCOUNTS_KEY, accounts);
    storage.set(REPAYMENTS_KEY, repayments);
    storage.set(BALANCES_KEY, balances);
    set({ accounts, repayments, balances });
  },

  addRepayment(workspaceId, groupId, debtId, data) {
    const { activeTenantId } = useAuthStore.getState();
    const repayment: DebtRepayment = {
      ...data,
      id: `dr_${uuidv4().slice(0, 8)}`,
      tenantId: activeTenantId ?? '',
      workspaceId,
      groupId,
      debtId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const repayments = [...get().repayments, repayment];
    storage.set(REPAYMENTS_KEY, repayments);
    set({ repayments });
    return repayment;
  },

  addBalanceSnapshot(workspaceId, groupId, debtId, data) {
    const { activeTenantId } = useAuthStore.getState();
    const snapshot: DebtBalanceSnapshot = {
      ...data,
      id: `db_${uuidv4().slice(0, 8)}`,
      tenantId: activeTenantId ?? '',
      workspaceId,
      groupId,
      debtId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const balances = [...get().balances, snapshot];
    storage.set(BALANCES_KEY, balances);
    set({ balances });
    return snapshot;
  },

  getDebtRepayments(debtId) {
    return get().repayments
      .filter(repayment => repayment.debtId === debtId)
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  getDebtBalances(debtId) {
    return get().balances
      .filter(balance => balance.debtId === debtId)
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  getCurrentBalance(debt) {
    const latestSnapshot = get().getDebtBalances(debt.id)[0];
    if (latestSnapshot) return latestSnapshot.balance;
    const repaid = get().repayments
      .filter(repayment => repayment.debtId === debt.id)
      .reduce((sum, repayment) => sum + repayment.amount, 0);
    return Math.max(0, debt.openingBalance - repaid);
  },
}));
