import { create } from 'zustand';
import { uuidv4 } from '@/utils/id';
import { storage } from '@/services/storageService';
import { useAuthStore } from '@/stores/authStore';
import { useSupabaseBackend } from '@/config/runtime';
import { requireSupabase } from '@/services/supabaseClient';
import {
  budgetCategoryFromRow,
  budgetCategoryToInsert,
  budgetCategoryUpdatesToRow,
  budgetProfileFromRow,
  budgetProfileToInsert,
  budgetProfileUpdatesToRow,
  budgetTransactionFromRow,
  budgetTransactionToInsert,
  budgetTransactionUpdatesToRow,
  monthlyBudgetFromRow,
  monthlyBudgetIncomeFromRow,
  monthlyBudgetIncomeToInsert,
  monthlyBudgetToInsert,
} from '@/services/supabaseMappers';
import type {
  BankStatementImportResult,
  BudgetCategory,
  BudgetProfile,
  BudgetTransaction,
  MonthlyBudget,
  MonthlyBudgetIncome,
} from '@/types';

const PROFILES_KEY = 'budget_profiles';
const CATEGORIES_KEY = 'budget_categories';
const BUDGETS_KEY = 'monthly_budgets';
const INCOME_KEY = 'monthly_budget_income';
const TRANSACTIONS_KEY = 'budget_transactions';

const DEFAULT_CATEGORIES = [
  { name: 'Groceries', colour: '#16a34a', keywords: ['tesco', 'sainsbury', 'asda', 'aldi', 'lidl', 'morrisons', 'waitrose', 'grocery'] },
  { name: 'Eating Out', colour: '#f97316', keywords: ['restaurant', 'cafe', 'coffee', 'deliveroo', 'ubereats', 'just eat', 'pret', 'mcdonald'] },
  { name: 'Transport', colour: '#0ea5e9', keywords: ['uber', 'train', 'rail', 'tfl', 'bus', 'parking', 'fuel', 'petrol', 'shell', 'bp'] },
  { name: 'Housing', colour: '#7c3aed', keywords: ['rent', 'mortgage', 'service charge', 'council tax'] },
  { name: 'Utilities', colour: '#0891b2', keywords: ['electric', 'gas', 'water', 'broadband', 'mobile', 'energy', 'utility'] },
  { name: 'Shopping', colour: '#db2777', keywords: ['amazon', 'argos', 'ebay', 'john lewis', 'next', 'zara'] },
  { name: 'Health', colour: '#dc2626', keywords: ['pharmacy', 'boots', 'dentist', 'doctor', 'optician', 'health'] },
  { name: 'Subscriptions', colour: '#4f46e5', keywords: ['netflix', 'spotify', 'prime', 'apple', 'google', 'subscription'] },
  { name: 'Savings', colour: '#65a30d', keywords: ['savings', 'isa', 'investment', 'vanguard'] },
  { name: 'Debt', colour: '#be123c', keywords: ['loan', 'credit card', 'card payment', 'mortgage', 'finance', 'repayment'] },
  { name: 'Other', colour: '#64748b', keywords: [] },
] as const;

interface BudgetStore {
  profiles: BudgetProfile[];
  categories: BudgetCategory[];
  budgets: MonthlyBudget[];
  incomes: MonthlyBudgetIncome[];
  transactions: BudgetTransaction[];
  init: () => Promise<void> | void;
  getWorkspaceProfiles: (workspaceId: string) => BudgetProfile[];
  addProfile: (workspaceId: string, name: string) => BudgetProfile;
  updateProfile: (id: string, updates: Partial<Pick<BudgetProfile, 'name' | 'colour' | 'includeInConsolidated'>>) => void;
  deleteProfile: (id: string) => void;
  getWorkspaceCategories: (workspaceId: string, budgetId: string) => BudgetCategory[];
  getMonthBudgets: (workspaceId: string, month: string, budgetId: string) => MonthlyBudget[];
  getEffectiveMonthBudgetAmount: (workspaceId: string, month: string, categoryId: string, budgetId: string) => number;
  getMonthIncome: (workspaceId: string, month: string, budgetId: string) => number;
  getEffectiveMonthIncome: (workspaceId: string, month: string, budgetId: string) => number;
  getMonthTransactions: (workspaceId: string, month: string, budgetId: string) => BudgetTransaction[];
  addCategory: (workspaceId: string, budgetId: string, data: Pick<BudgetCategory, 'name' | 'colour' | 'keywords'>) => BudgetCategory;
  updateCategory: (id: string, updates: Partial<Pick<BudgetCategory, 'name' | 'colour' | 'keywords'>>) => void;
  deleteCategory: (id: string) => void;
  setBudgetAmount: (workspaceId: string, month: string, categoryId: string, budgetId: string, amount: number) => void;
  setMonthIncome: (workspaceId: string, month: string, budgetId: string, amount: number) => void;
  addTransaction: (workspaceId: string, budgetId: string, data: Omit<BudgetTransaction, 'id' | 'tenantId' | 'workspaceId' | 'budgetId' | 'createdAt' | 'updatedAt'>) => BudgetTransaction;
  updateTransaction: (id: string, updates: Partial<BudgetTransaction>) => void;
  deleteTransaction: (id: string) => void;
  importStatementCsv: (workspaceId: string, budgetId: string, csvText: string, fileName?: string) => BankStatementImportResult;
}

const nowIso = () => new Date().toISOString();
const monthFromDate = (date: string) => date.slice(0, 7);
const defaultProfileId = (workspaceId: string) => `bp_default_${workspaceId}`;

const makeProfile = (
  workspaceId: string,
  tenantId: string,
  name: string,
  isDefault = false,
): BudgetProfile => ({
  id: isDefault ? defaultProfileId(workspaceId) : `bp_${uuidv4().slice(0, 8)}`,
  tenantId,
  workspaceId,
  name: name.trim(),
  colour: isDefault ? '#0f766e' : '#6366f1',
  isDefault,
  includeInConsolidated: true,
  createdAt: nowIso(),
  updatedAt: nowIso(),
});

const makeCategory = (
  workspaceId: string,
  budgetId: string,
  tenantId: string,
  data: Pick<BudgetCategory, 'name' | 'colour'> & { keywords: readonly string[]; isDefault?: boolean },
): BudgetCategory => ({
  id: `bc_${uuidv4().slice(0, 8)}`,
  tenantId,
  workspaceId,
  budgetId,
  name: data.name.trim(),
  colour: data.colour,
  keywords: data.keywords.map(k => k.trim().toLowerCase()).filter(Boolean),
  isDefault: data.isDefault ?? false,
  createdAt: nowIso(),
  updatedAt: nowIso(),
});

const splitCsvLine = (line: string) => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
};

const parseCsv = (csvText: string) => {
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return { headers: [], rows: [] as Record<string, string>[] };

  const headers = splitCsvLine(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });

  return { headers, rows };
};

const findHeader = (headers: string[], candidates: string[]) => {
  const normalised = headers.map(header => ({
    original: header,
    key: header.toLowerCase().replace(/[^a-z0-9]/g, ''),
  }));

  return normalised.find(header =>
    candidates.some(candidate => header.key === candidate || header.key.includes(candidate))
  )?.original;
};

const parseDate = (value: string) => {
  if (!value) return null;
  const trimmed = value.trim();
  const iso = new Date(trimmed);
  if (!Number.isNaN(iso.getTime())) return iso.toISOString().slice(0, 10);

  const ukMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!ukMatch) return null;

  const day = ukMatch[1].padStart(2, '0');
  const month = ukMatch[2].padStart(2, '0');
  const year = ukMatch[3].length === 2 ? `20${ukMatch[3]}` : ukMatch[3];
  const parsed = new Date(`${year}-${month}-${day}`);
  return Number.isNaN(parsed.getTime()) ? null : `${year}-${month}-${day}`;
};

const parseMoney = (value: string) => {
  if (!value) return null;
  const isWrappedNegative = /^\(.*\)$/.test(value.trim());
  const cleaned = value.replace(/[\u00A3$,\s()]/g, '');
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return isWrappedNegative ? -parsed : parsed;
};

const inferCategoryId = (description: string, categories: BudgetCategory[]) => {
  const text = description.toLowerCase();
  const matched = categories.find(category =>
    category.keywords.some(keyword => keyword && text.includes(keyword))
  );
  return matched?.id ?? categories.find(category => category.name === 'Other')?.id ?? null;
};

export const useBudgetStore = create<BudgetStore>((set, get) => ({
  profiles: [],
  categories: [],
  budgets: [],
  incomes: [],
  transactions: [],

  async init() {
    if (useSupabaseBackend) {
      const { activeTenantId } = useAuthStore.getState();
      if (!activeTenantId) {
        set({ profiles: [], categories: [], budgets: [], incomes: [], transactions: [] });
        return;
      }

      const supabase = requireSupabase();
      const [
        { data: profileRows, error: profileError },
        { data: categoryRows, error: categoryError },
        { data: budgetRows, error: budgetError },
        { data: incomeRows, error: incomeError },
        { data: transactionRows, error: transactionError },
      ] = await Promise.all([
        supabase.from('budget_profiles').select('*').eq('tenant_id', activeTenantId).order('created_at'),
        supabase.from('budget_categories').select('*').eq('tenant_id', activeTenantId).order('name'),
        supabase.from('monthly_budgets').select('*').eq('tenant_id', activeTenantId).order('month'),
        supabase.from('monthly_budget_income').select('*').eq('tenant_id', activeTenantId).order('month'),
        supabase.from('budget_transactions').select('*').eq('tenant_id', activeTenantId).order('date', { ascending: false }),
      ]);

      const error = profileError || categoryError || budgetError || incomeError || transactionError;
      if (error) {
        console.error('Failed to load budgets', error);
        set({ profiles: [], categories: [], budgets: [], incomes: [], transactions: [] });
        return;
      }

      set({
        profiles: (profileRows ?? []).map(budgetProfileFromRow),
        categories: (categoryRows ?? []).map(budgetCategoryFromRow),
        budgets: (budgetRows ?? []).map(monthlyBudgetFromRow),
        incomes: (incomeRows ?? []).map(monthlyBudgetIncomeFromRow),
        transactions: (transactionRows ?? []).map(budgetTransactionFromRow),
      });
      return;
    }

    const transactions = storage.get<BudgetTransaction[]>(TRANSACTIONS_KEY, []).map(transaction => ({
      ...transaction,
      direction: transaction.direction ?? 'payment',
      debtAllocation: transaction.debtAllocation ?? null,
    }));
    set({
      profiles: storage.get<BudgetProfile[]>(PROFILES_KEY, []),
      categories: storage.get<BudgetCategory[]>(CATEGORIES_KEY, []),
      budgets: storage.get<MonthlyBudget[]>(BUDGETS_KEY, []),
      incomes: storage.get<MonthlyBudgetIncome[]>(INCOME_KEY, []),
      transactions,
    });
  },

  getWorkspaceProfiles(workspaceId) {
    const { activeTenantId } = useAuthStore.getState();
    if (!workspaceId || !activeTenantId) return [];

    let profiles = get().profiles.filter(profile =>
      profile.workspaceId === workspaceId && profile.tenantId === activeTenantId
    );

    if (profiles.length === 0) {
      const defaultProfile = makeProfile(workspaceId, activeTenantId, 'Main Budget', true);
      profiles = [defaultProfile];
      const allProfiles = [...get().profiles, defaultProfile];
      const categories = get().categories.map(category =>
        category.workspaceId === workspaceId && !category.budgetId
          ? { ...category, budgetId: defaultProfile.id }
          : category
      );
      const budgets = get().budgets.map(budget =>
        budget.workspaceId === workspaceId && !budget.budgetId
          ? { ...budget, budgetId: defaultProfile.id }
          : budget
      );
      const incomes = get().incomes.map(income =>
        income.workspaceId === workspaceId && !income.budgetId
          ? { ...income, budgetId: defaultProfile.id }
          : income
      );
      const transactions = get().transactions.map(transaction =>
        transaction.workspaceId === workspaceId && !transaction.budgetId
          ? { ...transaction, budgetId: defaultProfile.id }
          : transaction
      );

      if (useSupabaseBackend) {
        requireSupabase().from('budget_profiles').insert(budgetProfileToInsert(defaultProfile)).then(({ error }) => {
          if (error) console.error('Failed to create default budget profile', error);
        });
      } else {
        storage.set(PROFILES_KEY, allProfiles);
        storage.set(CATEGORIES_KEY, categories);
        storage.set(BUDGETS_KEY, budgets);
        storage.set(INCOME_KEY, incomes);
        storage.set(TRANSACTIONS_KEY, transactions);
      }
      set({ profiles: allProfiles, categories, budgets, incomes, transactions });
    }

    return profiles;
  },

  addProfile(workspaceId, name) {
    const { activeTenantId } = useAuthStore.getState();
    const profile = makeProfile(workspaceId, activeTenantId ?? '', name || 'New Budget');
    const profiles = [...get().profiles, profile];
    const categories = [
      ...get().categories,
      ...DEFAULT_CATEGORIES.map(category =>
        makeCategory(workspaceId, profile.id, activeTenantId ?? '', { ...category, isDefault: true })
      ),
    ];
    if (useSupabaseBackend) {
      const createdCategories = categories.filter(category => category.budgetId === profile.id);
      requireSupabase()
        .from('budget_profiles')
        .insert(budgetProfileToInsert(profile))
        .then(({ error }) => {
          if (error) console.error('Failed to create budget profile', error);
        });
      requireSupabase()
        .from('budget_categories')
        .insert(createdCategories.map(budgetCategoryToInsert))
        .then(({ error }) => {
          if (error) console.error('Failed to create default budget categories', error);
        });
    } else {
      storage.set(PROFILES_KEY, profiles);
      storage.set(CATEGORIES_KEY, categories);
    }
    set({ profiles, categories });
    return profile;
  },

  updateProfile(id, updates) {
    const profiles = get().profiles.map(profile =>
      profile.id === id
        ? {
            ...profile,
            ...updates,
            name: updates.name ?? profile.name,
            updatedAt: nowIso(),
          }
        : profile
    );
    if (useSupabaseBackend) {
      requireSupabase().from('budget_profiles').update(budgetProfileUpdatesToRow(updates)).eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to update budget profile', error);
      });
    } else {
      storage.set(PROFILES_KEY, profiles);
    }
    set({ profiles });
  },

  deleteProfile(id) {
    const profile = get().profiles.find(item => item.id === id);
    if (!profile || profile.isDefault) return;

    const profiles = get().profiles.filter(item => item.id !== id);
    const categories = get().categories.filter(item => item.budgetId !== id);
    const budgets = get().budgets.filter(item => item.budgetId !== id);
    const incomes = get().incomes.filter(item => item.budgetId !== id);
    const transactions = get().transactions.filter(item => item.budgetId !== id);
    if (useSupabaseBackend) {
      requireSupabase().from('budget_profiles').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to delete budget profile', error);
      });
    } else {
      storage.set(PROFILES_KEY, profiles);
      storage.set(CATEGORIES_KEY, categories);
      storage.set(BUDGETS_KEY, budgets);
      storage.set(INCOME_KEY, incomes);
      storage.set(TRANSACTIONS_KEY, transactions);
    }
    set({ profiles, categories, budgets, incomes, transactions });
  },

  getWorkspaceCategories(workspaceId, budgetId) {
    const { activeTenantId } = useAuthStore.getState();
    let categories = get().categories.filter(c =>
      c.workspaceId === workspaceId &&
      c.budgetId === budgetId &&
      (!activeTenantId || c.tenantId === activeTenantId)
    );

    if (workspaceId && budgetId && activeTenantId && categories.length === 0) {
      categories = DEFAULT_CATEGORIES.map(category =>
        makeCategory(workspaceId, budgetId, activeTenantId, { ...category, isDefault: true })
      );
      const next = [...get().categories, ...categories];
      if (useSupabaseBackend) {
        requireSupabase()
          .from('budget_categories')
          .insert(categories.map(budgetCategoryToInsert))
          .then(({ error }) => {
            if (error) console.error('Failed to create default budget categories', error);
          });
      } else {
        storage.set(CATEGORIES_KEY, next);
      }
      set({ categories: next });
    } else if (workspaceId && budgetId && activeTenantId) {
      const existingNames = new Set(categories.map(category => category.name.toLowerCase()));
      const missingDefaults = DEFAULT_CATEGORIES.filter(category => !existingNames.has(category.name.toLowerCase()));
      if (missingDefaults.length > 0) {
        const additions = missingDefaults.map(category =>
          makeCategory(workspaceId, budgetId, activeTenantId, { ...category, isDefault: true })
        );
        categories = [...categories, ...additions];
        const next = [...get().categories, ...additions];
        if (useSupabaseBackend) {
          requireSupabase()
            .from('budget_categories')
            .insert(additions.map(budgetCategoryToInsert))
            .then(({ error }) => {
              if (error) console.error('Failed to add missing budget categories', error);
            });
        } else {
          storage.set(CATEGORIES_KEY, next);
        }
        set({ categories: next });
      }
    }

    return categories;
  },

  getMonthBudgets(workspaceId, month, budgetId) {
    const { activeTenantId } = useAuthStore.getState();
    return get().budgets.filter(b =>
      b.workspaceId === workspaceId &&
      b.budgetId === budgetId &&
      b.month === month &&
      (!activeTenantId || b.tenantId === activeTenantId)
    );
  },

  getEffectiveMonthBudgetAmount(workspaceId, month, categoryId, budgetId) {
    const { activeTenantId } = useAuthStore.getState();
    const matchingBudgets = get().budgets
      .filter(budget =>
        budget.workspaceId === workspaceId &&
        budget.budgetId === budgetId &&
        budget.categoryId === categoryId &&
        budget.month <= month &&
        (!activeTenantId || budget.tenantId === activeTenantId)
      )
      .sort((a, b) => b.month.localeCompare(a.month));

    return matchingBudgets[0]?.amount ?? 0;
  },

  getMonthIncome(workspaceId, month, budgetId) {
    const { activeTenantId } = useAuthStore.getState();
    return get().incomes.find(income =>
      income.workspaceId === workspaceId &&
      income.budgetId === budgetId &&
      income.month === month &&
      (!activeTenantId || income.tenantId === activeTenantId)
    )?.amount ?? 0;
  },

  getEffectiveMonthIncome(workspaceId, month, budgetId) {
    const { activeTenantId } = useAuthStore.getState();
    const matchingIncomes = get().incomes
      .filter(income =>
        income.workspaceId === workspaceId &&
        income.budgetId === budgetId &&
        income.month <= month &&
        (!activeTenantId || income.tenantId === activeTenantId)
      )
      .sort((a, b) => b.month.localeCompare(a.month));

    return matchingIncomes[0]?.amount ?? 0;
  },

  getMonthTransactions(workspaceId, month, budgetId) {
    const { activeTenantId } = useAuthStore.getState();
    return get().transactions
      .filter(t =>
        t.workspaceId === workspaceId &&
        t.budgetId === budgetId &&
        monthFromDate(t.date) === month &&
        (!activeTenantId || t.tenantId === activeTenantId)
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  addCategory(workspaceId, budgetId, data) {
    const { activeTenantId } = useAuthStore.getState();
    const category = makeCategory(workspaceId, budgetId, activeTenantId ?? '', data);
    const categories = [...get().categories, category];
    if (useSupabaseBackend) {
      requireSupabase().from('budget_categories').insert(budgetCategoryToInsert(category)).then(({ error }) => {
        if (error) console.error('Failed to create budget category', error);
      });
    } else {
      storage.set(CATEGORIES_KEY, categories);
    }
    set({ categories });
    return category;
  },

  updateCategory(id, updates) {
    const categories = get().categories.map(category =>
      category.id === id
        ? {
            ...category,
            ...updates,
            name: updates.name ?? category.name,
            keywords: updates.keywords?.map(k => k.trim().toLowerCase()).filter(Boolean) ?? category.keywords,
            updatedAt: nowIso(),
          }
        : category
    );
    if (useSupabaseBackend) {
      const updated = categories.find(category => category.id === id);
      requireSupabase()
        .from('budget_categories')
        .update(budgetCategoryUpdatesToRow(updated ?? updates))
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('Failed to update budget category', error);
        });
    } else {
      storage.set(CATEGORIES_KEY, categories);
    }
    set({ categories });
  },

  deleteCategory(id) {
    const categories = get().categories.filter(category => category.id !== id);
    const budgets = get().budgets.filter(budget => budget.categoryId !== id);
    const transactions = get().transactions.map(transaction =>
      transaction.categoryId === id ? { ...transaction, categoryId: null, updatedAt: nowIso() } : transaction
    );
    if (useSupabaseBackend) {
      requireSupabase().from('budget_categories').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to delete budget category', error);
      });
    } else {
      storage.set(CATEGORIES_KEY, categories);
      storage.set(BUDGETS_KEY, budgets);
      storage.set(TRANSACTIONS_KEY, transactions);
    }
    set({ categories, budgets, transactions });
  },

  setBudgetAmount(workspaceId, month, categoryId, budgetId, amount) {
    const { activeTenantId } = useAuthStore.getState();
    const existing = get().budgets.find(b =>
      b.workspaceId === workspaceId && b.budgetId === budgetId && b.month === month && b.categoryId === categoryId
    );
    const budgets = existing
      ? get().budgets.map(b => b.id === existing.id ? { ...b, amount, updatedAt: nowIso() } : b)
      : [
          ...get().budgets,
          {
            id: `mb_${uuidv4().slice(0, 8)}`,
            tenantId: activeTenantId ?? '',
            workspaceId,
            budgetId,
            month,
            categoryId,
            amount,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          },
        ];
    if (useSupabaseBackend) {
      const budget = budgets.find(item =>
        item.workspaceId === workspaceId &&
        item.budgetId === budgetId &&
        item.month === month &&
        item.categoryId === categoryId
      );
      if (budget) {
        requireSupabase()
          .from('monthly_budgets')
          .upsert(monthlyBudgetToInsert(budget), { onConflict: 'budget_id,month,category_id' })
          .then(({ error }) => {
            if (error) console.error('Failed to save monthly budget', error);
          });
      }
    } else {
      storage.set(BUDGETS_KEY, budgets);
    }
    set({ budgets });
  },

  setMonthIncome(workspaceId, month, budgetId, amount) {
    const { activeTenantId } = useAuthStore.getState();
    const existing = get().incomes.find(income =>
      income.workspaceId === workspaceId && income.budgetId === budgetId && income.month === month
    );
    const incomes = existing
      ? get().incomes.map(income => income.id === existing.id ? { ...income, amount, updatedAt: nowIso() } : income)
      : [
          ...get().incomes,
          {
            id: `mi_${uuidv4().slice(0, 8)}`,
            tenantId: activeTenantId ?? '',
            workspaceId,
            budgetId,
            month,
            amount,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          },
        ];
    if (useSupabaseBackend) {
      const income = incomes.find(item =>
        item.workspaceId === workspaceId && item.budgetId === budgetId && item.month === month
      );
      if (income) {
        requireSupabase()
          .from('monthly_budget_income')
          .upsert(monthlyBudgetIncomeToInsert(income), { onConflict: 'budget_id,month' })
          .then(({ error }) => {
            if (error) console.error('Failed to save monthly budget income', error);
          });
      }
    } else {
      storage.set(INCOME_KEY, incomes);
    }
    set({ incomes });
  },

  addTransaction(workspaceId, budgetId, data) {
    const { activeTenantId } = useAuthStore.getState();
    const transaction: BudgetTransaction = {
      ...data,
      id: `bt_${uuidv4().slice(0, 8)}`,
      tenantId: activeTenantId ?? '',
      workspaceId,
      budgetId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const transactions = [...get().transactions, transaction];
    if (useSupabaseBackend) {
      requireSupabase().from('budget_transactions').insert(budgetTransactionToInsert(transaction)).then(({ error }) => {
        if (error) console.error('Failed to create budget transaction', error);
      });
    } else {
      storage.set(TRANSACTIONS_KEY, transactions);
    }
    set({ transactions });
    return transaction;
  },

  updateTransaction(id, updates) {
    const transactions = get().transactions.map(transaction =>
      transaction.id === id ? { ...transaction, ...updates, updatedAt: nowIso() } : transaction
    );
    if (useSupabaseBackend) {
      requireSupabase().from('budget_transactions').update(budgetTransactionUpdatesToRow(updates)).eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to update budget transaction', error);
      });
    } else {
      storage.set(TRANSACTIONS_KEY, transactions);
    }
    set({ transactions });
  },

  deleteTransaction(id) {
    const transactions = get().transactions.filter(transaction => transaction.id !== id);
    if (useSupabaseBackend) {
      requireSupabase().from('budget_transactions').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to delete budget transaction', error);
      });
    } else {
      storage.set(TRANSACTIONS_KEY, transactions);
    }
    set({ transactions });
  },

  importStatementCsv(workspaceId, budgetId, csvText, fileName) {
    const { activeTenantId } = useAuthStore.getState();
    const { headers, rows } = parseCsv(csvText);
    const errors: string[] = [];
    if (headers.length === 0) {
      return { imported: 0, skipped: 0, errors: ['No rows found in the CSV file.'] };
    }

    const dateHeader = findHeader(headers, ['date', 'transactiondate', 'posteddate']);
    const descriptionHeader = findHeader(headers, ['description', 'details', 'merchant', 'narrative', 'transactiondescription']);
    const amountHeader = findHeader(headers, ['amount', 'value', 'transactionamount']);
    const debitHeader = findHeader(headers, ['debit', 'withdrawal', 'paidout', 'moneyout']);
    const creditHeader = findHeader(headers, ['credit', 'deposit', 'paidin', 'moneyin']);

    if (!dateHeader || !descriptionHeader || (!amountHeader && !debitHeader && !creditHeader)) {
      return {
        imported: 0,
        skipped: rows.length,
        errors: ['CSV needs date, description, and amount columns. Debit/credit columns are also supported.'],
      };
    }

    const categories = get().getWorkspaceCategories(workspaceId, budgetId);
    const importBatchId = `bi_${uuidv4().slice(0, 8)}`;
    const importedTransactions: BudgetTransaction[] = [];

    rows.forEach((row, index) => {
      const date = parseDate(row[dateHeader]);
      const description = row[descriptionHeader]?.trim() ?? '';
      const amountValue = amountHeader
        ? parseMoney(row[amountHeader])
        : (parseMoney(row[debitHeader ?? '']) ?? 0) - (parseMoney(row[creditHeader ?? '']) ?? 0);

      if (!date || !description || amountValue === null || amountValue === 0) {
        errors.push(`Row ${index + 2}: Missing or invalid date, description, or amount.`);
        return;
      }

      importedTransactions.push({
        id: `bt_${uuidv4().slice(0, 8)}`,
        tenantId: activeTenantId ?? '',
        workspaceId,
        budgetId,
        date,
        description,
        amount: Math.abs(amountValue),
        direction: amountValue < 0 ? 'receipt' : 'payment',
        categoryId: inferCategoryId(description, categories),
        debtAllocation: null,
        source: 'import',
        importBatchId: fileName ? `${importBatchId}_${fileName}` : importBatchId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

    const transactions = [...get().transactions, ...importedTransactions];
    if (useSupabaseBackend) {
      requireSupabase()
        .from('budget_transactions')
        .insert(importedTransactions.map(budgetTransactionToInsert))
        .then(({ error }) => {
          if (error) console.error('Failed to import budget transactions', error);
        });
    } else {
      storage.set(TRANSACTIONS_KEY, transactions);
    }
    set({ transactions });

    return {
      imported: importedTransactions.length,
      skipped: errors.length,
      errors,
    };
  },
}));
