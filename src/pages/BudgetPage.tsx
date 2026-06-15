import { useMemo, useRef, useState } from 'react';
import { AlertCircle, Plus, Trash2, Upload, WalletCards } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useBudgetStore } from '@/stores/budgetStore';
import { useDebtStore } from '@/stores/debtStore';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { Input, Select } from '@/components/common/Input';
import { formatCurrency } from '@/utils/dateUtils';
import { cn } from '@/utils/cn';
import type { BudgetCategory, BudgetProfile, BudgetTransaction, DebtAccount, DebtGroup } from '@/types';

const CONSOLIDATED_ID = 'consolidated';
const currentMonth = () => new Date().toISOString().slice(0, 7);

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

const keywordText = (category: BudgetCategory) => category.keywords.join(', ');
const transactionSignedAmount = (transaction: BudgetTransaction) =>
  (transaction.direction ?? 'payment') === 'receipt' ? -transaction.amount : transaction.amount;

interface BudgetRow {
  key: string;
  label: string;
  colour: string;
  budget: number;
  actual: number;
  variance: number;
  isCarriedForward: boolean;
  category?: BudgetCategory;
}

export function BudgetPage() {
  const { activeWorkspace } = useWorkspaceStore();
  const {
    getWorkspaceProfiles,
    addProfile,
    updateProfile,
    deleteProfile,
    getWorkspaceCategories,
    getMonthBudgets,
    getEffectiveMonthBudgetAmount,
    getMonthIncome,
    getEffectiveMonthIncome,
    getMonthTransactions,
    addCategory,
    updateCategory,
    deleteCategory,
    setBudgetAmount,
    setMonthIncome,
    updateTransaction,
    deleteTransaction,
    importStatementCsv,
  } = useBudgetStore();
  const {
    getWorkspaceGroups,
    getGroupAccounts,
    getCurrentBalance,
    addAccount,
    addRepayment,
    addBalanceSnapshot,
  } = useDebtStore();

  const fileRef = useRef<HTMLInputElement>(null);
  const [month, setMonth] = useState(currentMonth());
  const [selectedBudgetId, setSelectedBudgetId] = useState(CONSOLIDATED_ID);
  const [newBudgetName, setNewBudgetName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryKeywords, setNewCategoryKeywords] = useState('');
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [allocatingTransactionId, setAllocatingTransactionId] = useState<string | null>(null);

  const wsId = activeWorkspace?.id ?? '';
  const currency = activeWorkspace?.currency ?? 'GBP';
  const isPersonal = activeWorkspace?.type === 'personal';
  const profiles = getWorkspaceProfiles(wsId);
  const includedProfiles = profiles.filter(profile => profile.includeInConsolidated);
  const selectedProfile = profiles.find(profile => profile.id === selectedBudgetId) ?? profiles[0] ?? null;
  const isConsolidated = selectedBudgetId === CONSOLIDATED_ID;
  const editableProfile = isConsolidated ? null : selectedProfile;
  const editableBudgetId = editableProfile?.id ?? '';

  const categories = editableProfile ? getWorkspaceCategories(wsId, editableProfile.id) : [];
  const debtCategoryId = categories.find(category => category.name.toLowerCase() === 'debt')?.id ?? null;
  const debtGroups = getWorkspaceGroups(wsId);
  const debtAccounts = debtGroups.flatMap(group => getGroupAccounts(wsId, group.id));
  const budgets = editableProfile ? getMonthBudgets(wsId, month, editableProfile.id) : [];
  const transactions = editableProfile ? getMonthTransactions(wsId, month, editableProfile.id) : [];
  const explicitMonthlyIncome = editableProfile ? getMonthIncome(wsId, month, editableProfile.id) : 0;
  const monthlyIncome = editableProfile ? getEffectiveMonthIncome(wsId, month, editableProfile.id) : 0;
  const isIncomeCarriedForward = Boolean(editableProfile && !explicitMonthlyIncome && monthlyIncome > 0);

  const categoryRows = useMemo<BudgetRow[]>(() => {
    if (isConsolidated) {
      const rows = new Map<string, BudgetRow>();

      includedProfiles.forEach(profile => {
        const profileCategories = getWorkspaceCategories(wsId, profile.id);
        const profileBudgets = getMonthBudgets(wsId, month, profile.id);
        const profileTransactions = getMonthTransactions(wsId, month, profile.id);

        profileCategories.forEach(category => {
          const key = category.name.toLowerCase();
          const explicitBudget = profileBudgets.find(b => b.categoryId === category.id);
          const budget = explicitBudget?.amount ?? getEffectiveMonthBudgetAmount(wsId, month, category.id, profile.id);
          const actual = profileTransactions
            .filter(transaction => transaction.categoryId === category.id)
            .reduce((sum, transaction) => sum + transactionSignedAmount(transaction), 0);
          const existing = rows.get(key);

          rows.set(key, {
            key,
            label: category.name,
            colour: existing?.colour ?? category.colour,
            budget: (existing?.budget ?? 0) + budget,
            actual: (existing?.actual ?? 0) + actual,
            variance: (existing?.budget ?? 0) + budget - ((existing?.actual ?? 0) + actual),
            isCarriedForward: Boolean(existing?.isCarriedForward || (!explicitBudget && budget > 0)),
          });
        });
      });

      return Array.from(rows.values()).sort((a, b) => a.label.localeCompare(b.label));
    }

    return categories.map(category => {
      const explicitBudget = budgets.find(b => b.categoryId === category.id);
      const budget = explicitBudget?.amount ?? getEffectiveMonthBudgetAmount(wsId, month, category.id, editableBudgetId);
      const actual = transactions
        .filter(t => t.categoryId === category.id)
        .reduce((sum, transaction) => sum + transactionSignedAmount(transaction), 0);

      return {
        key: category.id,
        label: category.name,
        colour: category.colour,
        category,
        budget,
        actual,
        variance: budget - actual,
        isCarriedForward: !explicitBudget && budget > 0,
      };
    });
  }, [
    budgets,
    categories,
    editableBudgetId,
    getEffectiveMonthBudgetAmount,
    getMonthBudgets,
    getMonthTransactions,
    getWorkspaceCategories,
    includedProfiles,
    isConsolidated,
    month,
    transactions,
    wsId,
  ]);

  const visibleTransactions = useMemo(() => {
    if (!isConsolidated) return transactions.map(transaction => ({ transaction, profile: editableProfile }));
    return includedProfiles.flatMap(profile =>
      getMonthTransactions(wsId, month, profile.id).map(transaction => ({ transaction, profile }))
    );
  }, [editableProfile, getMonthTransactions, includedProfiles, isConsolidated, month, transactions, wsId]);

  const unassignedActual = visibleTransactions
    .filter(({ transaction }) => !transaction.categoryId)
    .reduce((sum, { transaction }) => sum + transactionSignedAmount(transaction), 0);
  const totalBudget = categoryRows.reduce((sum, row) => sum + row.budget, 0);
  const totalActual = categoryRows.reduce((sum, row) => sum + row.actual, 0) + unassignedActual;
  const totalIncome = isConsolidated
    ? includedProfiles.reduce((sum, profile) => sum + getEffectiveMonthIncome(wsId, month, profile.id), 0)
    : monthlyIncome;
  const remaining = totalBudget - totalActual;
  const unallocated = totalIncome - totalBudget;

  const handleImport = async (file: File) => {
    if (!editableProfile) return;
    const text = await file.text();
    const result = importStatementCsv(wsId, editableProfile.id, text, file.name);
    setImportMessage(`${result.imported} transactions imported${result.skipped ? `, ${result.skipped} skipped` : ''}.`);
    setImportErrors(result.errors.slice(0, 8));
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim() || !editableProfile) return;
    addCategory(wsId, editableProfile.id, {
      name: newCategoryName,
      colour: editableProfile.colour,
      keywords: newCategoryKeywords.split(','),
    });
    setNewCategoryName('');
    setNewCategoryKeywords('');
  };

  const handleAddProfile = () => {
    if (!newBudgetName.trim()) return;
    const profile = addProfile(wsId, newBudgetName);
    setSelectedBudgetId(profile.id);
    setNewBudgetName('');
  };

  const categoryNameForTransaction = (transaction: BudgetTransaction, profile: BudgetProfile | null) => {
    if (!profile || !transaction.categoryId) return 'Uncategorised';
    return getWorkspaceCategories(wsId, profile.id).find(category => category.id === transaction.categoryId)?.name ?? 'Uncategorised';
  };

  const allocatingTransaction = visibleTransactions.find(({ transaction }) => transaction.id === allocatingTransactionId)?.transaction ?? null;

  const handleAllocateDebtTransaction = (
    transaction: BudgetTransaction,
    allocation: { mode: 'existing'; debtId: string } | { mode: 'new'; groupId: string; debtName: string }
  ) => {
    if (transaction.debtAllocation) return;

    if (allocation.mode === 'existing') {
      const debt = debtAccounts.find(account => account.id === allocation.debtId);
      if (!debt) return;

      if ((transaction.direction ?? 'payment') === 'payment') {
        const repayment = addRepayment(wsId, debt.groupId, debt.id, {
          date: transaction.date,
          amount: transaction.amount,
          notes: `Allocated from bank statement: ${transaction.description}`,
          sourceTransactionId: transaction.id,
        });
        updateTransaction(transaction.id, {
          debtAllocation: {
            action: 'repayment',
            debtId: debt.id,
            debtGroupId: debt.groupId,
            linkedRecordId: repayment.id,
          },
        });
      } else {
        const snapshot = addBalanceSnapshot(wsId, debt.groupId, debt.id, {
          date: transaction.date,
          balance: getCurrentBalance(debt) + transaction.amount,
          notes: `Debt increased from bank statement receipt: ${transaction.description}`,
          sourceTransactionId: transaction.id,
        });
        updateTransaction(transaction.id, {
          debtAllocation: {
            action: 'increase_debt',
            debtId: debt.id,
            debtGroupId: debt.groupId,
            linkedRecordId: snapshot.id,
          },
        });
      }
    } else {
      const debt = addAccount(wsId, allocation.groupId, {
        name: allocation.debtName,
        lender: '',
        type: 'loan',
        openingBalance: transaction.amount,
        interestRate: 0,
        minimumPayment: 0,
        paymentDueDay: null,
        startDate: transaction.date,
        termMonths: null,
        notes: `Created from bank statement receipt: ${transaction.description}`,
        status: 'active',
      });
      updateTransaction(transaction.id, {
        debtAllocation: {
          action: 'new_debt',
          debtId: debt.id,
          debtGroupId: debt.groupId,
          linkedRecordId: debt.id,
        },
      });
    }

    setAllocatingTransactionId(null);
  };

  if (!isPersonal) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <EmptyState
            icon={<WalletCards className="w-10 h-10" />}
            title="Budget Control is for personal workspaces"
            description="Switch to your Personal workspace to create monthly budgets and import bank statement spending."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Budget Control</h1>
            <p className="text-sm text-slate-500 mt-1">
              {monthLabel(month)} - {isConsolidated ? 'All included budgets' : editableProfile?.name}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="month"
              label="Budget Month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="sm:w-44"
            />
            <div className="flex items-end">
              <Button
                icon={<Upload className="w-4 h-4" />}
                onClick={() => fileRef.current?.click()}
                disabled={isConsolidated}
              >
                Import Statement
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])}
              />
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedBudgetId(CONSOLIDATED_ID)}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium border transition-colors',
              isConsolidated ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            )}
          >
            All Budgets
          </button>
          {profiles.map(profile => (
            <button
              key={profile.id}
              type="button"
              onClick={() => setSelectedBudgetId(profile.id)}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium border transition-colors inline-flex items-center gap-2',
                selectedBudgetId === profile.id ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              )}
              style={selectedBudgetId === profile.id ? { backgroundColor: profile.colour } : undefined}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedBudgetId === profile.id ? '#fff' : profile.colour }} />
              {profile.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 shadow-card p-5">
            <label htmlFor="monthly_income" className="text-xs font-medium uppercase tracking-wide text-indigo-700">
              Monthly Income
            </label>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm font-semibold text-indigo-700">{currency}</span>
              <input
                id="monthly_income"
                type="number"
                min="0"
                step="0.01"
                value={totalIncome || ''}
                onChange={e => editableProfile && setMonthIncome(wsId, month, editableProfile.id, Number(e.target.value) || 0)}
                disabled={isConsolidated}
                className="w-full rounded-lg border border-indigo-200 bg-white px-2 py-1.5 text-xl font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-indigo-100 disabled:text-indigo-700"
                placeholder="0.00"
              />
            </div>
            {isIncomeCarriedForward && (
              <p className="mt-2 text-xs font-medium text-indigo-700">carried forward</p>
            )}
          </div>
          <SummaryCard label="Monthly Budget" value={formatCurrency(totalBudget, currency)} tone="slate" />
          <SummaryCard label="Actual Spend" value={formatCurrency(totalActual, currency)} tone="blue" />
          <SummaryCard
            label={unallocated >= 0 ? 'Unallocated' : 'Overallocated'}
            value={formatCurrency(Math.abs(unallocated), currency)}
            tone={unallocated >= 0 ? 'green' : 'red'}
          />
        </div>

        <div className="mb-6 rounded-xl border border-slate-100 bg-white p-4 shadow-card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Budget position</p>
              <p className="text-xs text-slate-500">
                {isConsolidated
                  ? 'Combined totals from budgets marked for consolidation.'
                  : 'Income minus planned category budgets, with actual spend tracked separately.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="text-slate-500">Planned: <strong className="text-slate-800">{formatCurrency(totalBudget, currency)}</strong></span>
              <span className="text-slate-500">Actual: <strong className="text-slate-800">{formatCurrency(totalActual, currency)}</strong></span>
              <span className="text-slate-500">Remaining vs actual: <strong className={remaining >= 0 ? 'text-green-700' : 'text-red-600'}>{remaining >= 0 ? '' : '-'}{formatCurrency(Math.abs(remaining), currency)}</strong></span>
            </div>
          </div>
        </div>

        {(importMessage || importErrors.length > 0) && (
          <div className={cn(
            'mb-6 rounded-xl border p-4',
            importErrors.length ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'
          )}>
            {importMessage && <p className="text-sm font-medium text-slate-800">{importMessage}</p>}
            {importErrors.length > 0 && (
              <div className="mt-2 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  {importErrors.map(error => (
                    <p key={error} className="text-xs text-amber-700">{error}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
          <section className="space-y-6">
            <BudgetTable
              rows={categoryRows}
              currency={currency}
              readOnly={isConsolidated}
              onSetBudget={(categoryId, amount) => editableProfile && setBudgetAmount(wsId, month, categoryId, editableProfile.id, amount)}
            />
            <TransactionsTable
              transactions={visibleTransactions}
              categories={categories}
              currency={currency}
              readOnly={isConsolidated}
              getCategoryName={categoryNameForTransaction}
              onCategorise={(id, categoryId) => updateTransaction(id, { categoryId })}
              onDelete={deleteTransaction}
              onImport={() => fileRef.current?.click()}
              debtCategoryId={debtCategoryId}
              onAllocateDebt={setAllocatingTransactionId}
            />
          </section>

          <aside className="space-y-6">
            <div className="bg-white border border-slate-100 rounded-xl shadow-card p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">Budget Profiles</h2>
              <div className="space-y-3">
                {profiles.map(profile => (
                  <BudgetProfileEditor
                    key={profile.id}
                    profile={profile}
                    onUpdate={updates => updateProfile(profile.id, updates)}
                    onDelete={() => {
                      deleteProfile(profile.id);
                      if (selectedBudgetId === profile.id) setSelectedBudgetId(CONSOLIDATED_ID);
                    }}
                  />
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Input
                  aria-label="New budget name"
                  value={newBudgetName}
                  onChange={e => setNewBudgetName(e.target.value)}
                  placeholder="e.g. Joint account"
                />
                <Button icon={<Plus className="w-4 h-4" />} onClick={handleAddProfile} disabled={!newBudgetName.trim()}>
                  Add
                </Button>
              </div>
            </div>

            {!isConsolidated && editableProfile && (
              <>
                {allocatingTransaction && (
                  <DebtAllocationPanel
                    transaction={allocatingTransaction}
                    groups={debtGroups}
                    accounts={debtAccounts}
                    currency={currency}
                    onCancel={() => setAllocatingTransactionId(null)}
                    onAllocate={allocation => handleAllocateDebtTransaction(allocatingTransaction, allocation)}
                  />
                )}

                <div className="bg-white border border-slate-100 rounded-xl shadow-card p-5">
                  <h2 className="text-sm font-semibold text-slate-800 mb-4">Categories</h2>
                  <div className="space-y-3">
                    {categories.map(category => (
                      <CategoryEditor
                        key={category.id}
                        category={category}
                        onUpdate={updates => updateCategory(category.id, updates)}
                        onDelete={() => deleteCategory(category.id)}
                      />
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-xl shadow-card p-5">
                  <h2 className="text-sm font-semibold text-slate-800 mb-4">Add Category</h2>
                  <div className="space-y-3">
                    <Input
                      label="Name"
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      placeholder="e.g. Pets"
                    />
                    <Input
                      label="Auto-match Keywords"
                      value={newCategoryKeywords}
                      onChange={e => setNewCategoryKeywords(e.target.value)}
                      placeholder="vet, pets at home"
                      hint="Separate keywords with commas."
                    />
                    <Button
                      className="w-full justify-center"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={handleAddCategory}
                      disabled={!newCategoryName.trim()}
                    >
                      Add Category
                    </Button>
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function BudgetTable({
  rows,
  currency,
  readOnly,
  onSetBudget,
}: {
  rows: BudgetRow[];
  currency: string;
  readOnly: boolean;
  onSetBudget: (categoryId: string, amount: number) => void;
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800">Budget vs Actual</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Category</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Budget</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Actual</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(row => (
              <tr key={row.key} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.colour }} />
                    <span className="font-medium text-slate-800">{row.label}</span>
                    {row.isCarriedForward && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        carried forward
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  {readOnly || !row.category ? (
                    <span className="font-medium text-slate-700">{formatCurrency(row.budget, currency)}</span>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.budget || ''}
                      onChange={e => row.category && onSetBudget(row.category.id, Number(e.target.value) || 0)}
                      className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      aria-label={`${row.label} budget`}
                    />
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-700">{formatCurrency(row.actual, currency)}</td>
                <td className={cn(
                  'px-4 py-3 text-right font-semibold',
                  row.variance >= 0 ? 'text-green-700' : 'text-red-600'
                )}>
                  {row.variance >= 0 ? '' : '-'}{formatCurrency(Math.abs(row.variance), currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransactionsTable({
  transactions,
  categories,
  currency,
  readOnly,
  getCategoryName,
  onCategorise,
  onDelete,
  onImport,
  debtCategoryId,
  onAllocateDebt,
}: {
  transactions: { transaction: BudgetTransaction; profile: BudgetProfile | null }[];
  categories: BudgetCategory[];
  currency: string;
  readOnly: boolean;
  getCategoryName: (transaction: BudgetTransaction, profile: BudgetProfile | null) => string;
  onCategorise: (id: string, categoryId: string | null) => void;
  onDelete: (id: string) => void;
  onImport: () => void;
  debtCategoryId: string | null;
  onAllocateDebt: (id: string) => void;
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800">Statement Transactions</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {readOnly ? 'Combined transactions from included budgets.' : 'Import a CSV, then adjust categories where needed.'}
        </p>
      </div>
      {transactions.length === 0 ? (
        <EmptyState
          icon={<Upload className="w-10 h-10" />}
          title="No statement spend imported"
          description={readOnly ? 'Switch to a budget profile to import statement transactions.' : "Import a CSV bank statement to compare actual spending against this month's budget."}
          action={!readOnly && <Button onClick={onImport} icon={<Upload className="w-4 h-4" />}>Import Statement</Button>}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Description</th>
                {readOnly && <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Budget</th>}
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Direction</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Category</th>
                {!readOnly && <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.map(({ transaction, profile }) => (
                <tr key={transaction.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{transaction.date}</td>
                  <td className="px-4 py-3 min-w-52">
                    <p className="font-medium text-slate-800">{transaction.description}</p>
                  </td>
                  {readOnly && <td className="px-4 py-3 whitespace-nowrap text-slate-600">{profile?.name ?? '-'}</td>}
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {formatCurrency(transaction.amount, currency)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      (transaction.direction ?? 'payment') === 'receipt'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-slate-100 text-slate-600'
                    )}>
                      {(transaction.direction ?? 'payment') === 'receipt' ? 'Money in' : 'Money out'}
                    </span>
                  </td>
                  <td className="px-4 py-3 min-w-44">
                    {readOnly ? (
                      <span className="text-slate-700">{getCategoryName(transaction, profile)}</span>
                    ) : (
                      <Select
                        value={transaction.categoryId ?? ''}
                        onChange={e => onCategorise(transaction.id, e.target.value || null)}
                        options={categories.map(category => ({ value: category.id, label: category.name }))}
                        placeholder="Uncategorised"
                      />
                    )}
                  </td>
                  {!readOnly && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {transaction.categoryId === debtCategoryId && (
                        transaction.debtAllocation ? (
                          <span className="mr-2 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                            Allocated
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onAllocateDebt(transaction.id)}
                            className="mr-2 rounded-lg px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                          >
                            Allocate
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        aria-label={`Delete transaction ${transaction.description}`}
                        onClick={() => onDelete(transaction.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DebtAllocationPanel({
  transaction,
  groups,
  accounts,
  currency,
  onCancel,
  onAllocate,
}: {
  transaction: BudgetTransaction;
  groups: DebtGroup[];
  accounts: DebtAccount[];
  currency: string;
  onCancel: () => void;
  onAllocate: (allocation: { mode: 'existing'; debtId: string } | { mode: 'new'; groupId: string; debtName: string }) => void;
}) {
  const isReceipt = (transaction.direction ?? 'payment') === 'receipt';
  const [mode, setMode] = useState<'existing' | 'new'>(isReceipt ? 'existing' : 'existing');
  const [debtId, setDebtId] = useState(accounts[0]?.id ?? '');
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '');
  const [debtName, setDebtName] = useState(transaction.description || 'Statement debt');

  const canAllocateExisting = Boolean(debtId);
  const canCreateDebt = Boolean(groupId && debtName.trim());

  return (
    <div className="bg-white border border-rose-100 rounded-xl shadow-card p-5">
      <h2 className="text-sm font-semibold text-slate-800 mb-1">Allocate Debt Transaction</h2>
      <p className="text-xs text-slate-500 mb-4">
        {transaction.date} · {formatCurrency(transaction.amount, currency)} · {isReceipt ? 'Money in' : 'Money out'}
      </p>

      {isReceipt && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={cn(
              'rounded-lg border px-3 py-2 text-sm font-medium',
              mode === 'existing' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            Increase Debt
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={cn(
              'rounded-lg border px-3 py-2 text-sm font-medium',
              mode === 'new' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            New Debt
          </button>
        </div>
      )}

      {mode === 'existing' ? (
        <div className="space-y-3">
          <Select
            label={isReceipt ? 'Debt to Increase' : 'Debt to Reduce'}
            value={debtId}
            onChange={e => setDebtId(e.target.value)}
            options={accounts.map(account => ({ value: account.id, label: account.name }))}
            placeholder="Choose debt"
          />
          <p className="text-xs text-slate-500">
            {isReceipt
              ? 'This will add a balance update for the selected debt.'
              : 'This will record a repayment against the selected debt.'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 justify-center" onClick={onCancel}>Cancel</Button>
            <Button
              className="flex-1 justify-center"
              disabled={!canAllocateExisting}
              onClick={() => onAllocate({ mode: 'existing', debtId })}
            >
              Allocate
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Select
            label="Debt Group"
            value={groupId}
            onChange={e => setGroupId(e.target.value)}
            options={groups.map(group => ({ value: group.id, label: group.name }))}
            placeholder="Choose group"
          />
          <Input
            label="Debt Name"
            value={debtName}
            onChange={e => setDebtName(e.target.value)}
          />
          <p className="text-xs text-slate-500">
            This will create a new loan with the receipt amount as the opening balance.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 justify-center" onClick={onCancel}>Cancel</Button>
            <Button
              className="flex-1 justify-center"
              disabled={!canCreateDebt}
              onClick={() => onAllocate({ mode: 'new', groupId, debtName: debtName.trim() })}
            >
              Create Debt
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: 'slate' | 'blue' | 'green' | 'red' }) {
  const tones = {
    slate: 'bg-white border-slate-100 text-slate-800',
    blue: 'bg-blue-50 border-blue-100 text-blue-800',
    green: 'bg-green-50 border-green-100 text-green-800',
    red: 'bg-red-50 border-red-100 text-red-800',
  };

  return (
    <div className={cn('rounded-xl border shadow-card p-5', tones[tone])}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function BudgetProfileEditor({
  profile,
  onUpdate,
  onDelete,
}: {
  profile: BudgetProfile;
  onUpdate: (updates: Partial<Pick<BudgetProfile, 'name' | 'colour' | 'includeInConsolidated'>>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(profile.name);

  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="flex items-start gap-2">
        <input
          type="color"
          value={profile.colour}
          onChange={e => onUpdate({ colour: e.target.value })}
          aria-label={`${profile.name} colour`}
          className="w-8 h-8 rounded border border-slate-200"
        />
        <div className="flex-1 space-y-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => name.trim() && onUpdate({ name })}
            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label={`${profile.name} name`}
          />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={profile.includeInConsolidated}
              onChange={e => onUpdate({ includeInConsolidated: e.target.checked })}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Include in consolidated
          </label>
        </div>
        {!profile.isDefault && (
          <button
            type="button"
            aria-label={`Delete ${profile.name}`}
            onClick={onDelete}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function CategoryEditor({
  category,
  onUpdate,
  onDelete,
}: {
  category: BudgetCategory;
  onUpdate: (updates: Partial<Pick<BudgetCategory, 'name' | 'colour' | 'keywords'>>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [keywords, setKeywords] = useState(keywordText(category));

  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="flex items-start gap-2">
        <input
          type="color"
          value={category.colour}
          onChange={e => onUpdate({ colour: e.target.value })}
          aria-label={`${category.name} colour`}
          className="w-8 h-8 rounded border border-slate-200"
        />
        <div className="flex-1 space-y-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => name.trim() && onUpdate({ name })}
            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label={`${category.name} name`}
          />
          <input
            value={keywords}
            onChange={e => setKeywords(e.target.value)}
            onBlur={() => onUpdate({ keywords: keywords.split(',') })}
            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label={`${category.name} keywords`}
            placeholder="keywords"
          />
        </div>
        <button
          type="button"
          aria-label={`Delete ${category.name}`}
          onClick={onDelete}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
