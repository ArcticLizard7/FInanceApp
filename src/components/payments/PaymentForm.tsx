import { useState } from 'react';
import { Input, Textarea, Select } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import type { PaymentRequest, PaymentApprovalStatus, RecurrenceInterval } from '@/types';
import { recurrenceLabel } from '@/utils/colorUtils';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { POPULAR_CURRENCIES } from '@/constants/currencies';
import { VAT_OPTIONS, vatRateForCode } from '@/constants/vat';
import type { VatBreakdownLine, VatCode } from '@/types';

type PaymentDraft = Omit<PaymentRequest, 'id' | 'createdAt' | 'updatedAt' | 'attachments' | 'tenantId'>;

interface PaymentFormProps {
  initial?: Partial<PaymentRequest>;
  onSave: (data: PaymentDraft) => void;
  onCancel: () => void;
}

const APPROVAL_STATUSES: { value: PaymentApprovalStatus; label: string }[] = [
  { value: 'draft',             label: 'Draft' },
  { value: 'awaiting_approval', label: 'Awaiting Approval' },
  { value: 'approved',          label: 'Approved' },
  { value: 'on_hold',           label: 'On Hold' },
  { value: 'rejected',          label: 'Rejected' },
];

const RECURRENCES = Object.entries(recurrenceLabel).map(([value, label]) => ({ value, label }));

const roundMoney = (value: number) => parseFloat(value.toFixed(2));

const calculateVat = (net: number, rate: number) => roundMoney(net * (rate / 100));

const calculateVatBreakdown = (lines: VatBreakdownLine[]) =>
  lines.map(line => ({
    ...line,
    netAmount: roundMoney(line.netAmount || 0),
    rate: roundMoney(line.rate || 0),
    vatAmount: calculateVat(line.netAmount || 0, line.rate || 0),
  }));

export function PaymentForm({ initial, onSave, onCancel }: PaymentFormProps) {
  const { activeWorkspace } = useWorkspaceStore();
  const initialVatCode = initial?.vatCode ?? 'S';
  const initialCurrency = initial?.currency ?? activeWorkspace?.currency ?? 'GBP';
  const initialVatBreakdown = initial?.vatBreakdown?.length
    ? initial.vatBreakdown
    : [{ netAmount: initial?.amount ?? 0, rate: vatRateForCode(initialVatCode), vatAmount: initial?.vatAmount ?? 0 }];

  const [form, setForm] = useState<PaymentDraft>({
    workspaceId: activeWorkspace?.id ?? '',
    supplier: initial?.supplier ?? '',
    project: initial?.project ?? '',
    description: initial?.description ?? '',
    amount: initial?.amount ?? 0,
    vatAmount: initial?.vatAmount ?? 0,
    totalAmount: initial?.totalAmount ?? 0,
    currency: initialCurrency,
    vatCode: initialVatCode,
    vatBreakdown: initialVatCode === 'M' ? calculateVatBreakdown(initialVatBreakdown) : [],
    dueDate: initial?.dueDate ?? new Date().toISOString(),
    requestedBy: initial?.requestedBy ?? 'Finance Manager',
    approvalStatus: initial?.approvalStatus ?? 'draft',
    paymentStatus: initial?.paymentStatus ?? 'unpaid',
    approvedBy: initial?.approvedBy ?? null,
    approvedAt: initial?.approvedAt ?? null,
    paidAt: initial?.paidAt ?? null,
    scheduledDate: initial?.scheduledDate ?? null,
    notes: initial?.notes ?? '',
    linkedTaskId: initial?.linkedTaskId ?? null,
    recurrence: initial?.recurrence ?? null,
    invoiceReference: initial?.invoiceReference ?? '',
    purchaseOrderNumber: initial?.purchaseOrderNumber ?? '',
  });

  const [recurringEnabled, setRecurringEnabled] = useState(!!initial?.recurrence);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof PaymentDraft>(key: K, value: PaymentDraft[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const applyVatCode = (vatCode: VatCode, net: number) => {
    if (vatCode === 'M') {
      const lines = form.vatBreakdown.length
        ? form.vatBreakdown
        : [{ netAmount: net, rate: 20, vatAmount: calculateVat(net, 20) }];
      const breakdown = calculateVatBreakdown(lines);
      const amount = roundMoney(breakdown.reduce((sum, line) => sum + line.netAmount, 0));
      const vatAmount = roundMoney(breakdown.reduce((sum, line) => sum + line.vatAmount, 0));
      setForm(prev => ({ ...prev, vatCode, vatBreakdown: breakdown, amount, vatAmount, totalAmount: roundMoney(amount + vatAmount) }));
      return;
    }

    const rate = vatRateForCode(vatCode);
    const vatAmount = calculateVat(net, rate);
    setForm(prev => ({ ...prev, vatCode, vatBreakdown: [], amount: net, vatAmount, totalAmount: roundMoney(net + vatAmount) }));
  };

  const handleAmountChange = (net: number) => {
    applyVatCode(form.vatCode, roundMoney(net));
  };

  const updateMultiLine = (index: number, updates: Partial<VatBreakdownLine>) => {
    const next = calculateVatBreakdown(form.vatBreakdown.map((line, i) => i === index ? { ...line, ...updates } : line));
    const amount = roundMoney(next.reduce((sum, line) => sum + line.netAmount, 0));
    const vatAmount = roundMoney(next.reduce((sum, line) => sum + line.vatAmount, 0));
    setForm(prev => ({ ...prev, vatBreakdown: next, amount, vatAmount, totalAmount: roundMoney(amount + vatAmount) }));
  };

  const addMultiLine = () => {
    setForm(prev => ({
      ...prev,
      vatBreakdown: [...prev.vatBreakdown, { netAmount: 0, rate: 20, vatAmount: 0 }],
    }));
  };

  const removeMultiLine = (index: number) => {
    const next = calculateVatBreakdown(form.vatBreakdown.filter((_, i) => i !== index));
    const amount = roundMoney(next.reduce((sum, line) => sum + line.netAmount, 0));
    const vatAmount = roundMoney(next.reduce((sum, line) => sum + line.vatAmount, 0));
    setForm(prev => ({ ...prev, vatBreakdown: next, amount, vatAmount, totalAmount: roundMoney(amount + vatAmount) }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.supplier.trim()) e.supplier = 'Supplier is required.';
    if (form.amount <= 0) e.amount = 'Amount must be greater than 0.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({ ...form, recurrence: recurringEnabled ? form.recurrence : null });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Supplier / Payee *"
          value={form.supplier}
          onChange={e => set('supplier', e.target.value)}
          error={errors.supplier}
        />
        <Input
          label="Project / Site"
          value={form.project}
          onChange={e => set('project', e.target.value)}
        />
      </div>

      <Textarea
        label="Description"
        value={form.description}
        onChange={e => set('description', e.target.value)}
        rows={2}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Currency"
          value={form.currency}
          onChange={e => set('currency', e.target.value)}
          options={POPULAR_CURRENCIES}
        />
        <Select
          label="VAT Treatment"
          value={form.vatCode}
          onChange={e => applyVatCode(e.target.value as VatCode, form.amount)}
          options={VAT_OPTIONS.map(option => ({ value: option.value, label: option.label }))}
        />
      </div>

      {form.vatCode === 'M' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">VAT Breakdown</p>
            <Button type="button" variant="outline" size="sm" onClick={addMultiLine}>Add VAT Line</Button>
          </div>
          <div className="space-y-2">
            {form.vatBreakdown.map((line, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
                <Input
                  label={index === 0 ? `Net (${form.currency})` : undefined}
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.netAmount || ''}
                  onChange={e => updateMultiLine(index, { netAmount: parseFloat(e.target.value) || 0 })}
                />
                <Input
                  label={index === 0 ? 'VAT Rate (%)' : undefined}
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.rate || ''}
                  onChange={e => updateMultiLine(index, { rate: parseFloat(e.target.value) || 0 })}
                />
                <Input
                  label={index === 0 ? `VAT (${form.currency})` : undefined}
                  type="number"
                  value={line.vatAmount || ''}
                  readOnly
                  className="bg-slate-50"
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeMultiLine(index)} disabled={form.vatBreakdown.length === 1}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
          {errors.amount && <p className="text-xs text-red-600">{errors.amount}</p>}
          <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <div>
              <p className="text-xs text-slate-500">Net</p>
              <p className="font-semibold text-slate-800">{form.amount.toFixed(2)} {form.currency}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">VAT</p>
              <p className="font-semibold text-slate-800">{form.vatAmount.toFixed(2)} {form.currency}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total</p>
              <p className="font-semibold text-slate-800">{form.totalAmount.toFixed(2)} {form.currency}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
        <Input
          label={`Net Amount (${form.currency}) *`}
          type="number"
          min="0"
          step="0.01"
          value={form.amount || ''}
          onChange={e => handleAmountChange(parseFloat(e.target.value) || 0)}
          error={errors.amount}
        />
        <Input
          label={`VAT (${form.currency})`}
          type="number"
          value={form.vatAmount || ''}
          readOnly
          className="bg-slate-50"
          hint="Auto-calculated"
        />
        <Input
          label={`Total (${form.currency})`}
          type="number"
          value={form.totalAmount || ''}
          readOnly
          className="bg-slate-50"
        />
      </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Due Date"
          type="date"
          value={form.dueDate.slice(0, 10)}
          onChange={e => set('dueDate', new Date(e.target.value).toISOString())}
        />
        <Select
          label="Approval Status"
          value={form.approvalStatus}
          onChange={e => set('approvalStatus', e.target.value as PaymentApprovalStatus)}
          options={APPROVAL_STATUSES}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Invoice Reference"
          value={form.invoiceReference}
          onChange={e => set('invoiceReference', e.target.value)}
          placeholder="INV-0001"
        />
        <Input
          label="Purchase Order Number"
          value={form.purchaseOrderNumber}
          onChange={e => set('purchaseOrderNumber', e.target.value)}
          placeholder="PO-0001"
        />
      </div>

      <Input
        label="Requested By"
        value={form.requestedBy}
        onChange={e => set('requestedBy', e.target.value)}
      />

      <Textarea
        label="Notes"
        value={form.notes}
        onChange={e => set('notes', e.target.value)}
        rows={2}
      />

      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={recurringEnabled}
            onChange={e => setRecurringEnabled(e.target.checked)}
            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm font-medium text-slate-700">Recurring payment</span>
        </label>
        {recurringEnabled && (
          <Select
            value={form.recurrence?.interval ?? 'monthly'}
            onChange={e => set('recurrence', { interval: e.target.value as RecurrenceInterval })}
            options={RECURRENCES}
          />
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave}>
          {initial?.supplier ? 'Save Changes' : 'Add Payment Request'}
        </Button>
      </div>
    </div>
  );
}
