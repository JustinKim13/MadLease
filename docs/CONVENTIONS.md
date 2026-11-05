# Conventions

The patterns to follow when writing or editing code in this repo, distilled from what the audit
found already works correctly somewhere in the codebase — so new code converges on one pattern
instead of adding a fourth version of something that already has three. When a file you're
editing uses an inconsistent pattern, prefer the canonical one below for new code rather than
copying what's nearest.

## Backend

**Numeric field validation.** Use a boxed `Integer`/`Float`/`BigDecimal` type with an explicit
service-level null/range check — the pattern already used correctly for `bedrooms`/`bathrooms`/
`squareFeet`/`rent` in `Listing.java` (checked in `ListingService.validateListingShape`). Do
**not** use a bare primitive `int`/`float` with no validation annotation — that's the bug pattern
behind `zipcode`, `aptnumber`, `lat`, `lon`, and `ListingParking.spots`/`price`: a non-numeric or
missing value either 500s on Jackson deserialization (before any `@Min`/`@NotNull` ever runs) or,
for `float`, silently defaults to `0.0f` with no error at all. See `KNOWN_ISSUES.md`.

**Logging.** Use an SLF4J `Logger` (`private static final Logger log = LoggerFactory.getLogger(...)`),
the pattern already used in `MessageService`, `BlockService`, and `CampaignService`. Never
`System.out.println`/`System.err.println`/`printStackTrace` — 11 leftover instances of this exist
today, mostly in `AdminController`/`BackendController`, and should be migrated, not added to.

**Auth-check helper.** Require one canonical "get the authenticated user or fail cleanly with
401" helper, reused everywhere, instead of the three different idioms currently coexisting in
`BackendController` (two of which can NPE into a bare 500 on a missing header instead of
returning 401). Don't inline `userService.getOrCreateUserFromToken(authHeader.substring(7))`
directly in a new endpoint — go through the helper.

**Model style.** Every model uses Lombok `@Data`. `BlockedUser` is the one exception (manual
getters/setters) — that's a flagged inconsistency to eventually fix, not a precedent to follow in
new models.

**Error responses.** Return a typed error body consistently (as most of `BackendController` does)
rather than a bare `HttpStatus` with no body — a few existing endpoints do the latter; don't add
more.

## Frontend

**API calls.** Always go through `services/apiService.js`'s `ApiService` class
(`get`/`post`/`put`/`patch`/`delete`/`postMultipart`/`putMultipart`), never a raw `fetch()` against
our own backend. The only legitimate exceptions: third-party API calls (e.g. Nominatim geocoding)
and presigned S3 PUT/GET URLs (which must *not* carry a Firebase auth header). Two existing spots
in `CreateListing.jsx`/`EditListings.jsx` violate this by hand-rolling a raw `fetch()` for the
multipart listing POST when `ApiService.postMultipart` already does the same thing — don't copy
that pattern into new code.

**State.** Server state goes through TanStack Query hooks in `services/`, keyed via the existing
`listingKeys`/`messageKeys` factories. Auth/theme state goes through `AuthContext`/`ThemeContext`
— never re-implement either with local `useState`.

**Design tokens.** Reference `index.css`'s `:root` CSS variables (`--badger-red`,
`--background-color`, `--text-color`, `--card-background`, `--border-color`, etc.) rather than
hardcoding another near-black/near-red hex literal. The codebase already has ~280 inline hex
literals and a few near-duplicate "almost the same gray" values from past drift — don't add
another one-off. If a needed token doesn't exist yet, add it to `index.css`'s `:root` (and its
`[data-theme="dark"]` override) rather than inlining it.

**Shared logic before duplication.** Before copying a large chunk of logic from one page/component
to a new one (as `CreateListing.jsx`/`EditListings.jsx` and `Filters.jsx`/`MobileFilterSheet.jsx`
already did, each ~2x the necessary code), extract a shared hook/component instead. If you're
touching one of those four files, pulling shared logic out is more valuable than adding to the
duplication.

**Breakpoints.** There's no shared `useIsMobile()`/`useViewport()` hook yet despite the pattern
being hand-rolled 29+ times (`window.innerWidth < 768` or equivalent). If you're adding a new
responsive check, consider extracting a shared hook rather than adding occurrence #30 — and
definitely don't invent a different threshold without a reason.

## General

Check `docs/KNOWN_ISSUES.md` before assuming something you've noticed is a brand-new bug — it may
already be tracked there with context on why it hasn't been fixed yet.
