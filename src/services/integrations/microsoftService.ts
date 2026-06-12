// ============================================================
// Microsoft 365 Integration — Placeholder
// To activate:
//   1. Register an app in Azure AD (app registrations)
//   2. Add scopes: Mail.Send, Calendars.ReadWrite, Tasks.ReadWrite
//   3. Use @azure/msal-browser for auth
//   4. Replace stubs below with Microsoft Graph calls
//      Base URL: https://graph.microsoft.com/v1.0
// ============================================================

export interface MSGraphConfig {
  clientId: string;
  tenantId: string;
  redirectUri: string;
}

// Stub — returns false until real MSAL auth is configured
export const microsoftService = {
  isConnected(): boolean {
    return false;
  },

  async signIn(_config: MSGraphConfig): Promise<void> {
    throw new Error('Microsoft 365 integration not yet configured.');
  },

  // POST /me/sendMail
  async sendEmail(_payload: unknown): Promise<void> {
    throw new Error('Microsoft Graph email not yet configured.');
  },

  // POST /me/todo/lists/{listId}/tasks
  async createPlannerTask(_payload: unknown): Promise<void> {
    throw new Error('Microsoft Planner integration not yet configured.');
  },

  // GET /me/events
  async getCalendarEvents(_from: Date, _to: Date): Promise<unknown[]> {
    throw new Error('Outlook Calendar integration not yet configured.');
  },

  // GET /me/drive/root/children
  async listOneDriveFiles(_folderId?: string): Promise<unknown[]> {
    throw new Error('OneDrive integration not yet configured.');
  },
};
