import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsInterceptor } from './audit-logs.interceptor';
import { AuditLogsService } from './audit-logs.service';

@Module({
  controllers: [AuditLogsController],
  providers: [
    AuditLogsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogsInterceptor,
    },
  ],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
