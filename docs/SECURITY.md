# Security Posture

## Auth
Firebase JWT, verified via the Firebase Admin SDK (`AuthService`). No server-side sessions — a
fresh token is fetched per request on the frontend. Admin access is a single hardcoded Firebase
UID compared against `ADMIN_UID`, plus an `ADMIN_PASSWORD` string check for destructive actions
(delete users/listings, trigger campaigns) — there is no role table, so "admin" is exactly one
account, not a permission tier.

## Encryption
Message content: AES-256-GCM (`util/EncryptionUtil`), confirmed correct — `AES/GCM/NoPadding`,
256-bit key from `MESSAGE_ENCRYPTION_KEY` (base64, 32 bytes), random 12-byte IV per message,
128-bit GCM tag, output format `"v1:" + base64(iv || ciphertext)`. The `v1:` prefix is a real
rotation mechanism — a future `v2:` could be introduced with a new key while old messages stay
decryptable under the old scheme.

## Rate limiting
Single global tier: Bucket4j token bucket, capacity 50, refills 30 tokens/minute, keyed by the
Firebase JWT's unverified `sub`/`user_id` claim (deliberately not full-signature-verified here,
for latency — worst case is a spoofed bucket identity, not an auth bypass), falling back to
`X-Forwarded-For`/remote IP. `RateLimitFilter` has no explicit URL-pattern registration, so Spring
Boot applies it to every path uniformly — **login, listing creation, messaging, and admin routes
all share one identical bucket.** There is no stricter limit on sensitive actions (account
creation, report submission, admin endpoints). Known gap, not yet addressed.

## CORS
`config/CorsConfig` defines **two separate, redundant mechanisms**: a `WebMvcConfigurer.
addCorsMappings` override (covers `/api/**` and `/admin/**`) and an independent
`CorsConfigurationSource` bean (covers `/api/**` only). Both parse `CORS_ALLOWED_ORIGINS`
independently. Not currently permissive — origins are scoped, defaulting to
`https://badgersublease.com,https://www.badgersublease.com` in production — but having two
configs makes it harder to reason about what actually applies, and the `/admin/**` whitelist only
exists in one of the two. Worth consolidating into one mechanism.

## Secrets

- `.gitignore` correctly covers `.env*` files and `application-local.properties` ("never commit
  real credentials" per its own comment); confirmed no real secrets file is tracked.
- **Known gap, high severity**: `application-production.properties` (tracked in git) hardcodes the
  real Slack webhook URL directly, instead of sourcing it from an env var like every other secret
  in that same file. Should be rotated and moved to `${SLACK_WEBHOOK_URL}`. See
  `KNOWN_ISSUES.md` — this doc intentionally doesn't reproduce the actual value; check the file
  directly.
- Lower-severity: `IndexNowService` has a hardcoded default IndexNow verification key baked into
  source as a `@Value` default. IndexNow keys are meant to be served publicly at a well-known URL
  anyway, so this is lower risk than the Slack webhook, but should still move to config.
- A Firebase service-account JSON was committed in an old commit (`8a7ad41`) then deleted
  (`4910329`). It's gitignored now and not in the current tree, but is still recoverable from git
  history. Worth verifying whether it was ever a real (non-placeholder) key and rotating it in
  Firebase if so.
- `functions/index.js` (Firebase Cloud Functions) pulls its own, independent Slack webhook via
  `functions.config().slack.webhook` — a second secret surface, parallel to `SlackService`, by
  design (see `ARCHITECTURE.md`).

## Input validation
Jakarta Validation annotations on most request models, enforced centrally via
`exceptions/GlobalExceptionHandler` (`MethodArgumentNotValidException` → 400 with a field-error
map). Gaps: `Report.java`'s free-text `reason`/`reportMessage` fields have no `@Size`/validation
at all, inconsistent with `Message.content`'s `@Size(max=5000)`. Several primitive numeric fields
bypass validation entirely by 500ing before Bean Validation ever runs — see `CONVENTIONS.md`'s
numeric-field-validation rule and `KNOWN_ISSUES.md`.

## SQL injection
MyBatis parameterized queries (`#{...}`) throughout. The one hand-built string-concatenation spot
(`ListingFilterSqlProvider`'s amenities filter) is guarded by a hardcoded whitelist checked before
concatenation — safe today, fragile by construction if that guard is ever loosened. See
`BACKEND.md`.

## XSS
React's default escaping, plus manual escaping in `SeoController`'s hand-built sitemap XML
(`xmlEscape`/`safe` helpers) — fragile since it's manual, but every dynamic value currently does
go through it.
