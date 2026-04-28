# Classified Marketplace Monorepo

This repository contains a starter monorepo for a 2-developer MVP team.

## Structure
- `apps/web`: Next.js 14+ (TypeScript, App Router, Tailwind, ESLint)
- `apps/mobile`: Expo React Native (TypeScript)
- `apps/api`: NestJS API (TypeScript)
- `packages/shared`: Shared types/constants
- `docs`: Project notes

## Prerequisites
- Node.js 20 LTS recommended
- npm 10+
- Expo Go app on your phone (for mobile testing)

## Run Web
```bash
cd apps/web
npm run dev
```

## Run Mobile
```bash
cd apps/mobile
npm run start
```
Then press `a` for Android emulator, `i` for iOS simulator (macOS), or scan QR using Expo Go.

## Run API
```bash
cd apps/api
npm run start:dev
```

## Prisma (API)
```bash
cd apps/api
npx prisma init
```
Create `.env` from `.env.example` and set `DATABASE_URL` later.

## Notes
- No Docker/Kubernetes included yet.
- No business features implemented yet.
"# Classified-Market-place" 
"# Classified-Market-place" 
