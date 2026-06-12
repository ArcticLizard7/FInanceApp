// ============================================================
// Excel Import Service
// Uses read-excel-file to parse uploaded .xlsx files.
// ============================================================

import { readSheet, type CellValue, type Row, type SheetData } from 'read-excel-file/browser';
import { uuidv4 } from '@/utils/id';
import type { Task, PaymentRequest, ExcelImportRow, ColumnMapping } from '@/types';

export const excelService = {
  parseFile(file: File): Promise<{ sheets: string[]; rows: ExcelImportRow[]; headers: string[] }> {
    return readSheet(file)
      .then((sheetRows: SheetData) => {
        const [headerRow = [], ...dataRows] = sheetRows;
        const headers = headerRow.map((cell: CellValue | null) => String(cell ?? '').trim()).filter(Boolean);
        const rows = dataRows.map((row: Row) =>
          Object.fromEntries(headers.map((header: string, index: number) => [header, row[index] ?? null]))
        ) as ExcelImportRow[];
        return { sheets: ['Sheet 1'], rows, headers };
      })
      .catch(() => {
        throw new Error('Failed to parse Excel file. Ensure it is .xlsx format.');
      });
  },

  rowsToTasks(
    rows: ExcelImportRow[],
    mappings: ColumnMapping[],
    workspaceId: string,
    tenantId: string = '',
  ): { tasks: Task[]; errors: string[] } {
    const tasks: Task[] = [];
    const errors: string[] = [];
    const map = Object.fromEntries(mappings.map(m => [m.targetField, m.sourceColumn]));

    rows.forEach((row, i) => {
      const title = map['title'] ? String(row[map['title']] ?? '') : '';
      if (!title.trim()) {
        errors.push(`Row ${i + 2}: Missing title — skipped.`);
        return;
      }
      tasks.push({
        id: uuidv4(),
        tenantId,
        workspaceId,
        title: title.trim(),
        description: map['description'] ? String(row[map['description']] ?? '') : '',
        category: 'general_admin',
        status: 'todo',
        priority: 'medium',
        dueDate: map['dueDate'] ? String(row[map['dueDate']] ?? '') : null,
        assignedTo: null,
        assignedToName: map['assignedTo'] ? String(row[map['assignedTo']] ?? '') : null,
        assignedToEmail: null,
        delegatedBy: null,
        notes: map['notes'] ? String(row[map['notes']] ?? '') : '',
        attachments: [],
        checklist: [],
        recurrence: null,
        reminder: null,
        parentTaskId: null,
        linkedPaymentRequestId: null,
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      });
    });

    return { tasks, errors };
  },

  rowsToPayments(
    rows: ExcelImportRow[],
    mappings: ColumnMapping[],
    workspaceId: string,
    tenantId: string = '',
    currency: string = 'GBP',
  ): { payments: PaymentRequest[]; errors: string[] } {
    const payments: PaymentRequest[] = [];
    const errors: string[] = [];
    const map = Object.fromEntries(mappings.map(m => [m.targetField, m.sourceColumn]));

    rows.forEach((row, i) => {
      const supplier = map['supplier'] ? String(row[map['supplier']] ?? '') : '';
      if (!supplier.trim()) {
        errors.push(`Row ${i + 2}: Missing supplier — skipped.`);
        return;
      }
      const amount = map['amount'] ? parseFloat(String(row[map['amount']] ?? '0')) : 0;
      const vat = parseFloat((amount * 0.20).toFixed(2));

      payments.push({
        id: uuidv4(),
        tenantId,
        workspaceId,
        supplier: supplier.trim(),
        project: map['project'] ? String(row[map['project']] ?? '') : '',
        description: map['description'] ? String(row[map['description']] ?? '') : '',
        amount,
        vatAmount: vat,
        totalAmount: parseFloat((amount + vat).toFixed(2)),
        currency,
        vatCode: 'S',
        vatBreakdown: [],
        dueDate: map['dueDate'] ? String(row[map['dueDate']] ?? '') : new Date().toISOString(),
        requestedBy: map['requestedBy'] ? String(row[map['requestedBy']] ?? '') : '',
        approvalStatus: 'draft',
        paymentStatus: 'unpaid',
        approvedBy: null,
        approvedAt: null,
        paidAt: null,
        scheduledDate: null,
        notes: map['notes'] ? String(row[map['notes']] ?? '') : '',
        linkedTaskId: null,
        recurrence: null,
        invoiceReference: map['invoiceReference'] ? String(row[map['invoiceReference']] ?? '') : '',
        purchaseOrderNumber: map['purchaseOrderNumber'] ? String(row[map['purchaseOrderNumber']] ?? '') : '',
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    return { payments, errors };
  },
};
