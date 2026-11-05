# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BadgerSublease is a sublease marketplace for UW-Madison students. The stack is:
- **Frontend:** React 19 + Vite, hosted on Vercel
- **Backend:** Spring Boot 3.4 (Java 17), hosted on Heroku
- **Database:** PostgreSQL (via Heroku)
- **Auth:** Firebase (email/password + Google OAuth)
- **Image Storage:** AWS S3 (upload) + CloudFront CDN (delivery in prod)

## Before Making Changes

- Check `docs/` first: `ARCHITECTURE.md`, `BACKEND.md`, `FRONTEND.md`, `CONVENTIONS.md`,
  `SECURITY.md`, `KNOWN_ISSUES.md`. These are the source of truth for how this app is built and
  the patterns to follow — read the relevant one before touching a given area instead of
  re-deriving it from scratch.
- Follow `docs/CONVENTIONS.md`, not whichever inconsistent pattern happens to be nearest in the
  file you're editing — a full repo audit (Oct 2026) found real inconsistencies (mixed logging
  styles, mixed numeric-field validation patterns, duplicated auth-check helpers, two independent
  filter-UI implementations) that should converge, not multiply.
- Check `docs/KNOWN_ISSUES.md` before assuming something is a new bug — it may already be tracked
  there.

## Commands

### Frontend (`/frontend`)
```bash
npm run dev       # Start Vite dev server
npm run build     # Production build
npm run lint      # ESLint
npm run preview   # Preview production build locally
```

### Backend (`/backend`)
```bash
./gradlew bootRun        # Run locally
./gradlew build          # Build JAR
./gradlew clean build    # Clean build
./gradlew test           # Run tests
```

## Architecture

### Frontend Structure
- **[frontend/src/pages/](frontend/src/pages/)** — Route-level components (Home, Listings, ListingDetails, CreateListing, EditListings, Profile, Contact, Legal, NotFound)
- **[frontend/src/components/](frontend/src/components/)** — Reusable UI (Navbar, ListingCard, Filters, Map, AuthModal, ConversationList/View, SortableImageGrid, ProtectedRoute, ErrorBoundary)
- **[frontend/src/services/](frontend/src/services/)** — TanStack Query hooks (`listingQueries.js`, `messageQueries.js`) and **[apiService.js](frontend/src/services/apiService.js)**, which exports `API_BASE_URL` and the `ApiService` singleton class (`get`/`post`/`put`/`patch`/`delete`/`postMultipart`/`putMultipart`) that attaches a fresh Firebase JWT to every request
- **[frontend/src/context/](frontend/src/context/)** — `AuthContext.jsx` (Firebase auth state), `ThemeContext.jsx` (light/dark mode)

**State management:** TanStack React Query for all server state. Queries are cached in localStorage with a 90-minute max age and 5-minute stale time. Prefetching happens on app load.

### Backend Structure (`com/badgersublease/backend/`)
Directory names and `package` declarations are all lowercase (`controller/`, `service/`,
`mapper/`, `model/`, `config/`, `util/`, etc.) — not capitalized. See `docs/BACKEND.md` for the
full inventory.
- **controller/** — `BackendController.java` (main routes), `AdminController.java`, `SeoController.java`
- **service/** — Business logic: `ListingService`, `UserService`, `MessageService` (encryption), `AuthService` (Firebase token verification), `S3Service` (presigned PUT URLs for upload, CloudFront GET URLs for delivery), `EmailService`, `RateLimitService`, and more — see `docs/BACKEND.md`
- **mapper/** — MyBatis SQL mappers. `ListingFilterSqlProvider.java` builds dynamic WHERE clauses for search filtering
- **model/** — `Listing`, `User`, `Message`, `Conversation`, `Report`, `Email`
- **config/** — `CorsConfig`, `FirebaseConfig`, `S3Config`, `RateLimitConfig`
- **util/** — `EncryptionUtil.java` (AES-256-GCM with `v1:` prefix for key rotation support)

**ORM:** MyBatis (not Hibernate) — explicit SQL control is intentional for complex filtering queries using PostgreSQL-native operators.

**Authentication flow:** Every protected endpoint extracts the Firebase UID from a Bearer JWT via `AuthService.getFirebaseUidFromToken()`.

**Image upload flow:** Backend generates presigned S3 PUT URLs (30 min expiry) — the browser uploads directly to S3, never through the backend.

**Image delivery:** In production, `ListingService.getImageUrls()` returns permanent CloudFront URLs via `S3Service.getImageUrl()`. In local dev, it falls back to presigned S3 GET URLs. The field is named `preSignedGetUrls` on the model but in prod these are permanent CDN URLs, not expiring signed URLs.
**OG / social previews:** `frontend/middleware.js` is a Vercel Edge Middleware that intercepts bot requests to `/listings/:id`, fetches listing data from the backend, and serves a custom HTML page with OG meta tags (using the CloudFront image URL in prod). Real users are redirected to the SPA via `<meta http-equiv="refresh">`.

### Key Patterns
- **Message encryption:** AES-256-GCM, random 12-byte IV per message, versioned with `v1:` prefix
- **Rate limiting:** Bucket4j per-user/IP; returns 429 with `Retry-After` header
- **View tracking:** `sessionStorage` prevents view count inflation on refresh; `?track=false` query param skips tracking
- **UW-Madison verification:** Auto-verified for `@wisc.edu` email domain on registration

## Environment Variables

**Frontend** (`.env.local` for dev, Vercel for prod):
```
VITE_API_BASE_URL
VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID, VITE_FIREBASE_MEASUREMENT_ID
```

**Backend** (Heroku config vars):
```
DATABASE_URL, DATABASE_USERNAME, DATABASE_PASSWORD
AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME, AWS_REGION, AWS_CLOUDFRONT_DOMAIN
FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
CORS_ALLOWED_ORIGINS
MESSAGE_ENCRYPTION_KEY  (base64-encoded 32-byte key)
ACTIVE_PROFILE          (set to "production")
ADMIN_UID, ADMIN_PASSWORD
RESEND_API_KEY, MADLEASE_NOREPLY_EMAIL, MADLEASE_SUPPORT_EMAIL
UNSUBSCRIBE_SECRET, MADLEASE_MAILING_ADDRESS
SLACK_WEBHOOK_URL
```

(`MADLEASE_EMAIL`/`MADLEASE_EMAIL_PASSWORD` no longer exist — that was a pre-Resend Gmail-SMTP
leftover, removed from this list during the Oct 2026 audit. Email now goes through Resend.)

Backend profile is controlled by `ACTIVE_PROFILE` env var (`local` or `production`), which selects `application-{profile}.properties`.

## Mobile Layout Patterns

`index.html` uses `viewport-fit=cover` — content extends edge-to-edge behind the iOS dynamic island and Android status bar. `env(safe-area-inset-top/bottom)` are always set and must be respected.

### Standard mobile pages (Home, Profile, Listings, etc.)
Use **native body scroll** so Safari's Liquid Glass toolbar auto-minimizes:
- Outer container: `minHeight: '100lvh', height: 'auto'`
- Bottom padding on last content element: `max(1rem, env(safe-area-inset-bottom))`
- The Navbar handles the top safe area with a `position: fixed` strip that fills behind the status bar

### Full-screen overlay pages (ConversationView)
When a page has its own header that replaces the global Navbar, use **`position: fixed; inset: 0`** on the outer container:
```jsx
position: isMobile ? 'fixed' : 'relative',
inset: isMobile ? 0 : 'auto',
zIndex: isMobile ? 1 : 'auto',
```
- This covers the full screen from the very first paint — no JS/useEffect class hacks, no flash
- The Navbar already returns `null` on `/messages/:id` on mobile, so no stacking issue
- Chat header needs `paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)'` so content clears the status bar while the header background fills behind it
- Input bar needs `paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))'` to clear home indicator / Android nav bar
- Messages area: `flex: 1, minHeight: 0, overflowY: 'auto', justifyContent: 'flex-end'` — anchors messages to bottom iMessage-style
- Do NOT use `useMobileScrollLock` or body class manipulation for this — `position: fixed; inset: 0` is self-contained

## Obsidian Engineering Notes

Engineering documentation is maintained at `/Users/justinkim/Desktop/justin-notes/02 MadLease/Engineering/`. After making changes that affect the following, update the relevant note:

- **Architecture.md** — new services, integrations, major patterns, route changes, auth flow changes
- **Database.md** — new tables, columns, index changes, schema decisions
- **Deployment.md** — env var additions, CI/CD changes, new environments, Heroku/Vercel config changes
- **Local Dev Setup.md** — new prerequisites, changed ports/credentials, new local config steps

Keep notes factual and current — remove stale info, don't just append.

## Deployment

CI/CD is via GitHub Actions (`.github/workflows/main.yml`):
- Push to `main` → triggers Vercel production deploy webhook
- Push to `preprod` → triggers Vercel preprod deploy webhook
- Note: Justin doesn't hold Vercel deploy credentials — promoting to `preprod`/`main` in practice requires a PR merged by Ben.

Backend deploys via `git subtree push --prefix backend backend-deploy main` into the separate `madlease/madlease_backend` GitHub repo, which Heroku auto-deploys from via its GitHub integration (not a direct `heroku` git remote). The `Procfile` runs the built JAR with `$PORT` and `$JAVA_OPTS`.

This repo lives alongside `MadLeaseAdmin` and `marketing-agent` under `~/Developer/MadLease/` — see that folder's `README.md` for the full map, and `~/Desktop/justin-notes/02 MadLease/Engineering/Deployment.md` for full deploy detail.
