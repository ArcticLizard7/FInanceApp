// ============================================================
// Access COINS Integration — Placeholder
// COINS OA (Open Architecture) provides REST/SOAP APIs.
// Contact your COINS administrator for endpoint URLs and credentials.
// ============================================================

export const coinsService = {
  isConnected(): boolean {
    return false;
  },

  async getSubcontractOrders(_projectId: string): Promise<unknown[]> {
    throw new Error('COINS integration not yet configured.');
  },

  async getCostCodes(_projectId: string): Promise<unknown[]> {
    throw new Error('COINS integration not yet configured.');
  },

  async getProjectCashflow(_projectId: string): Promise<unknown> {
    throw new Error('COINS integration not yet configured.');
  },
};
