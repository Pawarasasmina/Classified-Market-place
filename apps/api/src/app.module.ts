import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BoostsModule } from './boosts/boosts.module';
import { CategoriesModule } from './categories/categories.module';
import { ListingsModule } from './listings/listings.module';
import { MediaModule } from './media/media.module';
import { MessagingModule } from './messaging/messaging.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    PaymentsModule,
    BoostsModule,
    MediaModule,
    ListingsModule,
    MessagingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
