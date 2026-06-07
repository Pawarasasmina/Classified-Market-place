import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AdminReportEmailParamsDto,
  AdminReportEmailType,
  SendAdminReportEmailDto,
} from './send-admin-report-email.dto';

describe('SendAdminReportEmailDto', () => {
  async function validateDto(input: Record<string, unknown>) {
    const dto = plainToInstance(SendAdminReportEmailDto, input);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    return { dto, errors };
  }

  it('accepts recipients, optional message, and filters', async () => {
    const { dto, errors } = await validateDto({
      recipients: ['admin@example.com', 'ops@example.com'],
      subject: 'Active listings report',
      message: 'Sharing today for review.',
      filters: {
        days: 30,
        take: 100,
      },
    });

    expect(errors).toHaveLength(0);
    expect(dto.recipients).toEqual(['admin@example.com', 'ops@example.com']);
    expect(dto.filters?.days).toBe(30);
    expect(dto.filters?.take).toBe(100);
  });

  it('normalizes comma-separated recipient emails', async () => {
    const { dto, errors } = await validateDto({
      recipients: 'admin@example.com, ops@example.com',
      filters: {
        days: 7,
        topTake: 8,
      },
    });

    expect(errors).toHaveLength(0);
    expect(dto.recipients).toEqual(['admin@example.com', 'ops@example.com']);
  });

  it('accepts supported report types in route params', async () => {
    const params = plainToInstance(AdminReportEmailParamsDto, {
      reportType: AdminReportEmailType.MONITORING,
    });
    const errors = await validate(params);

    expect(errors).toHaveLength(0);
  });

  it('rejects unsupported report types in route params', async () => {
    const params = plainToInstance(AdminReportEmailParamsDto, {
      reportType: 'unknown-report',
    });
    const errors = await validate(params);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('reportType');
  });

  it('rejects invalid recipients', async () => {
    const { errors } = await validateDto({
      recipients: ['not-an-email'],
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('recipients');
  });

  it('validates filter limits', async () => {
    const { errors } = await validateDto({
      recipients: ['admin@example.com'],
      filters: {
        days: 366,
        take: 201,
        topTake: 21,
      },
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('filters');
    expect(errors[0].children?.map((error) => error.property)).toEqual([
      'days',
      'take',
      'topTake',
    ]);
  });
});
