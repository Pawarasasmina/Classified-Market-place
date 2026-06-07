import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';

type SendAuthEmailInput = {
  to: string;
  subject: string;
  heading: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
  fallbackText: string;
};

export type SendMailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Mail.Attachment[];
};

export type MailDeliveryResult = {
  enabled: boolean;
  messageId?: string;
  accepted: string[];
  rejected: string[];
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter?: Transporter;

  constructor(private readonly configService: ConfigService) {}

  async sendAuthEmail(input: SendAuthEmailInput) {
    try {
      const result = await this.sendMail({
        to: input.to,
        subject: input.subject,
        text: [
          input.heading,
          '',
          input.body,
          '',
          `${input.actionLabel}: ${input.actionUrl}`,
          '',
          input.fallbackText,
        ].join('\n'),
        html: this.renderHtml(input),
      });

      return result.enabled && result.rejected.length === 0;
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${input.to}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  async sendMail(input: SendMailInput): Promise<MailDeliveryResult> {
    const recipients = this.normalizeRecipients(input.to);

    if (!recipients.length) {
      throw new Error('At least one email recipient is required');
    }

    const enabled = this.getBoolean('MAIL_ENABLED', this.hasMailConfig());

    if (!enabled) {
      this.logger.log(
        `Mail delivery disabled. Skipped "${input.subject}" to ${recipients.join(
          ', ',
        )}.`,
      );

      return {
        enabled: false,
        messageId: 'mail-disabled',
        accepted: recipients,
        rejected: [],
      };
    }

    const result = await this.getTransporter().sendMail({
      from: this.getFromAddress(),
      to: recipients,
      subject: input.subject,
      text: input.text,
      html: input.html,
      cc: input.cc,
      bcc: input.bcc,
      replyTo: input.replyTo ?? this.getOptionalString('MAIL_REPLY_TO'),
      attachments: input.attachments,
    });

    return {
      enabled: true,
      messageId: result.messageId,
      accepted: this.normalizeRecipients(result.accepted),
      rejected: this.normalizeRecipients(result.rejected),
    };
  }

  async verifyConnection() {
    if (!this.getBoolean('MAIL_ENABLED', this.hasMailConfig())) {
      return { enabled: false, verified: false };
    }

    await this.getTransporter().verify();

    return { enabled: true, verified: true };
  }

  private getTransporter() {
    if (!this.transporter) {
      const host = this.getRequiredMailString('MAIL_HOST', 'SMTP_HOST');
      const port = this.getNumber('MAIL_PORT', 'SMTP_PORT', 587);
      const secure = this.getBoolean(
        'MAIL_SECURE',
        this.getBoolean('SMTP_SECURE', port === 465),
      );
      const user =
        this.getOptionalString('MAIL_USER') ??
        this.getOptionalString('SMTP_USER');
      const pass =
        this.getOptionalString('MAIL_PASSWORD') ??
        this.getOptionalString('SMTP_PASS');

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user || pass ? { user, pass } : undefined,
      });
    }

    return this.transporter;
  }

  private getFromAddress() {
    const address = this.getOptionalString('MAIL_FROM_ADDRESS');
    const name = this.getOptionalString('MAIL_FROM_NAME');

    if (address) {
      return name ? { name, address } : address;
    }

    return (
      this.getOptionalString('MAIL_FROM') ??
      'Classified Marketplace <no-reply@classified.local>'
    );
  }

  private hasMailConfig() {
    const host =
      this.getOptionalString('MAIL_HOST') ??
      this.getOptionalString('SMTP_HOST');
    const user =
      this.getOptionalString('MAIL_USER') ??
      this.getOptionalString('SMTP_USER');
    const pass =
      this.getOptionalString('MAIL_PASSWORD') ??
      this.getOptionalString('SMTP_PASS');

    return [host, user, pass].every((value) => this.isConfigured(value));
  }

  private isConfigured(value: string | undefined) {
    return (
      Boolean(value?.trim()) &&
      !value?.includes('your_') &&
      !value?.includes('xxxxxxxx')
    );
  }

  private getRequiredMailString(primaryKey: string, fallbackKey: string) {
    const value =
      this.getOptionalString(primaryKey) ?? this.getOptionalString(fallbackKey);

    if (!value) {
      throw new Error(
        `${primaryKey} is required when mail delivery is enabled`,
      );
    }

    return value;
  }

  private getOptionalString(key: string) {
    const value = this.configService.get<string>(key);
    const trimmed = value?.trim();

    return trimmed || undefined;
  }

  private getBoolean(key: string, fallback: boolean) {
    const value = this.getOptionalString(key);

    if (value === undefined) {
      return fallback;
    }

    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  private getNumber(primaryKey: string, fallbackKey: string, fallback: number) {
    const value =
      this.getOptionalString(primaryKey) ?? this.getOptionalString(fallbackKey);
    const parsed = value ? Number(value) : Number.NaN;

    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private normalizeRecipients(
    recipients: string | string[] | Array<string | Mail.Address> | undefined,
  ) {
    if (!recipients) {
      return [];
    }

    const values = Array.isArray(recipients) ? recipients : [recipients];

    return values
      .map((recipient) =>
        typeof recipient === 'string' ? recipient : recipient.address,
      )
      .map((recipient) => recipient.trim())
      .filter(Boolean);
  }

  private escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => {
      switch (character) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return character;
      }
    });
  }

  private renderHtml(input: SendAuthEmailInput) {
    const heading = this.escapeHtml(input.heading);
    const body = this.escapeHtml(input.body);
    const actionLabel = this.escapeHtml(input.actionLabel);
    const actionUrl = this.escapeHtml(input.actionUrl);
    const fallbackText = this.escapeHtml(input.fallbackText);

    return `
      <div style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#111827;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:28px 28px 12px;">
                    <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#5b4bdb;">Classified Marketplace</p>
                    <h1 style="margin:0;font-size:24px;line-height:1.25;color:#111827;">${heading}</h1>
                    <p style="margin:18px 0 0;font-size:15px;line-height:1.7;color:#4b5563;">${body}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 28px 28px;">
                    <a href="${actionUrl}" style="display:inline-block;background:#5b4bdb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:6px;padding:13px 18px;">${actionLabel}</a>
                    <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">${fallbackText}</p>
                    <p style="margin:10px 0 0;word-break:break-all;font-size:12px;line-height:1.6;color:#6b7280;">${actionUrl}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;
  }
}
