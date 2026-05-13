import { ConfigService } from '@nestjs/config';
import { MessagingEncryptionService } from './messaging-encryption.service';

function createService(values: Record<string, string | undefined>) {
  return new MessagingEncryptionService({
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as ConfigService);
}

describe('MessagingEncryptionService', () => {
  it('decrypts messages encrypted before JWT_SECRET was configured', () => {
    const legacyService = createService({});
    const currentService = createService({ JWT_SECRET: 'replace-me' });
    const encrypted = legacyService.encrypt('hello again', {
      attachment: 'receipt.jpg',
    });

    expect(currentService.decrypt(encrypted)).toEqual({
      body: 'hello again',
      payload: { attachment: 'receipt.jpg' },
    });
  });

  it('round trips messages with a configured message encryption key', () => {
    const messageEncryptionKey = Buffer.alloc(32, 7).toString('base64');
    const service = createService({
      MESSAGE_ENCRYPTION_KEY: messageEncryptionKey,
    });
    const encrypted = service.encrypt('new message', null);

    expect(service.decrypt(encrypted)).toEqual({
      body: 'new message',
      payload: null,
    });
  });

  it('decrypts JWT-secret messages after a dedicated message key is added', () => {
    const legacyService = createService({ JWT_SECRET: 'replace-me' });
    const messageEncryptionKey = Buffer.alloc(32, 7).toString('base64');
    const currentService = createService({
      JWT_SECRET: 'replace-me',
      MESSAGE_ENCRYPTION_KEY: messageEncryptionKey,
    });
    const encrypted = legacyService.encrypt('saved history', null);

    expect(currentService.decrypt(encrypted)).toEqual({
      body: 'saved history',
      payload: null,
    });
  });
});
