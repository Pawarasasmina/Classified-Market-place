import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { ChatModule } from './chat/chat.module';
import { ListingsModule } from './listings/listings.module';
import { MessagingModule } from './messaging/messaging.module';
import { ModerationModule } from './moderation/moderation.module';
import { PrismaModule } from './prisma/prisma.module';
import { SavedSearchesModule } from './saved-searches/saved-searches.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ListingsModule,
    MessagingModule,
    SavedSearchesModule,
    ChatModule,
    ModerationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
