import { useMemo, useState } from 'react';
import { HandCoins, Pencil, Plus, Trash2 } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useDebtStore } from '@/stores/debtStore';
import { useBudgetStore } from '@/stores/budgetStore';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { Input, Select, Textarea } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { formatCurrency } from '@/utils/dateUtils';
import { cn } from '@/utils/cn';
import type { BudgetTransaction, DebtAccount, DebtAccountType, DebtGroup } from '@/types';

const CONSOLIDATED_ID = 'consolidated';

const DEBT_TYPE_OPTIONS: { value: DebtAccountType; label: string }[] = [
  { value: 'loan', label: 'Loan' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'car_finance', label: 'Car Finance' },
  { value: 'student_loan', label: 'Student Loan' },
  { value: 'overdraft', label: 'Overdraft' },
  { value: 'other', label: 'Other' },
];

const today = () => new Date().toISOString().slice(0, 10);

export function DebtPage() {
  const { activeWorkspace } = useWorkspaceStore();
  const {
    getWorkspaceGroups,
    addGroup,
    updateGroup,
    deleteGroup,
    getGroupAccounts,
    getIncludedAccounts,
    addAccount,
    updateAccount,
    deleteAccount,
    addRepayment,
    addBalanceSnapshot,
    getDebtRepayments,
    getDebtBalances,
    getCurrentBalance,
  } = useDebtStore();
  const {
    transactions: budgetTransactions,
    getWorkspaceProfiles,
    getWorkspaceCategories,
    updateTransaction,
  } = useBudgetStore();

  const [selectedGroupId, setSelectedGroupId] = useState(CONSOLIDATED_ID);
  const [newGroupName, setNewGroupName] = useState('');
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [repaymentDate, setRepaymentDate] = useState(today());
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceDate, setBalanceDate] = useState(today());
  const [allocatingTransactionId, setAllocatingTransactionId] = useState<string | null>(null);

  const wsId = activeWorkspace?.id ?? '';
  const currency = activeWorkspace?.currency ?? 'GBP';
  const isPersonal = activeWorkspace?.type === 'personal';
  const groups = getWorkspaceGroups(wsId);
  const allAccounts = groups.flatMap(group => getGroupAccounts(wsId, group.id));
  const selectedGroup = groups.find(group => group.id === selectedGroupId) ?? groups[0] ?? null;
  const isConsolidated = selectedGroupId === CONSOLIDATED_ID;
  const accounts = isConsolidated
    ? getIncludedAccounts(wsId)
    : selectedGroup ? getGroupAccounts(wsId, selectedGroup.id) : [];
  const selectedDebt = accounts.find(account => account.id === selectedDebtId) ?? accounts[0] ?? null;
  const editingDebt = accounts.find(account => account.id === editingDebtId) ?? null;
  const budgetProfiles = getWorkspaceProfiles(wsId);
  const debtCategoryIds = new Set(
    budgetProfiles.flatMap(profile =>
      getWorkspaceCategories(wsId, profile.id)
        .filter(category => category.name.toLowerCase() === 'debt')
        .map(category => category.id)
    )
  );
  const unallocatedDebtTransactions = budgetTransactions
    .filter(transaction =>
      transaction.workspaceId === wsId &&
      !transaction.debtAllocation &&
      Boolean(transaction.categoryId && debtCategoryIds.has(transaction.categoryId))
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const allocatingTransaction = unallocatedDebtTransactions.find(transaction => transaction.id === allocatingTransactionId) ?? null;

  const summary = useMemo(() => {
    const activeAccounts = accounts.filter(account => account.status !== 'settled');
    const currentBalance = activeAccounts.reduce((sum, account) => sum + getCurrentBalance(account), 0);
    const minimumPayments = activeAccounts.reduce((sum, account) => sum + account.minimumPayment, 0);
    const weightedRate = currentBalance
      ? activeAccounts.reduce((sum, account) => sum + getCurrentBalance(account) * account.interestRate, 0) / currentBalance
      : 0;

    return {
      currentBalance,
      minimumPayments,
      weightedRate,
      count: activeAccounts.length,
    };
  }, [accounts, getCurrentBalance]);

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    const group = addGroup(wsId, newGroupName);
    setSelectedGroupId(group.id);
    setNewGroupName('');
  };

  const handleRepayment = () => {
    if (!selectedDebt || !repaymentAmount) return;
    addRepayment(wsId, selectedDebt.groupId, selectedDebt.id, {
      date: repaymentDate,
      amount: Number(repaymentAmount) || 0,
      notes: '',
    });
    setRepaymentAmount('');
  };

  const handleBalance = () => {
    if (!selectedDebt || !balanceAmount) return;
    addBalanceSnapshot(wsId, selectedDebt.groupId, selectedDebt.id, {
      date: balanceDate,
      balance: Number(balanceAmount) || 0,
      notes: '',
    });
    setBalanceAmount('');
  };

  const handleAllocateDebtTransaction = (
    transaction: BudgetTransaction,
    allocation: { mode: 'existing'; debtId: string } | { mode: 'new'; groupId: string; debtName: string }
  ) => {
    if (transaction.debtAllocation) return;

    if (allocation.mode === 'existing') {
      const debt = allAccounts.find(account => account.id === allocation.debtId);
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
      setSelectedGroupId(debt.groupId);
      setSelectedDebtId(debt.id);
    }

    setAllocatingTransactionId(null);
  };

  if (!isPersonal) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <EmptyState
            icon={<HandCoins className="w-10 h-10" />}
            title="Debt Management is for personal workspaces"
            description="Switch to your Personal workspace to track loans, repayments, terms, and balances."
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
            <h1 className="text-2xl font-bold text-slate-800">Debt Management</h1>
            <p className="text-sm text-slate-500 mt-1">
              {isConsolidated ? 'All included debt groups' : selectedGroup?.name}
            </p>
          </div>
          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setEditingDebtId(null);
              setShowAddDebt(true);
            }}
            disabled={isConsolidated || !selectedGroup}
          >
            Add Debt
          </Button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedGroupId(CONSOLIDATED_ID)}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium border transition-colors',
              isConsolidated ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            )}
          >
            All Debts
          </button>
          {groups.map(group => (
            <button
              key={group.id}
              type="button"
              onClick={() => setSelectedGroupId(group.id)}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium border transition-colors inline-flex items-center gap-2',
                selectedGroupId === group.id ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              )}
              style={selectedGroupId === group.id ? { backgroundColor: group.colour } : undefined}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedGroupId === group.id ? '#fff' : group.colour }} />
              {group.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard label="Current Debt" value={formatCurrency(summary.currentBalance, currency)} tone="red" />
          <SummaryCard label="Minimum Payments" value={formatCurrency(summary.minimumPayments, currency)} tone="blue" />
          <SummaryCard label="Weighted Rate" value={`${summary.weightedRate.toFixed(2)}%`} tone="slate" />
          <SummaryCard label="Active Debts" value={String(summary.count)} tone="green" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
          <section className="space-y-6">
            <UnallocatedDebtTransactions
              transactions={unallocatedDebtTransactions}
              currency={currency}
              onAllocate={setAllocatingTransactionId}
            />

            <DebtTable
              accounts={accounts}
              groups={groups}
              currency={currency}
              readOnly={isConsolidated}
              selectedDebtId={selectedDebt?.id ?? null}
              getCurrentBalance={getCurrentBalance}
              onSelect={setSelectedDebtId}
              onEdit={id => {
                setSelectedDebtId(id);
                setEditingDebtId(id);
                setShowAddDebt(false);
              }}
              onStatusChange={(id, status) => updateAccount(id, { status })}
              onDelete={deleteAccount}
            />

            {selectedDebt && !isConsolidated && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-100 rounded-xl shadow-card p-5">
                  <h2 className="text-sm font-semibold text-slate-800 mb-4">Record Repayment</h2>
                  <div className="space-y-3">
                    <Input label="Date" type="date" value={repaymentDate} onChange={e => setRepaymentDate(e.target.value)} />
                    <Input label="Amount" type="number" min="0" step="0.01" value={repaymentAmount} onChange={e => setRepaymentAmount(e.target.value)} />
                    <Button className="w-full justify-center" onClick={handleRepayment} disabled={!repaymentAmount}>
                      Save Repayment
                    </Button>
                  </div>
                </div>
                <div className="bg-white border border-slate-100 rounded-xl shadow-card p-5">
                  <h2 className="text-sm font-semibold text-slate-800 mb-4">Update Balance</h2>
                  <div className="space-y-3">
                    <Input label="Balance Date" type="date" value={balanceDate} onChange={e => setBalanceDate(e.target.value)} />
                    <Input label="Current Balance" type="number" min="0" step="0.01" value={balanceAmount} onChange={e => setBalanceAmount(e.target.value)} />
                    <Button className="w-full justify-center" onClick={handleBalance} disabled={!balanceAmount}>
                      Save Balance
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {selectedDebt && (
              <DebtHistory
                debt={selectedDebt}
                currency={currency}
                repayments={getDebtRepayments(selectedDebt.id)}
                balances={getDebtBalances(selectedDebt.id)}
              />
            )}
          </section>

          <aside className="space-y-6">
            <div className="bg-white border border-slate-100 rounded-xl shadow-card p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">Debt Groups</h2>
              <div className="space-y-3">
                {groups.map(group => (
                  <DebtGroupEditor
                    key={group.id}
                    group={group}
                    onUpdate={updates => updateGroup(group.id, updates)}
                    onDelete={() => {
                      deleteGroup(group.id);
                      if (selectedGroupId === group.id) setSelectedGroupId(CONSOLIDATED_ID);
                    }}
                  />
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Input
                  aria-label="New debt group name"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="e.g. Credit cards"
                />
                <Button icon={<Plus className="w-4 h-4" />} onClick={handleAddGroup} disabled={!newGroupName.trim()}>
                  Add
                </Button>
              </div>
            </div>
          </aside>
        </div>

        <Modal open={showAddDebt && Boolean(selectedGroup) && !isConsolidated} onClose={() => setShowAddDebt(false)} title="Add Debt" size="lg">
          {selectedGroup && (
            <AddDebtPanel
              submitLabel="Save Debt"
              currency={currency}
              onCancel={() => setShowAddDebt(false)}
              onSave={data => {
                const debt = addAccount(wsId, selectedGroup.id, data);
                setSelectedDebtId(debt.id);
                setShowAddDebt(false);
              }}
            />
          )}
        </Modal>

        <Modal open={Boolean(editingDebt) && !isConsolidated} onClose={() => setEditingDebtId(null)} title="Edit Debt" size="lg">
          {editingDebt && (
            <AddDebtPanel
              submitLabel="Save Changes"
              currency={currency}
              initialDebt={editingDebt}
              onCancel={() => setEditingDebtId(null)}
              onSave={data => {
                updateAccount(editingDebt.id, data);
                setEditingDebtId(null);
              }}
            />
          )}
        </Modal>

        <Modal open={Boolean(allocatingTransaction)} onClose={() => setAllocatingTransactionId(null)} title="Allocate Statement Debt" size="lg">
          {allocatingTransaction && (
            <DebtAllocationPanel
              transaction={allocatingTransaction}
              groups={groups}
              accounts={allAccounts}
              currency={currency}
              onCancel={() => setAllocatingTransactionId(null)}
              onAllocate={allocation => handleAllocateDebtTransaction(allocatingTransaction, allocation)}
            />
          )}
        </Modal>
      </div>
    </div>
  );
}

function UnallocatedDebtTransactions({
  transactions,
  currency,
  onAllocate,
}: {
  transactions: BudgetTransaction[];
  currency: string;
  onAllocate: (id: string) => void;
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800">Unallocated Statement Debt</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Debt-categorised bank statement rows wait here until they are matched to a new or existing debt.
        </p>
      </div>
      {transactions.length === 0 ? (
        <div className="px-5 py-6 text-sm text-slate-400">
          No unallocated debt transactions.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Description</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Direction</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.map(transaction => (
                <tr key={transaction.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{transaction.date}</td>
                  <td className="px-4 py-3 min-w-52">
                    <p className="font-medium text-slate-800">{transaction.description}</p>
                  </td>
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
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onAllocate(transaction.id)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                    >
                      Allocate
                    </button>
                  </td>
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
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [debtId, setDebtId] = useState(accounts[0]?.id ?? '');
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '');
  const [debtName, setDebtName] = useState(transaction.description || 'Statement debt');

  const canAllocateExisting = Boolean(debtId);
  const canCreateDebt = Boolean(groupId && debtName.trim());

  return (
    <div>
      <p className="text-xs text-slate-500 mb-4">
        {transaction.date} - {formatCurrency(transaction.amount, currency)} - {isReceipt ? 'Money in' : 'Money out'}
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

function DebtTable({
  accounts,
  groups,
  currency,
  readOnly,
  selectedDebtId,
  getCurrentBalance,
  onSelect,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  accounts: DebtAccount[];
  groups: DebtGroup[];
  currency: string;
  readOnly: boolean;
  selectedDebtId: string | null;
  getCurrentBalance: (debt: DebtAccount) => number;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onStatusChange: (id: string, status: DebtAccount['status']) => void;
  onDelete: (id: string) => void;
}) {
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={<HandCoins className="w-10 h-10" />}
        title="No debts recorded"
        description={readOnly ? 'Switch to a debt group to add your first debt.' : 'Add loans, credit cards, mortgages, or other debt accounts.'}
      />
    );
  }

  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800">Debt Accounts</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Debt</th>
              {readOnly && <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Group</th>}
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Balance</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Rate</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Min Pay</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
              {!readOnly && <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {accounts.map(account => (
              <tr
                key={account.id}
                className={cn('hover:bg-slate-50 cursor-pointer', selectedDebtId === account.id && 'bg-purple-50/60')}
                onClick={() => onSelect(account.id)}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{account.name}</p>
                  <p className="text-xs text-slate-400">{account.lender || account.type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-slate-400">
                    {account.termMonths ? `${account.termMonths} months` : 'Open term'}
                    {account.paymentDueDay ? ` - due day ${account.paymentDueDay}` : ''}
                  </p>
                </td>
                {readOnly && (
                  <td className="px-4 py-3 text-slate-600">
                    {groups.find(group => group.id === account.groupId)?.name ?? '-'}
                  </td>
                )}
                <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(getCurrentBalance(account), currency)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{account.interestRate.toFixed(2)}%</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(account.minimumPayment, currency)}</td>
                <td className="px-4 py-3">
                  {readOnly ? (
                    <span className="capitalize text-slate-600">{account.status}</span>
                  ) : (
                    <Select
                      value={account.status}
                      onChange={e => onStatusChange(account.id, e.target.value as DebtAccount['status'])}
                      options={[
                        { value: 'active', label: 'Active' },
                        { value: 'paused', label: 'Paused' },
                        { value: 'settled', label: 'Settled' },
                      ]}
                    />
                  )}
                </td>
                {!readOnly && (
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      aria-label={`Edit ${account.name}`}
                      onClick={event => { event.stopPropagation(); onEdit(account.id); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${account.name}`}
                      onClick={event => { event.stopPropagation(); onDelete(account.id); }}
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
    </div>
  );
}

function AddDebtPanel({
  submitLabel,
  currency,
  initialDebt,
  onCancel,
  onSave,
}: {
  submitLabel: string;
  currency: string;
  initialDebt?: DebtAccount;
  onCancel: () => void;
  onSave: (data: Omit<DebtAccount, 'id' | 'tenantId' | 'workspaceId' | 'groupId' | 'createdAt' | 'updatedAt'>) => void;
}) {
  const [form, setForm] = useState({
    name: initialDebt?.name ?? '',
    lender: initialDebt?.lender ?? '',
    type: initialDebt?.type ?? 'loan' as DebtAccountType,
    openingBalance: initialDebt ? String(initialDebt.openingBalance) : '',
    interestRate: initialDebt ? String(initialDebt.interestRate) : '',
    minimumPayment: initialDebt ? String(initialDebt.minimumPayment) : '',
    paymentDueDay: initialDebt?.paymentDueDay ? String(initialDebt.paymentDueDay) : '',
    startDate: initialDebt?.startDate ?? today(),
    termMonths: initialDebt?.termMonths ? String(initialDebt.termMonths) : '',
    notes: initialDebt?.notes ?? '',
  });

  const set = (key: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div>
      <div className="space-y-3">
        <Input label="Name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Car loan" />
        <Input label="Lender" value={form.lender} onChange={e => set('lender', e.target.value)} placeholder="e.g. Bank" />
        <Select label="Type" value={form.type} onChange={e => set('type', e.target.value)} options={DEBT_TYPE_OPTIONS} />
        <Input label={`Opening Balance (${currency})`} type="number" min="0" step="0.01" value={form.openingBalance} onChange={e => set('openingBalance', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="APR %" type="number" min="0" step="0.01" value={form.interestRate} onChange={e => set('interestRate', e.target.value)} />
          <Input label="Min Payment" type="number" min="0" step="0.01" value={form.minimumPayment} onChange={e => set('minimumPayment', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Due Day" type="number" min="1" max="31" value={form.paymentDueDay} onChange={e => set('paymentDueDay', e.target.value)} />
          <Input label="Term Months" type="number" min="0" value={form.termMonths} onChange={e => set('termMonths', e.target.value)} />
        </div>
        <Input label="Start Date" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
        <Textarea label="Notes" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1 justify-center" onClick={onCancel}>Cancel</Button>
          <Button
            className="flex-1 justify-center"
            disabled={!form.name.trim() || !form.openingBalance}
            onClick={() => onSave({
              name: form.name,
              lender: form.lender,
              type: form.type,
              openingBalance: Number(form.openingBalance) || 0,
              interestRate: Number(form.interestRate) || 0,
              minimumPayment: Number(form.minimumPayment) || 0,
              paymentDueDay: form.paymentDueDay ? Number(form.paymentDueDay) : null,
              startDate: form.startDate || null,
              termMonths: form.termMonths ? Number(form.termMonths) : null,
              notes: form.notes,
              status: 'active',
            })}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DebtHistory({
  debt,
  currency,
  repayments,
  balances,
}: {
  debt: DebtAccount;
  currency: string;
  repayments: ReturnType<typeof useDebtStore.getState>['repayments'];
  balances: ReturnType<typeof useDebtStore.getState>['balances'];
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-card p-5">
      <h2 className="text-sm font-semibold text-slate-800 mb-4">{debt.name} History</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">Repayments</h3>
          {repayments.length === 0 ? (
            <p className="text-sm text-slate-400">No repayments recorded.</p>
          ) : (
            <div className="space-y-2">
              {repayments.slice(0, 8).map(repayment => (
                <div key={repayment.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-600">{repayment.date}</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(repayment.amount, currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">Balance Updates</h3>
          {balances.length === 0 ? (
            <p className="text-sm text-slate-400">No balance updates recorded.</p>
          ) : (
            <div className="space-y-2">
              {balances.slice(0, 8).map(balance => (
                <div key={balance.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-600">{balance.date}</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(balance.balance, currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DebtGroupEditor({
  group,
  onUpdate,
  onDelete,
}: {
  group: DebtGroup;
  onUpdate: (updates: Partial<Pick<DebtGroup, 'name' | 'colour' | 'includeInConsolidated'>>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(group.name);

  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="flex items-start gap-2">
        <input
          type="color"
          value={group.colour}
          onChange={e => onUpdate({ colour: e.target.value })}
          aria-label={`${group.name} colour`}
          className="w-8 h-8 rounded border border-slate-200"
        />
        <div className="flex-1 space-y-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => name.trim() && onUpdate({ name })}
            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label={`${group.name} name`}
          />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={group.includeInConsolidated}
              onChange={e => onUpdate({ includeInConsolidated: e.target.checked })}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Include in consolidated
          </label>
        </div>
        {!group.isDefault && (
          <button
            type="button"
            aria-label={`Delete ${group.name}`}
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
