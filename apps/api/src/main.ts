import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { json, static as serveStatic, urlencoded } from 'express';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const uploadsRoot =
    process.env.MARKETPLACE_MEDIA_UPLOAD_DIR ??
    join(process.cwd(), 'uploads', 'listings');

  if (!existsSync(uploadsRoot)) {
    mkdirSync(uploadsRoot, { recursive: true });
  }

  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.use('/uploads/listings', serveStatic(uploadsRoot));
  app.use(json({ limit: '12mb' }));
  app.use(urlencoded({ extended: true, limit: '12mb' }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);
  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
}
void bootstrap();
