import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('MailService', () => {
  const createConfig = (values: Record<string, string | undefined>) =>
    ({
      get: jest.fn((key: string) => values[key]),
    }) as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips delivery when mail is disabled', async () => {
    const service = new MailService(createConfig({ MAIL_ENABLED: 'false' }));

    const result = await service.sendMail({
      to: 'admin@example.com',
      subject: 'Operations report',
      text: 'Report body',
    });

    expect(result).toEqual({
      enabled: false,
      messageId: 'mail-disabled',
      accepted: ['admin@example.com'],
      rejected: [],
    });
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('requires SMTP host when mail is enabled', async () => {
    const service = new MailService(
      createConfig({
        MAIL_ENABLED: 'true',
        MAIL_FROM_ADDRESS: 'reports@example.com',
      }),
    );

    await expect(
      service.sendMail({
        to: 'admin@example.com',
        subject: 'Operations report',
        text: 'Report body',
      }),
    ).rejects.toThrow('MAIL_HOST is required when MAIL_ENABLED is true');
  });

  it('sends email through nodemailer when enabled', async () => {
    const sendMail = jest.fn().mockResolvedValue({
      messageId: 'smtp-message-id',
      accepted: ['admin@example.com'],
      rejected: [],
    });
    const verify = jest.fn();

    jest.mocked(nodemailer.createTransport).mockReturnValue({
      sendMail,
      verify,
    } as never);

    const service = new MailService(
      createConfig({
        MAIL_ENABLED: 'true',
        MAIL_HOST: 'smtp.example.com',
        MAIL_PORT: '587',
        MAIL_SECURE: 'false',
        MAIL_USER: 'smtp-user',
        MAIL_PASSWORD: 'smtp-password',
        MAIL_FROM_ADDRESS: 'reports@example.com',
        MAIL_FROM_NAME: 'Reports',
      }),
    );

    const result = await service.sendMail({
      to: 'admin@example.com',
      subject: 'Operations report',
      text: 'Report body',
      html: '<p>Report body</p>',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'smtp-user',
        pass: 'smtp-password',
      },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: {
        name: 'Reports',
        address: 'reports@example.com',
      },
      to: ['admin@example.com'],
      subject: 'Operations report',
      text: 'Report body',
      html: '<p>Report body</p>',
      cc: undefined,
      bcc: undefined,
      replyTo: undefined,
      attachments: undefined,
    });
    expect(result).toEqual({
      enabled: true,
      messageId: 'smtp-message-id',
      accepted: ['admin@example.com'],
      rejected: [],
    });
  });
});
