export const POPULAR_CURRENCIES = [
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'NZD', label: 'NZD - New Zealand Dollar' },
  { value: 'CHF', label: 'CHF - Swiss Franc' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
  { value: 'HKD', label: 'HKD - Hong Kong Dollar' },
  { value: 'SGD', label: 'SGD - Singapore Dollar' },
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'AED', label: 'AED - UAE Dirham' },
  { value: 'ZAR', label: 'ZAR - South African Rand' },
  { value: 'SEK', label: 'SEK - Swedish Krona' },
  { value: 'NOK', label: 'NOK - Norwegian Krone' },
  { value: 'DKK', label: 'DKK - Danish Krone' },
] as const;

export const currencyLabel = (code: string) =>
  POPULAR_CURRENCIES.find(currency => currency.value === code)?.label ?? code;
