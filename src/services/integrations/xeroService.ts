// ============================================================
// Xero Integration — Placeholder
// To activate:
//   1. Create a Xero app at developer.xero.com
//   2. Use OAuth 2.0 with scopes: accounting.transactions, accounting.contacts
//   3. Exchange code for token, store refresh token securely
//   4. Replace stubs with Xero API calls
//      Base URL: https://api.xero.com/api.xro/2.0
// ============================================================

export const xeroService = {
  isConnected(): boolean {
    return false;
  },

  async getInvoices(_orgId: string): Promise<unknown[]> {
    throw new Error('Xero integration not yet configured.');
  },

  async getContacts(_orgId: string): Promise<unknown[]> {
    throw new Error('Xero integration not yet configured.');
  },

  async getCashflow(_orgId: string, _from: Date, _to: Date): Promise<unknown> {
    throw new Error('Xero integration not yet configured.');
  },
};
