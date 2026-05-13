import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

@Module({
  imports: [AuthModule],
  controllers: [ModerationController],
  providers: [ModerationService, RolesGuard],
})
export class ModerationModule {}
