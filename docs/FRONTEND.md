# Frontend Reference

Base path: `frontend/src/`. ~24,600 lines across 50 source files.

**Correction to older docs/memory:** there is no `frontend/src/config/api.js` and no function
named `fetchWithAuth()`. The real pattern is `frontend/src/services/apiService.js`, which exports
`API_BASE_URL` and a singleton `ApiService` class (`get`, `post`, `put`, `patch`, `delete`,
`postMultipart`, `putMultipart`) that attaches a fresh Firebase ID token per call. `config/` only
contains `firebase.js` (Firebase app/auth/storage/Google-provider init).

## Pages (`pages/`, 13 files)

| File | Route | Lines | What it does |
|---|---|---|---|
| `Home.jsx` | `/` | 1430 | Landing page: hero, latest/trending grids, "How it works", FAQ, listing-type-chooser modal |
| `Listings.jsx` | `/listings` | 1050 | Browse page — virtualized list (`react-window`) + map toggle, wraps `Filters`/`MobileFilterSheet` |
| `ListingDetails.jsx` | `/listings/:id` | 1313 | Single listing — gallery, amenities/parking/map, save/share/report, contact-the-lister flow |
| `CreateListing.jsx` | `/listings/new` (protected) | 1983 | Multi-step listing creation form, image upload w/ resize+HEIC, geocoding, profanity filter, preview |
| `EditListings.jsx` | `/listings/:id/edit` (protected) | 1948 | Same as `CreateListing` but for editing — **near-duplicate, see `KNOWN_ISSUES.md`** |
| `Profile.jsx` | `/profile` | 2730 | User hub: identity/avatar, saved listings, "my listings" management, embedded messages tab, blocked-users link — **largest file in the repo** |
| `BlockedUsers.jsx` | `/profile/blocked` (protected) | 54 | Thin wrapper rendering `BlockedUsersPanel` (exported from `ConversationList.jsx`) |
| `Contact.jsx` | `/contact` | 285 | Contact form — submits via `ApiService`, not the `@emailjs/browser` it imports (dead import) |
| `About.jsx` | `/about` | 170 | Static marketing page |
| `LegalPrivacy.jsx` | `/privacy` | 131 | Static privacy policy |
| `LegalTerms.jsx` | `/terms` | 149 | Static terms of service |
| `NotFound.jsx` | `*` | 38 | 404 fallback |

`ConversationList`/`ConversationView` live in `components/` but are routed as page-level views
(`/messages`, `/messages/:conversationId`).

## Components (`components/`, 24 files)

| File | Lines | What it does |
|---|---|---|
| `Navbar.jsx` | 1206 | Top nav — desktop + mobile menus, account menu, theme toggle, safe-area handling |
| `ConversationList.jsx` | 1259 | Messages inbox list; **also exports the unrelated `BlockedUsersPanel` from the same file** |
| `ConversationView.jsx` | 1231 | Single conversation thread — message list, composer, block/report/delete modals |
| `SuccessModal.jsx` | 1265 | Post-create confirmation **plus** a full animated product-tour walkthrough — two concerns, one file |
| `Map.jsx` | 1066 | Leaflet wrapper — clustering, markers, preview cards, embeds `AuthModal` |
| `Filters.jsx` | 941 | Desktop filter panel — fully custom slider/calendar, despite `rc-slider` being a dependency |
| `MobileFilterSheet.jsx` | 964 | Mobile filter bottom sheet — **independent reimplementation** of `Filters.jsx`'s domain, own color-token system |
| `FeedbackPopup.jsx` | 484 | Floating feedback widget, calls the API directly |
| `AuthModal.jsx` | 793 | Login/signup/forgot-password/verification modal, all Firebase auth flows |
| `EditProfileModal.jsx` | 469 | Edit name/email/avatar modal |
| `ListingCard.jsx` | 274 | Listing preview card (image carousel, price, bookmark) |
| `Footer.jsx` | 276 | Site footer + mobile bottom sheet for extra links |
| `ReportModal.jsx` | 267 | Report user/listing modal |
| `ShareModal.jsx` | 243 | Share-listing modal |
| `SortableImageGrid.jsx` | 188 | Drag-and-drop reorderable image grid (`@dnd-kit`) |
| `AmenitiesSelector.jsx` | 133 | Multi-select amenity chips |
| `StatusDropdown.jsx` | 112 | Listing status change dropdown |
| `AnimatedBookmark.jsx` | 94 | Animated bookmark icon |
| `StatusBadge.jsx` | 81 | Small colored status badge |
| `ThemeToggle.jsx` | 72 | Light/dark toggle UI |
| `ErrorBoundary.jsx` | 57 | Top-level class error boundary |
| `AmbientBlobs.jsx` | 47 | Decorative animated background (reused on Home/Listings/Profile/ListingDetails) |
| `Seo.jsx` | 48 | `react-helmet-async` wrapper for per-route meta/OG/JSON-LD |
| `ProtectedRoute.jsx` | 26 | Route guard, redirects to `/?showAuth=true` |
| `PartnerBadge.jsx` | 34 | **Dead — defined but never imported anywhere** |

See `KNOWN_ISSUES.md` for the full duplication/dead-code list (`Filters`/`MobileFilterSheet`,
`CreateListing`/`EditListings`, etc.).

## Services (`services/`)

- **`apiService.js`** (206 lines) — the `ApiService` singleton described above. This is the only
  sanctioned way to call the backend.
- **`listingQueries.js`** (373 lines) — TanStack Query hooks: `listingKeys` factory,
  `useTrendingListingsQuery`, `useListingsQuery`, `useListingDetailsQuery`, `useSavedListingsQuery`,
  `useSaveListingMutations`, `useUserListingsQuery`, `useListingCountsQuery`,
  `useDeleteListingMutation`, `useUpdateListingStatusMutation`, plus `fetchListings`/`formatDate`
  helpers.
- **`messageQueries.js`** (227 lines) — `messageKeys` factory, `useCurrentUserQuery`,
  `useConversationsQuery` (30s poll), `useMessagesQuery` (10s poll), `useSendMessageMutation`,
  `useReplyMutation`, `useFindOrCreateConversationMutation`, `useDeleteConversationMutation`,
  `useBlockedUsersQuery`, `useBlockUserMutation`, `useReportUserMutation`,
  `useUnblockUserMutation`.
- **`geocoding.js`** — the one legitimate place raw `fetch()` is used, against the third-party
  Nominatim API, not our backend.

**Raw `fetch()` against our own backend, bypassing `ApiService` — a real inconsistency**:
`CreateListing.jsx`/`EditListings.jsx` hand-roll a raw `fetch()` for the multipart listing
create/update POST instead of using `ApiService.postMultipart`/`putMultipart`, which already do
the same thing. (Raw `fetch()` against presigned S3 PUT URLs in those same files is correct and
expected — no Firebase auth header should go to S3.)

## Context (`context/`)

- **`AuthContext.jsx`** (283 lines) — `currentUser`, `loading`; `signup`, `login`,
  `loginWithGoogle`, `logout`, `resetPassword`, `updateUserProfile`, email-verification helpers.
  Wires Firebase's `onAuthStateChanged`, clears the TanStack Query cache on logout/user-switch,
  and does targeted cache surgery after a profile update.
- **`ThemeContext.jsx`** (49 lines) — `darkMode` (persisted to `localStorage`, defaults dark),
  `toggleDarkMode`. Sets `document.documentElement[data-theme]` and the `<meta name="theme-color">`
  tag — the one place `#0f0e0e`/`#ffffff` are set "centrally," but as hardcoded literals in a
  `useEffect`, not shared constants (must stay manually in sync with `Navbar.jsx`'s own copies per
  that file's own comment).

No component re-implements auth/theme state locally — every consumer correctly uses
`useAuth()`/`useContext(ThemeContext)`.

## Design system, as it actually exists

`index.css` defines a small `:root` token set (`--badger-red: #c5050c`, `--badger-red-light`,
`--badger-gray`, `--background-color`, `--text-color`, `--card-background`, `--border-color`)
plus a `[data-theme="dark"]` override block. **This is the intended mechanism, but most inline
styles bypass it.** There are ~280 distinct hex literals used inline across the codebase.

The de-facto dark palette mentioned in earlier notes (`#0f0e0e` bg, `#1a1918` card, `#2a2826`
border, `#f0ebe5` text, `#8a8280` muted) does recur heavily — but entirely as repeated literals,
concentrated almost entirely in `Profile.jsx`, not as defined constants anywhere. It sits
alongside a cloud of near-but-not-quite matching near-blacks (`#1a1a1a`, `#171514`, `#211f1e`,
`#1c1a19`, `#161514`, `#0f0e0d`, etc.) that look like drift from the same intended palette rather
than deliberate distinct tones.

`MobileFilterSheet.jsx` defines a **third, fully separate** color-token system (`RED #ff2d3a`,
`RED_DEEP #c81824`, `getTokens(darkMode)`) that references neither `index.css`'s variables nor the
`#0f0e0e`-family palette.

New UI should reference `index.css`'s CSS variables rather than adding another one-off literal —
see `CONVENTIONS.md`.

**Breakpoints:** no shared hook/constant — `window.innerWidth < 768` (or an equivalent
`matchMedia`) is hand-rolled 29+ times across 16 files. A shared `useIsMobile()`/`useViewport()`
hook would remove most of this.

## Testing

There is no test setup at all: no Vitest/Jest/RTL/Playwright/Cypress, no `*.test.*`/`*.spec.*`
files, no `test` script in `package.json`. `npm run lint`/`npm run build` exist but nothing in CI
calls them.
