# Known Issues

Tracked findings from a full repo audit (Oct 2026), updated after a remediation pass that fixed
most of the high-severity items (see "Fixed" section at the bottom for what landed and in which
commit). File:line references are accurate as of the audit date — re-verify before assuming they
still apply if significant time has passed. **This file does not fix anything by itself** — it's
a tracking list; each open item below is real follow-up work, not yet scheduled.

## High severity (open)

- **No schema migration tool; confirmed drift.** No Flyway/Liquibase. `backend/src/integration/resources/seed.sql`
  is test-fixture-only and not kept in sync with production Postgres by any tooling. Deferred —
  this is an architectural decision (Flyway vs. Liquibase vs. raw SQL scripts) needing explicit
  sign-off before any tooling gets built, not a mechanical fix.
- **`CreateListing.jsx`/`EditListings.jsx` are ~1900-line near-duplicates** — all 11 `handle*`
  function names are identical between the two files. Single biggest frontend consolidation
  opportunity (~1500+ duplicated lines); a shared `ListingForm` component/hook would eliminate most
  of it. Deferred to a dedicated effort: test-first (characterization tests against current
  behavior), then extract, then human review — too large/risky for an unsupervised single pass.
- **Rotate the Slack webhook.** The hardcoded webhook URL was moved to `${SLACK_WEBHOOK_URL}` (see
  Fixed section), but the actual webhook still needs to be revoked/regenerated in Slack and the
  new value set as a Heroku config var — that's a human action, not something delegable.
- **Old Firebase service-account JSON in git history** (commits `8a7ad41` → `4910329`). Gitignored
  now, not in the current tree, but still recoverable from history. Checking whether it was ever a
  real key requires materializing a credential from git history, which got blocked by this
  session's auto-mode safety classifier (correctly) — needs the user to check directly and decide
  on rotation/history-scrubbing.

## Medium severity (open)

- `ListingService.updateListing` (~150 lines) is the largest method in the backend — ownership
  check, expiry-reactivation, photo reorder, parking upsert, all nested in one transaction
  callback. Extraction candidate (e.g. `handlePhotoReorder`, `handleParkingUpdate`). Deferred —
  touches the same file as other deferred work, needs its own planning pass.
- **Copy-pasted logic, backend:**
  - `MessageService.sendUnreadNotifications`/`sendUnreadReminders` — near-identical ~70-line
    methods, differing only in which mapper query and email template they use.
  - `ListingService`'s image-URL-hydration snippet repeated verbatim in 7 places despite private
    helpers already existing to extract it into.
  - `EmailService`'s HTML email builders repeat the same CTA-button/footer markup inline, no
    shared template.
  - The Firebase "hydrate display name + photo, fallback to 'Unknown User'" pattern is
    independently re-implemented in `MessageService`, `BlockService`, and `ListingService`.
- **Copy-pasted logic, frontend:** `Filters.jsx` vs `MobileFilterSheet.jsx` — ~1900 combined
  lines, fully independent reimplementations of the same filter domain, including a third,
  parallel color-token system in the mobile file. Deferred alongside the CreateListing/EditListings
  consolidation above, same test-first treatment needed. The two raw `fetch()` calls in
  `CreateListing.jsx`/`EditListings.jsx` that bypass `ApiService.postMultipart`/`putMultipart`,
  and their duplicated `uploadWithRetry` helper, fall out naturally once that consolidation
  happens — not fixed separately on purpose.
- **Doing-too-much files:** `Profile.jsx` (2730 lines), `SuccessModal.jsx` (mixes a product-tour
  walkthrough with post-submit confirmation UI), `ConversationList.jsx` (also exports an unrelated
  `BlockedUsersPanel` from the same file). Independent of the Filters/CreateListing work above;
  not yet scheduled.
- `Report.java` model has no validation on free-text `reason`/`reportMessage` fields, inconsistent
  with `Message.content`'s `@Size(max=5000)`.
- `backend/src/integration/` not wired into `build.gradle` as a source set despite its name — it's
  local-dev fixture data, not an active integration-test harness. Judgment call (is that correct,
  or should it be a real test harness?), not an obvious fix — flagged for discussion.

## Low severity (open)

- `BlockedUser` is the only model without Lombok `@Data` (manual getters/setters).
- Commented-out dead JSX in `frontend/src/pages/ListingDetails.jsx:738-739` (unused view/save
  count spans).

## Fixed

- **Hardcoded Slack webhook moved to an env var** — `application-production.properties` now reads
  `${SLACK_WEBHOOK_URL}` instead of a plaintext URL. (Commit `9e1bfad`. Rotating the actual webhook
  value is still open, see above.)
- **Backend test coverage restored** — both `BackendApplicationTests` and
  `ListingServiceFileValidationTest` were entirely commented out; `./gradlew test` ran 0 tests.
  Re-enabled, plus `BackendControllerAuthTest` (11 new tests) and `ListingServiceValidationTest`
  (15 new tests) added alongside other fixes below. 60 tests now pass. (Commits `8effe2b`,
  `a9b0990`, `206abfa`.)
- **Frontend test infrastructure stood up** — Vitest + React Testing Library, previously zero test
  setup existed. 3 smoke tests added (`StatusBadge`, `AnimatedBookmark`, `apiService`). The large
  unrefactored pages intentionally don't have tests yet — that's part of the deferred
  CreateListing/EditListings/Filters/MobileFilterSheet work above. (Commit `6a8196c`.)
- **CI gate added** — `.github/workflows/ci.yml` now runs backend tests and frontend lint/build/
  test on every PR and push to main/preprod; previously nothing validated a PR before merge beyond
  a Vercel deploy webhook ping. The AI-review workflow (`claude-code-review.yml`) is also now
  committed and active (still needs an `ANTHROPIC_API_KEY` repo secret to actually run — that's on
  the user). (Commits `2fcb6eb`, `889fab7`.)
- **Inconsistent backend auth-check idioms fixed** — `BackendController` had three different ways
  of requiring auth, two of which could 500 instead of 401 on a missing/malformed header (one via
  `MissingRequestHeaderException`, one via an NPE on `.substring(7)`). Unified into one
  `requireUser(authHeader)` helper used everywhere; every valid-auth path is unchanged. (Commit
  `a9b0990`.)
- **Numeric-primitive validation footguns fixed** — `Listing.lat`/`lon` were primitive `float`
  with zero validation (missing value silently defaulted to `0.0f`, skewing the distance-based
  trending score with no error surfaced); `ListingParking.spots`/`price` had the same
  primitive-vs-Bean-Validation-ordering issue as the known `aptnumber`/`zipcode` case. All four now
  use boxed types with explicit null/range checks, matching the existing
  `bedrooms`/`bathrooms`/`rent` pattern. No frontend change needed — `CreateListing`/`EditListings`
  already client-validate these fields. (Commit `206abfa`.)
- **`eslint .` reduced from 79 errors to 14** — all 14 remaining are confined to
  `CreateListing.jsx`, `EditListings.jsx`, `Filters.jsx`, `MobileFilterSheet.jsx`, deliberately left
  for the deferred consolidation effort. Note: the original "unused `motion` import in 6 files"
  finding turned out to be a false positive — this repo's `no-unused-vars` (no
  `eslint-plugin-react`) doesn't recognize JSX member-expression usage like `<motion.div>`, so
  `motion` is genuinely used in every flagged file. Left in place with an explained
  `eslint-disable` comment rather than removed, since removing it would have broken rendering.
  (Commit `1a2ef40`.)
- **Dead backend mapper methods removed** — `PopupMapper.findEligiblePopupForUser`,
  `ListingMapper.validateListingById`, `ListingMapper.saveListing` (duplicate of
  `createSavedListingLink`). All three confirmed zero callers before deletion. (Commit `24d7044`.)
- **Dead frontend code removed** — `components/PartnerBadge.jsx` (zero importers), and the unused
  `rc-slider`, `react-firebase-hooks`, `dotenv`, and (once its dead import was cleaned up)
  `@emailjs/browser` dependencies. (Commits `21377c6`, `c5b366d`.)
- **11 leftover debug print statements converted to SLF4J** — 5 in `AdminController`, 4 in
  `BackendController`, 1 in `EncryptionUtil`, plus `GlobalExceptionHandler`'s own non-SLF4J
  `System.err` logging (the only exception-logging path for unhandled exceptions app-wide). No
  behavior change, logging destination only. (Commits `8c21fa2`, `74be931`, `a9b0990`.)
- **`.idea/` untracked from git** and a commented-out, unused `spring-boot-starter-mail` Gradle
  dependency line removed. (Commits `9e1bfad`, `1392f2c`.)
- **Git tree backend package-directory case inconsistency fixed** — `Controller/`, `Service/`,
  `Mapper/`, `Model/`, `Config/`, `Util/`, `Exceptions/`, `Filter/` were still tracked capitalized
  in git despite disk and package declarations already being lowercase. Fixed via `git mv`, pure
  path rename, no content changes. (Commit `6fab956`.)
- `CLAUDE.md`'s stale `frontend/src/config/api.js`/`fetchWithAuth()` reference corrected to point
  at `services/apiService.js`'s `ApiService` class; stale capitalized backend directory names
  corrected; stale `MADLEASE_EMAIL`/`MADLEASE_EMAIL_PASSWORD` env vars removed in favor of the ones
  actually used (`RESEND_API_KEY`, etc.), with `SLACK_WEBHOOK_URL` added. Root `DOCUMENTATION.md`
  (6.5-months stale) retired in favor of this `docs/` folder. (Commits `36f11c4`, `9e1bfad`.)
- `frontend/README.md` (unedited Vite template boilerplate) replaced with a pointer to `docs/`.
  (Commit `36f11c4`.)
