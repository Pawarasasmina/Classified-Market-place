import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';

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

  async sendMail(input: SendMailInput): Promise<MailDeliveryResult> {
    const enabled = this.getBoolean('MAIL_ENABLED', false);
    const recipients = this.normalizeRecipients(input.to);

    if (!recipients.length) {
      throw new Error('At least one email recipient is required');
    }

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

    const from = this.getFromAddress();
    const replyTo = input.replyTo ?? this.getOptionalString('MAIL_REPLY_TO');
    const result = await this.getTransporter().sendMail({
      from,
      to: recipients,
      subject: input.subject,
      text: input.text,
      html: input.html,
      cc: input.cc,
      bcc: input.bcc,
      replyTo,
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
    if (!this.getBoolean('MAIL_ENABLED', false)) {
      return { enabled: false, verified: false };
    }

    await this.getTransporter().verify();

    return { enabled: true, verified: true };
  }

  private getTransporter() {
    if (!this.transporter) {
      const host = this.getRequiredString('MAIL_HOST');
      const port = this.getNumber('MAIL_PORT', 587);
      const secure = this.getBoolean('MAIL_SECURE', port === 465);
      const user = this.getOptionalString('MAIL_USER');
      const pass = this.getOptionalString('MAIL_PASSWORD');

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
    const address = this.getRequiredString('MAIL_FROM_ADDRESS');
    const name = this.getOptionalString('MAIL_FROM_NAME');

    return name ? { name, address } : address;
  }

  private getRequiredString(key: string) {
    const value = this.getOptionalString(key);

    if (!value) {
      throw new Error(`${key} is required when MAIL_ENABLED is true`);
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

  private getNumber(key: string, fallback: number) {
    const value = this.getOptionalString(key);
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
}
