import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

type SendAuthEmailInput = {
  to: string;
  subject: string;
  heading: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
  fallbackText: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  private isConfigured(value: string | undefined) {
    return (
      Boolean(value?.trim()) &&
      !value?.includes('your_') &&
      !value?.includes('xxxxxxxx')
    );
  }

  private getTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT', '587'));
    const secure =
      this.configService.get<string>('SMTP_SECURE', 'false') === 'true';
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (
      !this.isConfigured(host) ||
      !this.isConfigured(user) ||
      !this.isConfigured(pass)
    ) {
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  private getFromAddress() {
    return (
      this.configService.get<string>('MAIL_FROM') ??
      'Classified Marketplace <no-reply@classified.local>'
    );
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

  async sendAuthEmail(input: SendAuthEmailInput) {
    const transporter = this.getTransporter();

    if (!transporter) {
      this.logger.warn(
        `SMTP is not configured. Email for ${input.to} was not sent.`,
      );
      return false;
    }

    try {
      await transporter.sendMail({
        from: this.getFromAddress(),
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
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${input.to}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }
}
