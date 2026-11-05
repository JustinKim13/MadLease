# Backend Reference

Base path: `backend/src/main/java/com/badgersublease/backend/`

**Directory casing note:** package declarations and the actual on-disk directories are all
lowercase (`controller/`, `service/`, `mapper/`, `model/`, `config/`, `util/`, `filter/`,
`handler/`, `exceptions/`, `types/`). Older docs/memory may say `Controller/`, `Service/`, etc. —
that's stale. The git *tree* still records most files under the old capitalized paths (a
case-insensitive-filesystem rename artifact — only `CorsConfig.java` escaped it); see
`KNOWN_ISSUES.md`. Don't be surprised if `git log`/diffs show capitalized paths while the
filesystem and `package` lines say lowercase — they're the same files.

## Controllers (3 files, ~1116 lines)

### `AdminController` — `@RequestMapping("/admin")`
Admin-gated via a single hardcoded Firebase UID (`ADMIN_UID`), not a role table.

| Method | Path | Auth |
|---|---|---|
| GET | `/admin` (`isAdmin`) | Bearer token, UID == admin |
| GET | `/admin/listings` | admin UID |
| GET | `/admin/users` | admin UID |
| DELETE | `/admin/users` | admin UID + admin password in body |
| DELETE | `/admin/listings` | admin UID + admin password in body |
| POST | `/admin/campaigns/sublease-reminder` | admin UID + password in body |
| GET | `/admin/reports` | admin UID |
| GET | `/admin/reports/listing/{listingId}` | admin UID |

### `BackendController` — `@RequestMapping("/api")`, ~30 endpoints, the main CRUD surface

| Method | Path | Auth |
|---|---|---|
| GET | `/api/user` | required Bearer |
| PUT | `/api/user` | required Bearer (no-op ack — Firebase is the source of truth) |
| GET | `/api/user/listings` | required Bearer |
| GET | `/api/listings` | none (public filter search) |
| GET | `/api/listings/trending` | none |
| GET | `/api/listings/{listingId}` | none |
| GET | `/api/listings/{listingId}/details` | optional Bearer |
| GET | `/api/listings/{listingId}/counts` | none |
| GET | `/api/user/saved-listings` | required Bearer |
| POST | `/api/listing` (multipart) | required Bearer |
| POST | `/api/saved-listings/{listingId}` | required Bearer |
| DELETE | `/api/saved-listings/{listingId}` | required Bearer |
| DELETE | `/api/user` | required Bearer |
| DELETE | `/api/listings/{listingId}` | required Bearer + ownership check |
| PUT | `/api/listing` (multipart) | required Bearer |
| GET | `/api/user/conversations` | required Bearer |
| GET | `/api/conversations/{conversationId}/messages` | required Bearer |
| POST | `/api/listings/{listingId}/message` | required Bearer |
| POST | `/api/conversations/{conversationId}/reply` | required Bearer |
| POST | `/api/listings/{listingId}/conversation` | required Bearer |
| DELETE | `/api/conversations/{conversationId}` | required Bearer |
| POST | `/api/report` | required Bearer |
| POST | `/api/users/{userId}/report` | optional Bearer (401 if absent) |
| POST | `/api/users/{userId}/block` | optional Bearer (401 if absent) |
| DELETE | `/api/users/{userId}/block` | optional Bearer (401 if absent) |
| GET | `/api/user/blocked` | optional Bearer (401 if absent) |
| PATCH | `/api/listings/{publicId}/status` | optional Bearer + ownership check |
| POST | `/api/email` | required Bearer |
| GET | `/api/popups/feedback` | optional (anon allowed) |
| POST | `/api/popups/{popupId}/interactions` | optional (anon allowed) |
| GET | `/api/unsubscribe` | none, HMAC-token-gated |

**Auth-check idiom — currently inconsistent, see `CONVENTIONS.md` for the pattern to converge
on.** `BackendController` has three different ways of requiring auth in the same file: a
`getFirebaseUidFromToken` helper (returns `null` on a bad header), a `getUserFromAuthHeader`
helper (returns `null` on any exception → clean 401), and roughly half the endpoints calling
`userService.getOrCreateUserFromToken(authHeader.substring(7))` **directly inline** with no
helper — if `authHeader` is `null` there, `.substring(7)` NPEs into the generic catch block and
returns a bare 500 instead of a 401. `AdminController` separately defines its own
`getFirebaseUidFromToken`, subtly different again (throws `RuntimeException` on a missing header).

### `SeoController` — `@RequestMapping("/api/seo")`, no auth (intentionally public)
- `GET /api/seo/sitemap.xml` — hand-built XML via `StringBuilder`, manually escaped.
- `GET /api/seo/llms-full.txt` — builds a large synthetic markdown doc live from the DB on every
  request; no caching beyond a `Cache-Control` header.

## Services (17 files)

| Service | Lines | Responsibility |
|---|---|---|
| `ListingService` | 925 | Listing CRUD, filtering/sorting/scoring, image URL generation, saved listings, reports, status transitions, scheduled expiry job, admin owner-info enrichment |
| `MessageService` | 488 | Conversations, messages, encryption glue, block-aware silent-fail messaging, 2 scheduled email jobs |
| `UserService` | 268 | User CRUD/cascade delete, Firebase sync, bulk admin delete, user reports |
| `EmailService` | 253 | All Resend email templates + batch campaign send |
| `SlackService` | 212 | All Slack webhook notifications (11 `@Async` methods) |
| `PopupService` | 115 | Feedback popup eligibility + interaction/feedback recording |
| `BlockService` | 111 | Block/unblock users, soft-delete affected conversations |
| `S3Service` | 112 | Presigned PUT/GET URLs, CloudFront URL building, delete |
| `CampaignService` | 98 | One-off promotional campaign send (dormancy/opt-out filtering, batching, dedup lock) |
| `IndexNowService` | 83 | IndexNow search-engine ping on listing changes |
| `RateLimitService` | 80 | Bucket4j bucket management per key |
| `AuthService` | 45 | Firebase token verify/lookup/delete wrappers |
| `UnsubscribeService` | 44 | HMAC token sign/verify for unsubscribe links |

Logging is inconsistent across this layer — `MessageService`, `BlockService`, and
`CampaignService` use proper SLF4J; everything else has no logger at all (silent
`catch (Exception e) {}` or `System.out`/`System.err`). See `CONVENTIONS.md`.

## Mappers (9 files)

| Mapper | Notes |
|---|---|
| `ListingMapper` (351 lines) | Largest; 30+ SQL methods for Listings/Photos/SavedListings/Parking/Reports |
| `ListingFilterSqlProvider` (107 lines) | Dynamic WHERE builder for search filtering — see below |
| `UserMapper` | User CRUD + report insert |
| `MessageMapper` | Messages + unread-notification eligibility queries |
| `ConversationMapper` | Conversations + soft-delete |
| `BlockedUserMapper` | Block/unblock/isBlocked |
| `PopupMapper` | Popup eligibility + interaction/feedback insert |
| `CampaignSendMapper` | Campaign dedup-claim via `INSERT ... ON CONFLICT ... WHERE` |
| `EmailOptOutMapper` | Opt-out check/insert |

### `ListingFilterSqlProvider` — SQL safety
Almost every filter branch uses MyBatis `#{...}` bound parameters (safely parameterized). The one
spot that builds a raw string via concatenation is the **amenities** filter, which is guarded by a
hardcoded whitelist (`VALID_AMENITIES`) checked before concatenation — safe today, but fragile:
if a future code path calls this with an un-whitelisted value, or the whitelist check is loosened,
the injection guard breaks silently. Treat as "safe now, fragile by construction," not
"vulnerable."

## Config / Util / Filter / Exceptions / Handler / Types

- `config/CorsConfig` — see `SECURITY.md` (two redundant CORS mechanisms).
- `config/FirebaseConfig` — initializes Firebase Admin SDK from a local JSON file or base64 env var.
- `config/LocalStackInit` — `@Profile("local")` only: auto-creates the S3 bucket against LocalStack.
- `config/RateLimitConfig` / `filter/RateLimitFilter` — see `SECURITY.md`.
- `config/S3Config` — 4 beans (S3Client/S3Presigner × local/production), some duplicated
  credential-building code between the two profiles.
- `handler/StringListTypeHandler` — MyBatis type handler for Postgres `text[]` ↔ `List<String>`.
- `exceptions/BadRequestException` / `exceptions/GlobalExceptionHandler` — the one centralized
  error-response path (400 for validation/`BadRequestException`, 500 catch-all). Does **not**
  explicitly handle `MissingRequestHeaderException`/`HttpMessageNotReadableException`/
  `MethodArgumentTypeMismatchException` — those all fall into the generic 500 bucket.
- `util/EncryptionUtil` — see `SECURITY.md`.
- `types/ListingType` (`HOUSING`/`PARKING`/`BOTH`), `types/Status` (`AVAILABLE`/`PENDING`/
  `COMPLETED`/`EXPIRED`).

See `KNOWN_ISSUES.md` for the concrete bugs/dead-code/duplication findings in this layer.
