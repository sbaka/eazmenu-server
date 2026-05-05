import logger from "../logger";

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface BillingChangeEmailInput {
  to: string | null;
  customerName: string;
  changeType: 'upgrade' | 'downgrade' | 'interval_change' | 'cancel' | 'resume';
  fromLabel?: string;
  toLabel?: string;
  effectiveDate?: Date | null;
}

const RESEND_API_URL = 'https://api.resend.com/emails';

function getBillingEmailSubject(changeType: BillingChangeEmailInput['changeType']): string {
  switch (changeType) {
    case 'upgrade':
      return 'Your Eazmenu plan was upgraded';
    case 'downgrade':
      return 'Your Eazmenu plan change was confirmed';
    case 'interval_change':
      return 'Your Eazmenu billing frequency was changed';
    case 'cancel':
      return 'Your Eazmenu subscription cancellation was scheduled';
    case 'resume':
      return 'Your Eazmenu subscription was resumed';
  }
}

function formatDate(date: Date | null | undefined): string {
  return date ? date.toLocaleDateString('en-GB') : 'your next billing date';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderBillingChangeEmail(input: BillingChangeEmailInput): Pick<EmailMessage, 'subject' | 'html' | 'text'> {
  const subject = getBillingEmailSubject(input.changeType);
  const customerName = escapeHtml(input.customerName);
  const fromLabel = input.fromLabel ? escapeHtml(input.fromLabel) : null;
  const toLabel = input.toLabel ? escapeHtml(input.toLabel) : null;
  const changeLine = input.fromLabel && input.toLabel
    ? `<p><strong>Change:</strong> ${fromLabel} to ${toLabel}</p>`
    : '';
  const effectiveLine = `<p><strong>Effective date:</strong> ${formatDate(input.effectiveDate)}</p>`;
  const text = [
    `Hi ${input.customerName},`,
    subject,
    input.fromLabel && input.toLabel ? `Change: ${input.fromLabel} to ${input.toLabel}` : null,
    `Effective date: ${formatDate(input.effectiveDate)}`,
    'If you did not request this change, contact contact@eazmenu.com immediately.',
  ].filter(Boolean).join('\n');

  return {
    subject,
    text,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px;margin:0 auto;padding:24px;">
        <div style="border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <div style="background:#111827;color:#ffffff;padding:24px;">
            <h1 style="margin:0;font-size:24px;">Eazmenu</h1>
          </div>
          <div style="padding:24px;">
            <h2 style="margin:0 0 16px;font-size:20px;">${subject}</h2>
            <p>Hi ${customerName},</p>
            <p>This email confirms a billing change on your Eazmenu account.</p>
            <div style="background:#f9fafb;border-radius:12px;padding:16px;margin:16px 0;">
              ${changeLine}
              ${effectiveLine}
            </div>
            <p>If you did not request this change, contact us immediately at <a href="mailto:contact@eazmenu.com">contact@eazmenu.com</a>.</p>
          </div>
        </div>
      </div>
    `,
  };
}

async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BILLING_EMAIL_FROM ?? 'Eazmenu <billing@eazmenu.com>';

  if (!apiKey) {
    logger.info(`Billing email skipped because RESEND_API_KEY is not configured: ${message.subject} -> ${message.to}`);
    return;
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send billing email: ${response.status} ${body}`);
  }
}

export async function sendBillingChangeEmail(input: BillingChangeEmailInput): Promise<void> {
  if (!input.to) {
    logger.warn(`Billing email skipped because merchant has no email: ${input.changeType}`);
    return;
  }

  const rendered = renderBillingChangeEmail(input);
  await sendEmail({
    to: input.to,
    ...rendered,
  });
}