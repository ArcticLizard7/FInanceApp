import type { VatCode } from '@/types';

export const VAT_OPTIONS: { value: VatCode; label: string; rate: number | null }[] = [
  { value: 'S', label: 'Standard (S) - 20%', rate: 20 },
  { value: 'R', label: 'Reduced (R) - 5%', rate: 5 },
  { value: 'Z', label: 'Zero (Z) - 0%', rate: 0 },
  { value: 'M', label: 'Multi VAT (M)', rate: null },
];

export const vatRateForCode = (code: VatCode) =>
  VAT_OPTIONS.find(option => option.value === code)?.rate ?? 0;
