import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { BoostStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const defaultSweepIntervalMs = 60_000;
const expirableBoostStatuses = [BoostStatus.SCHEDULED, BoostStatus.ACTIVE];

function getSweepIntervalMs() {
  const configured = Number(process.env.BOOST_EXPIRATION_SWEEP_MS);

  if (Number.isFinite(configured) && configured >= 10_000) {
    return configured;
  }

  return defaultSweepIntervalMs;
}

@Injectable()
export class BoostExpirationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BoostExpirationService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.expireEndedBoosts();

    this.timer = setInterval(() => {
      void this.expireEndedBoosts().catch((error: unknown) => {
        this.logger.warn(
          error instanceof Error
            ? error.message
            : 'Could not expire ended boosts',
        );
      });
    }, getSweepIntervalMs());
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async expireEndedBoosts(now = new Date()) {
    return this.prisma.boost.updateMany({
      where: {
        status: { in: expirableBoostStatuses },
        endsAt: { lte: now },
      },
      data: {
        status: BoostStatus.EXPIRED,
      },
    });
  }
}
