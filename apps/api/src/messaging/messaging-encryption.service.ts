import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

type EncryptedValue = {
  encryptedBody: string | null;
  encryptedPayload: string | null;
  encryptionIv: string;
  encryptionAuthTag: string;
};

@Injectable()
export class MessagingEncryptionService {
  constructor(private readonly configService: ConfigService) {}

  private hashSecret(secret: string) {
    return createHash('sha256').update(secret).digest();
  }

  private getConfiguredKey() {
    const configuredKey = this.configService.get<string>(
      'MESSAGE_ENCRYPTION_KEY',
    );

    if (configuredKey) {
      const decoded = Buffer.from(configuredKey, 'base64');

      if (decoded.length === 32) {
        return decoded;
      }
    }

    return null;
  }

  private getCurrentKey() {
    return (
      this.getConfiguredKey() ??
      this.hashSecret(
        this.configService.get<string>('JWT_SECRET', 'dev-secret'),
      )
    );
  }

  private getDecryptionKeys() {
    const keys = [
      this.hashSecret(
        this.configService.get<string>('JWT_SECRET', 'dev-secret'),
      ),
      this.hashSecret('dev-secret'),
    ];
    const configuredKey = this.getConfiguredKey();
    const seen = new Set<string>();

    if (configuredKey) {
      keys.unshift(configuredKey);
    }

    return keys.filter((key) => {
      const fingerprint = key.toString('base64');

      if (seen.has(fingerprint)) {
        return false;
      }

      seen.add(fingerprint);
      return true;
    });
  }

  encrypt(
    body: string | null,
    payload: Record<string, unknown> | null,
  ): EncryptedValue {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getCurrentKey(), iv);
    const plaintext = JSON.stringify({ body, payload });
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    return {
      encryptedBody: encrypted.toString('base64'),
      encryptedPayload: null,
      encryptionIv: iv.toString('base64'),
      encryptionAuthTag: cipher.getAuthTag().toString('base64'),
    };
  }

  decrypt(value: EncryptedValue) {
    let lastError: unknown;

    for (const key of this.getDecryptionKeys()) {
      try {
        const decipher = createDecipheriv(
          'aes-256-gcm',
          key,
          Buffer.from(value.encryptionIv, 'base64'),
        );
        decipher.setAuthTag(Buffer.from(value.encryptionAuthTag, 'base64'));

        const decrypted = Buffer.concat([
          decipher.update(Buffer.from(value.encryptedBody ?? '', 'base64')),
          decipher.final(),
        ]).toString('utf8');

        return JSON.parse(decrypted) as {
          body: string | null;
          payload: Record<string, unknown> | null;
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }
}
