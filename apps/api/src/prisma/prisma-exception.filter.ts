import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import {
  getPrismaErrorMessage,
  isPrismaConnectionError,
  isPrismaInitializationError,
  isPrismaKnownError,
} from './prisma-errors';

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientInitializationError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<{ url?: string }>();

    if (isPrismaConnectionError(exception)) {
      this.logger.warn(
        `Database unavailable while handling ${request.url ?? 'request'}: ${getPrismaErrorMessage(
          exception,
        )}`,
      );
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message:
          'Database is temporarily unavailable. Please verify the database connection and try again.',
        error: 'Service Unavailable',
      });
      return;
    }

    this.logger.error(getPrismaErrorMessage(exception));
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Database request failed',
      error: 'Internal Server Error',
    });
  }
}
