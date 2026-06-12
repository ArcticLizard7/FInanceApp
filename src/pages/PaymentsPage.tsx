import { useState, useMemo } from 'react';
import { Plus, Filter, Check, Clock, Ban, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { usePaymentStore } from '@/stores/paymentStore';
import { Modal } from '@/components/common/Modal';
import { PaymentForm } from '@/components/payments/PaymentForm';
import { ApprovalBadge, PaymentBadge } from '@/components/payments/PaymentStatusBadge';
import { Button } from '@/components/common/Button';
import { Select } from '@/components/common/Input';
import { EmptyState } from '@/components/common/EmptyState';
import { formatDate, formatCurrency, isOverdue } from '@/utils/dateUtils';
import { cn } from '@/utils/cn';
import type { PaymentRequest } from '@/types';
import { approvalStatusLabel } from '@/utils/colorUtils';

const APPROVAL_OPTIONS = [
  { value: '', label: 'All Statuses' },
  ...Object.entries(approvalStatusLabel).map(([v, l]) => ({ value: v, label: l })),
];

export function PaymentsPage() {
  const { activeWorkspace } = useWorkspaceStore();
  const { getWorkspacePayments, addPayment, updatePayment, deletePayment, updateApprovalStatus, markAsPaid, schedulePayment } = usePaymentStore();

  const [showAdd, setShowAdd] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentRequest | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<PaymentRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const wsId = activeWorkspace?.id ?? '';
  const allPayments = getWorkspacePayments(wsId);

  const filtered = useMemo(() => {
    return allPayments.filter(p => {
      if (filterStatus && p.approvalStatus !== filterStatus) return false;
      return true;
    }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [allPayments, filterStatus]);

  const stats = {
    awaitingApproval: allPayments.filter(p => p.approvalStatus === 'awaiting_approval').length,
    approved: allPayments.filter(p => p.approvalStatus === 'approved' && p.paymentStatus !== 'paid').length,
    overdue: allPayments.filter(p => p.paymentStatus !== 'paid' && isOverdue(p.dueDate)).length,
    totalOutstanding: allPayments.filter(p => p.paymentStatus !== 'paid').reduce((s, p) => s + p.totalAmount, 0),
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Payment Requests</h1>
            <p className="text-sm text-slate-500 mt-1">{allPayments.length} total · {formatCurrency(stats.totalOutstanding, activeWorkspace?.currency ?? 'GBP')} outstanding</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" icon={<Filter className="w-3.5 h-3.5" />} onClick={() => setShowFilters(!showFilters)}>Filter</Button>
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowAdd(true)}>Add Request</Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Awaiting Approval', value: stats.awaitingApproval, colour: 'bg-amber-50 text-amber-700 border-amber-100' },
            { label: 'Approved / Unpaid',  value: stats.approved,         colour: 'bg-green-50 text-green-700 border-green-100' },
            { label: 'Overdue',            value: stats.overdue,          colour: 'bg-red-50 text-red-700 border-red-100' },
            { label: 'Total Outstanding',  value: formatCurrency(stats.totalOutstanding, activeWorkspace?.currency ?? 'GBP'), colour: 'bg-slate-50 text-slate-700 border-slate-100' },
          ].map(s => (
            <div key={s.label} className={cn('rounded-xl border p-4', s.colour)}>
              <p className="text-xs font-medium opacity-70">{s.label}</p>
              <p className="text-xl font-semibold mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex gap-3 mb-4 p-4 bg-slate-50 rounded-xl">
            <Select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              options={APPROVAL_OPTIONS}
              className="max-w-xs"
            />
          </div>
        )}

        {/* Table */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Plus className="w-10 h-10" />}
            title="No payment requests"
            description="Add your first payment request to get started."
            action={<Button onClick={() => setShowAdd(true)} icon={<Plus className="w-4 h-4" />}>Add Request</Button>}
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-100 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Supplier', 'Project', 'Invoice Ref', 'Due Date', 'Net', 'VAT', 'Total', 'Approval', 'Payment', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(p => (
                    <PaymentRow
                      key={p.id}
                      payment={p}
                      onEdit={setEditingPayment}
                      onDelete={setDeletingPayment}
                      onApprove={id => updateApprovalStatus(id, 'approved')}
                      onReject={id => updateApprovalStatus(id, 'rejected')}
                      onMarkPaid={markAsPaid}
                      onSchedule={schedulePayment}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Payment Request" size="xl">
        <PaymentForm
          onSave={data => { addPayment(data); setShowAdd(false); }}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>
      <Modal open={!!editingPayment} onClose={() => setEditingPayment(null)} title="Edit Payment Request" size="xl">
        {editingPayment && (
          <PaymentForm
            initial={editingPayment}
            onSave={data => { updatePayment(editingPayment.id, data); setEditingPayment(null); }}
            onCancel={() => setEditingPayment(null)}
          />
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deletingPayment}
        onClose={() => setDeletingPayment(null)}
        title="Delete Payment Request"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeletingPayment(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => { deletePayment(deletingPayment!.id); setDeletingPayment(null); }}
            >
              Delete
            </Button>
          </>
        }
      >
        {deletingPayment && (
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-50 rounded-xl flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">
                Delete payment request from <strong>{deletingPayment.supplier}</strong>?
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {deletingPayment.project && <span>{deletingPayment.project} · </span>}
                {deletingPayment.invoiceReference && <span>{deletingPayment.invoiceReference} · </span>}
                {formatCurrency(deletingPayment.totalAmount, deletingPayment.currency)}
              </p>
              <p className="text-xs text-red-600 mt-2">This action cannot be undone.</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

interface PaymentRowProps {
  payment: PaymentRequest;
  onEdit: (p: PaymentRequest) => void;
  onDelete: (p: PaymentRequest) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onMarkPaid: (id: string) => void;
  onSchedule: (id: string, date: string) => void;
}

function PaymentRow({ payment: p, onEdit, onDelete, onApprove, onReject, onMarkPaid }: PaymentRowProps) {
  const overdue = isOverdue(p.dueDate) && p.paymentStatus !== 'paid';

  return (
    <tr className={cn('hover:bg-slate-50 transition-colors group', overdue && 'bg-red-50/40')}>
      <td className="px-4 py-3">
        <div className="font-medium text-slate-800">{p.supplier}</div>
        {p.requestedBy && <div className="text-xs text-slate-400">Req: {p.requestedBy}</div>}
      </td>
      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.project || '—'}</td>
      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{p.invoiceReference || '—'}</td>
      <td className={cn('px-4 py-3 whitespace-nowrap text-xs font-medium', overdue ? 'text-red-600' : 'text-slate-600')}>
        {formatDate(p.dueDate)}
      </td>
      <td className="px-4 py-3 text-slate-800 whitespace-nowrap">{formatCurrency(p.amount, p.currency)}</td>
      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatCurrency(p.vatAmount, p.currency)}</td>
      <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{formatCurrency(p.totalAmount, p.currency)}</td>
      <td className="px-4 py-3 whitespace-nowrap"><ApprovalBadge status={p.approvalStatus} /></td>
      <td className="px-4 py-3 whitespace-nowrap"><PaymentBadge status={p.paymentStatus} /></td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-0.5">
          {/* Workflow actions */}
          {p.approvalStatus === 'awaiting_approval' && (
            <>
              <button
                onClick={() => onApprove(p.id)}
                title="Approve"
                className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onReject(p.id)}
                title="Reject"
                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              >
                <Ban className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {p.approvalStatus === 'approved' && p.paymentStatus !== 'paid' && (
            <button
              onClick={() => onMarkPaid(p.id)}
              title="Mark as Paid"
              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Divider between workflow and CRUD actions */}
          <span className="w-px h-4 bg-slate-200 mx-1" />

          {/* Edit */}
          <button
            onClick={() => onEdit(p)}
            title="Edit payment request"
            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          {/* Delete */}
          <button
            onClick={() => onDelete(p)}
            title="Delete payment request"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
