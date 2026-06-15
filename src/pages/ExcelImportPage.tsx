import { useState, useRef } from 'react';
import { FileSpreadsheet, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useTaskStore } from '@/stores/taskStore';
import { usePaymentStore } from '@/stores/paymentStore';
import { useAuthStore } from '@/stores/authStore';
import { excelService } from '@/services/excelService';
import { Button } from '@/components/common/Button';
import { Select } from '@/components/common/Input';
import type { ExcelImportRow, ColumnMapping } from '@/types';
import { cn } from '@/utils/cn';

type ImportStep = 'upload' | 'map' | 'preview' | 'done';
type MappingKind = 'tasks' | 'payments';

const TASK_FIELDS = [
  { value: 'title',        label: 'Title' },
  { value: 'description',  label: 'Description' },
  { value: 'dueDate',      label: 'Due Date' },
  { value: 'assignedTo',   label: 'Assigned To' },
  { value: 'notes',        label: 'Notes' },
];

const PAYMENT_FIELDS = [
  { value: 'supplier',            label: 'Supplier' },
  { value: 'project',             label: 'Project / Site' },
  { value: 'description',         label: 'Description' },
  { value: 'amount',              label: 'Net Amount (£)' },
  { value: 'dueDate',             label: 'Due Date' },
  { value: 'requestedBy',         label: 'Requested By' },
  { value: 'invoiceReference',    label: 'Invoice Reference' },
  { value: 'purchaseOrderNumber', label: 'PO Number' },
  { value: 'notes',               label: 'Notes' },
];

export function ExcelImportPage() {
  const { activeWorkspace } = useWorkspaceStore();
  const { importTasks } = useTaskStore();
  const { importPayments } = usePaymentStore();
  const { activeTenantId } = useAuthStore();

  const [step, setStep] = useState<ImportStep>('upload');
  const [rows, setRows] = useState<ExcelImportRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [importType, setImportType] = useState<'tasks' | 'payments' | 'both'>('tasks');
  const [taskMappings, setTaskMappings] = useState<ColumnMapping[]>([]);
  const [paymentMappings, setPaymentMappings] = useState<ColumnMapping[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const wsId = activeWorkspace?.id ?? '';

  const mappingSections: { kind: MappingKind; title: string; fields: typeof TASK_FIELDS }[] = [
    ...(importType === 'tasks' || importType === 'both'
      ? [{ kind: 'tasks' as const, title: 'Task Columns', fields: TASK_FIELDS }]
      : []),
    ...(importType === 'payments' || importType === 'both'
      ? [{ kind: 'payments' as const, title: 'Payment Columns', fields: PAYMENT_FIELDS }]
      : []),
  ];

  const autoMap = (fields: typeof TASK_FIELDS, detectedHeaders: string[]) =>
    fields.map(f => ({
      sourceColumn: detectedHeaders.find(c => {
        const source = c.toLowerCase().replace(/[^a-z0-9]/g, '');
        const target = f.value.toLowerCase().replace(/[^a-z0-9]/g, '');
        const label = f.label.toLowerCase().replace(/[^a-z0-9]/g, '');
        return source.includes(target) || target.includes(source) || source.includes(label) || label.includes(source);
      }) ?? '',
      targetField: f.value,
    }));

  const getMappings = (kind: MappingKind) => kind === 'tasks' ? taskMappings : paymentMappings;

  const handleFile = async (file: File) => {
    try {
      const { rows: r, headers: h } = await excelService.parseFile(file);
      setRows(r);
      setHeaders(h);
      setFileName(file.name);
      setTaskMappings(autoMap(TASK_FIELDS, h));
      setPaymentMappings(autoMap(PAYMENT_FIELDS, h));
      setStep('map');
    } catch (e) {
      setErrors([(e as Error).message]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const updateMapping = (kind: MappingKind, targetField: string, sourceColumn: string) => {
    const setter = kind === 'tasks' ? setTaskMappings : setPaymentMappings;
    setter(prev => prev.map(m => m.targetField === targetField ? { ...m, sourceColumn } : m));
  };

  const handleImport = async () => {
    setImporting(true);
    const errs: string[] = [];
    let count = 0;

    if (importType === 'tasks' || importType === 'both') {
      const { tasks, errors: te } = excelService.rowsToTasks(rows, taskMappings, wsId, activeTenantId ?? '');
      errs.push(...te);
      importTasks(tasks);
      count += tasks.length;
    }

    if (importType === 'payments' || importType === 'both') {
      const { payments, errors: pe } = excelService.rowsToPayments(rows, paymentMappings, wsId, activeTenantId ?? '', activeWorkspace?.currency ?? 'GBP');
      errs.push(...pe);
      importPayments(payments);
      count += payments.length;
    }

    setErrors(errs);
    setImported(count);
    setImporting(false);
    setStep('done');
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Excel Import</h1>
          <p className="text-sm text-slate-500 mt-1">Import tasks or payment requests from a spreadsheet</p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-2 mb-8">
          {(['upload','map','preview','done'] as ImportStep[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
                step === s ? 'bg-brand-600 text-white' : i < ['upload','map','preview','done'].indexOf(step) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
              )}>
                {i < ['upload','map','preview','done'].indexOf(step) ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className="text-sm text-slate-600 capitalize hidden sm:inline">{s === 'map' ? 'Map Columns' : s}</span>
              {i < 3 && <ArrowRight className="w-4 h-4 text-slate-300 mx-1" />}
            </div>
          ))}
        </div>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div className="flex gap-4">
              {(['tasks','payments','both'] as const).map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="importType"
                    value={t}
                    checked={importType === t}
                    onChange={() => setImportType(t)}
                    className="text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm font-medium text-slate-700 capitalize">{t === 'both' ? 'Both' : t}</span>
                </label>
              ))}
            </div>

            <div
              className={cn(
                'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
                isDragging ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
              )}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-sm font-medium text-slate-700">Drop your Excel file here, or click to browse</p>
              <p className="text-xs text-slate-400 mt-1">Supports .xlsx files</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>

            {errors.length > 0 && (
              <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-100 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  {errors.map((e, i) => <p key={i} className="text-sm text-red-700">{e}</p>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: Map */}
        {step === 'map' && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-slate-800">{fileName}</p>
                <p className="text-xs text-slate-500">{rows.length} rows · {headers.length} columns detected</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-card overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-700">Map Columns</h2>
                <p className="text-xs text-slate-500 mt-0.5">Match your spreadsheet columns to the import fields</p>
              </div>
              <div className="p-5 space-y-6">
                {mappingSections.map(section => (
                  <div key={section.kind} className="space-y-3">
                    {importType === 'both' && (
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{section.title}</h3>
                    )}
                    {section.fields.map(f => (
                      <div key={`${section.kind}-${f.value}`} className="flex items-center gap-4">
                        <div className="w-44 text-sm font-medium text-slate-700 flex-shrink-0">{f.label}</div>
                        <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                        <Select
                          value={getMappings(section.kind).find(m => m.targetField === f.value)?.sourceColumn ?? ''}
                          onChange={e => updateMapping(section.kind, f.value, e.target.value)}
                          options={headers.map(h => ({ value: h, label: h }))}
                          placeholder="- Not mapped -"
                          className="flex-1"
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={() => setStep('preview')}>Preview Import</Button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-100 shadow-card overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-700">Preview - first 5 rows</h2>
              </div>
              <div className="overflow-x-auto">
                {mappingSections.map(section => {
                  const mappedFields = section.fields.filter(f =>
                    getMappings(section.kind).find(m => m.targetField === f.value)?.sourceColumn
                  );

                  return (
                    <div key={section.kind} className="min-w-full">
                      {importType === 'both' && (
                        <h3 className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {section.title}
                        </h3>
                      )}
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-100">
                            {mappedFields.map(f => (
                              <th key={f.value} className="px-4 py-2 text-left text-slate-500 font-semibold uppercase tracking-wide whitespace-nowrap">
                                {f.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {rows.slice(0, 5).map((row, i) => (
                            <tr key={i}>
                              {mappedFields.map(f => {
                                const col = getMappings(section.kind).find(m => m.targetField === f.value)?.sourceColumn ?? '';
                                return (
                                  <td key={f.value} className="px-4 py-2 text-slate-700 whitespace-nowrap max-w-xs truncate">
                                    {col ? String(row[col] ?? '-') : '-'}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 bg-brand-50 border border-brand-100 rounded-xl text-sm text-brand-800">
              Ready to import <strong>{rows.length}</strong> rows as {importType === 'both' ? 'tasks and payment requests' : importType}.
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('map')}>Back</Button>
              <Button onClick={handleImport} loading={importing}>Import {rows.length} Rows</Button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Import Complete</h2>
            <p className="text-sm text-slate-500 mt-2">{imported} records imported successfully.</p>

            {errors.length > 0 && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl text-left">
                <p className="text-sm font-medium text-amber-800 mb-2">{errors.length} rows skipped:</p>
                {errors.map((e, i) => <p key={i} className="text-xs text-amber-700">{e}</p>)}
              </div>
            )}

            <Button
              className="mt-6"
              onClick={() => {
                setStep('upload');
                setRows([]);
                setHeaders([]);
                setTaskMappings([]);
                setPaymentMappings([]);
                setErrors([]);
                setImported(0);
              }}
            >
              Import Another File
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
