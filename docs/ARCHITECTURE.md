# Architecture

## System map

```
Browser/Mobile
   |
   |-- Vercel Edge Middleware (frontend/middleware.js) -- intercepts bot requests to
   |     /listings/:id, fetches listing data from the backend, injects OG meta tags,
   |     redirects real users to the SPA via <meta http-equiv="refresh">
   |
   |-- React SPA (Vite build, Vercel) -- TanStack Query for all server state
         |
         |-- Firebase Auth (email/password + Google OAuth) -- JWT issuance/refresh
         |-- Direct upload/download to S3 (presigned URLs, never through the backend)
         |-- REST API (Bearer <firebase JWT>) --> Spring Boot backend (Heroku)
               |
               |-- Firebase Admin SDK -- verifies/decodes the JWT
               |-- MyBatis mappers -- PostgreSQL (Heroku Postgres)
               |-- AWS S3 SDK -- presigned PUT/GET URL generation
               |-- CloudFront -- permanent image URLs in production (see below)
               |-- Resend -- transactional + campaign email
               |-- Slack webhook -- internal notifications (listings, reports, campaigns)
               |-- IndexNow -- pings search engines on listing changes
```

There is a second, smaller backend surface independent of the Spring Boot app:
**`functions/`** (Firebase Cloud Functions, `functions/index.js`, ~138 lines) sends its own
Slack notifications (admin user-count digest) via `functions.config().slack.webhook`. This is a
deliberately separate integration — its own code comment says not to move it into `SlackService`.
Easy to forget this surface exists since nothing else references it.

## Why MyBatis, not Hibernate/JPA

Explicit SQL control is intentional for complex filtering queries that lean on PostgreSQL-native
operators (array containment for amenities, dynamic WHERE clauses via
`ListingFilterSqlProvider`). `spring.jpa.hibernate.ddl-auto=validate` is set in
`application-production.properties` but is a no-op leftover — there are no JPA entities in this
codebase, nothing uses Hibernate.

## Request flows

### Auth
1. Frontend calls Firebase (`signInWithEmailAndPassword` / Google popup) and gets a JWT via
   `user.getIdToken()` — fetched fresh on every request, not cached.
2. Every authenticated call attaches `Authorization: Bearer <token>` and goes through
   `services/apiService.js`'s `ApiService` class (see `FRONTEND.md`).
3. Backend decodes/verifies the token via `AuthService`/Firebase Admin SDK and resolves a UID.
4. `getOrCreateUserFromToken` lazily creates a `Users` row on first sight of a UID — meaning even
   a 403 from `/admin/*` performed by a logged-in non-admin user creates a DB row as a side effect
   (see `KNOWN_ISSUES.md`).
5. Admin auth is a single hardcoded UID/password comparison (`ADMIN_UID`/`ADMIN_PASSWORD`), not a
   role table — see `SECURITY.md`.

### Image upload / delivery
1. Frontend requests listing creation/edit; backend generates a presigned S3 PUT URL (30 min
   expiry) per image and returns it alongside the created/updated listing.
2. Frontend uploads directly to S3 — the backend never relays image bytes.
3. **Delivery differs by environment**: in production, `ListingService.getImageUrls()` returns
   permanent CloudFront URLs via `S3Service.getImageUrl()`. In local dev, it falls back to
   presigned S3 GET URLs. The response field is named `preSignedGetUrls` on the model in both
   cases, but in prod these are **permanent CDN URLs, not expiring signed URLs** — don't assume
   they expire just because of the field name.

### Messaging
1. Conversations are keyed by `(ListingID, RequesterID)` with a UNIQUE constraint — one
   conversation per listing per requester.
2. Message content is encrypted with AES-256-GCM before storage (`EncryptionUtil`, see
   `SECURITY.md`) and decrypted on read.
3. No WebSockets — the frontend polls: conversation list every 30s, an open message thread every
   10s (`messageQueries.js`).
4. Deleting a conversation is a soft delete (`DeletedConversations` table); it reappears for a
   user automatically if a new message arrives.
5. Two scheduled jobs in `MessageService` send unread-message notification/reminder emails —
   near-duplicate implementations, see `KNOWN_ISSUES.md`.

### Listing lifecycle
Create → `AVAILABLE`/`PENDING`/`TAKEN`/etc. (see `types/Status.java`) → a scheduled expiry job in
`ListingService` transitions past-`endDate` listings → soft/hard delete. Status changes, photo
reordering, and parking-spot upserts are all handled inside `ListingService.updateListing`, by far
the largest method in the backend (see `KNOWN_ISSUES.md` for the refactor flag).

## Schema

No migration tool (no Flyway/Liquibase). The only schema definition anywhere in the repo is
`backend/src/integration/resources/seed.sql`, which is for integration-test fixtures only — it is
not kept in sync with production Postgres by any tooling, and drift between the two is a real,
unmitigated risk. 17 tables currently exist (see `seed.sql` for the authoritative current list):
`Users`, `Listings`, `ListingPhotos`, `ListingParking`, `deleted_listings`, `SavedListings`,
`SavedListingLink`, `Conversations`, `Messages`, `DeletedConversations`, `EmailOptOuts`,
`CampaignSends`, `Reports`, `BlockedUsers`, `popup_types`, `popup_interactions`, `feedback`.

Schema changes to the real production database must be run by hand against Heroku Postgres —
there is no automated path. If you add/change a table, update `seed.sql` to match, but know that
alone does **not** apply the change to production.

## Deployment

See root `CLAUDE.md`'s "Deployment" section and
`~/Desktop/justin-notes/02 MadLease/Engineering/Deployment.md` for the full, current deploy
pipeline (frontend via Vercel webhook + PR-to-Ben for promotion, backend via `git subtree` push to
a separate GitHub repo that Heroku auto-deploys from).
