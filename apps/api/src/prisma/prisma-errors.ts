import { Prisma } from '@prisma/client';

export function isPrismaKnownError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

export function isPrismaInitializationError(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError;
}

export function isPrismaConnectionError(error: unknown) {
  if (isPrismaKnownError(error)) {
    return error.code === 'P1001';
  }

  return isPrismaInitializationError(error);
}

export function getPrismaErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Database request failed';
}
