# Database Notes

- ORM: Prisma
- Database: PostgreSQL
- Keep connection strings in environment variables

## Local Development

You do not need to run a database migration every time you start the API.
Run a migration only when `apps/api/prisma/schema.prisma` changes, or when you
connect a fresh database that has not received the existing migrations yet.

For normal local development:

```bash
cd apps/api
npm run start:dev
```

For a fresh local database, or after pulling new migration files:

```bash
cd apps/api
npm run db:migrate
```

For quick local-only schema experiments where you do not want to create a
migration file yet:

```bash
cd apps/api
npm run db:push
```

Use `db:push` only for disposable local development databases. For shared
development, staging, and production databases, use migrations so schema changes
are tracked and repeatable.

## Useful Commands

```bash
npm run db:migrate   # apply/create dev migrations
npm run db:push      # sync schema to local DB without migration files
npm run db:generate  # regenerate Prisma Client
npm run db:studio    # open Prisma Studio
npm run db:deploy    # apply migrations in staging/production
```
