# Phase 1 Web Scope

This repository now includes the original source documents used for planning:

- `docs/Classified_Marketplace_TRD.docx`
- `docs/Classified_marketplace_Full_Delivery_Plan.docx`

## Phase 1 routes deployed in `apps/web`

Based on the TRD sections `6.1` to `6.4` and the MVP delivery plan sprints, the web app now includes:

- `/` : marketplace home and Phase 1 route hub
- `/categories` : category tree and schema-backed field previews
- `/search` : active listing search with category and sort filters
- `/listings/[listingId]` : listing detail, seller widget, related listings, and share/report actions
- `/sell` : multi-step listing creation wizard with local draft recovery
- `/saved` : saved items and saved search placeholders
- `/my-listings` : seller-side listing management view
- `/profile` : profile CRUD and seller trust summary
- `/messages` : inbox and buyer-to-seller conversation workspace
- `/login` : sign-in flow scaffold
- `/register` : registration flow scaffold
- `/verify` : OTP verification step for posting readiness
- `/admin` : moderation queue aligned to MVP release hardening

## Phase 1 coverage reflected in the app

- Authentication scaffolding
- OTP verification checkpoint
- Category-driven listing creation
- Draft save and recovery behavior
- Search and browse flows
- Listing detail with seller context
- Saved items and saved searches
- Chat and inbox UI
- Admin moderation surface

## Current implementation note

This is a working Phase 1 web prototype with shared mock marketplace data and connected navigation. It is ready for backend integration with the planned NestJS services in later implementation steps.
