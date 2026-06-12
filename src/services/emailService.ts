// ============================================================
// Email Service — Mock Implementation
// Replace the sendEmail function body to connect to:
//   - Microsoft Graph: POST /me/sendMail
//   - SendGrid:        POST https://api.sendgrid.com/v3/mail/send
//   - Resend:          POST https://api.resend.com/emails
//   - SMTP:            use Nodemailer on a backend
// ============================================================

export interface EmailPayload {
  to: string;
  toName: string;
  subject: string;
  body: string;
  from?: string;
  fromName?: string;
}

export interface DelegationEmailData {
  taskTitle: string;
  taskDescription: string;
  dueDate: string;
  priority: string;
  notes: string;
  delegatedBy: string;
  recipientName: string;
  recipientEmail: string;
}

const formatDelegationEmail = (data: DelegationEmailData): string => `
Dear ${data.recipientName},

A task has been delegated to you by ${data.delegatedBy}.

TASK: ${data.taskTitle}
─────────────────────────────────────
${data.taskDescription}

Due Date:  ${data.dueDate}
Priority:  ${data.priority}
${data.notes ? `\nNotes:\n${data.notes}` : ''}

Please log in to FinanceFlow to view and update this task.

Regards,
FinanceFlow
`.trim();

// Simulates sending — logs to console in development.
// Returns a resolved promise so callers can await it.
export const emailService = {
  async sendEmail(payload: EmailPayload): Promise<{ success: boolean; messageId: string }> {
    // MOCK: replace this block with real provider code
    console.group('[EmailService] Sending email (mock)');
    console.log('To:     ', payload.to);
    console.log('Subject:', payload.subject);
    console.log('Body:\n', payload.body);
    console.groupEnd();

    await new Promise(r => setTimeout(r, 300)); // simulate latency

    return { success: true, messageId: `mock_${Date.now()}` };
  },

  async sendDelegationEmail(data: DelegationEmailData): Promise<{ success: boolean }> {
    const body = formatDelegationEmail(data);
    return this.sendEmail({
      to: data.recipientEmail,
      toName: data.recipientName,
      subject: `[FinanceFlow] Task delegated to you: ${data.taskTitle}`,
      body,
      fromName: 'FinanceFlow',
      from: 'noreply@financeflow.local',
    });
  },

  async sendReminderEmail(payload: {
    recipientEmail: string;
    recipientName: string;
    subject: string;
    taskTitle: string;
    dueDate: string;
    type: 'task' | 'payment';
  }): Promise<{ success: boolean }> {
    const body = `
Dear ${payload.recipientName},

This is a reminder for: ${payload.taskTitle}
Due: ${payload.dueDate}

Please review and take action in FinanceFlow.

Regards,
FinanceFlow
    `.trim();

    return this.sendEmail({
      to: payload.recipientEmail,
      toName: payload.recipientName,
      subject: payload.subject,
      body,
    });
  },
};
