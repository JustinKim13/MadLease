# BadgerSublease Docs

Reference documentation for the BadgerSublease codebase, written from a full audit (Oct 2026).
Read the relevant file before touching that area of the app instead of re-deriving it from
scratch — see `CLAUDE.md`'s "Before Making Changes" section.

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — system map, request flows, why things are built the way they are.
- [`BACKEND.md`](BACKEND.md) — every controller/endpoint, service, and mapper, with auth requirements.
- [`FRONTEND.md`](FRONTEND.md) — every page/component, the API/query-hook layer, the design system as it actually exists.
- [`CONVENTIONS.md`](CONVENTIONS.md) — the patterns to follow when writing new code here, so it converges instead of adding a fourth version of something that already has three.
- [`SECURITY.md`](SECURITY.md) — auth, encryption, rate limiting, CORS, and known gaps.
- [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) — tracked bugs/bloat/tech-debt findings, by severity, with file:line.

`DOCUMENTATION.md` at the repo root is retired — its still-accurate content was folded into the
files above; it now just points here.
