# From demo to commercial distribution platform

**What exists today is a functional demo** of the intake pipeline: artist form → API → stored submission → admin review → Excel export. It is *not* a distributor: nothing is delivered to any streaming service, no money moves, and there are no user accounts. The phases below are what a real product requires, in a sensible build order.

| # | Phase | Scope | Builds on (in this repo) |
|---|---|---|---|
| 1 | **Artist accounts + authentication** | Sign-up/login (email + OAuth), email verification, MFA option, sessions, password reset, artist↔release ownership, team/label sub-accounts. Replace the open `/admin` with real admin auth. | Add `userId` to `ReleaseRecord`; guard `routes/admin.ts` |
| 2 | **Production database + cloud file storage** | PostgreSQL (or Supabase/Firestore) with migrations, indexes, backups; S3/GCS for audio and artwork with signed URLs, multipart/resumable upload, virus scanning, lifecycle rules, CDN. | Implement `ReleaseRepository` and `FileStorage` interfaces |
| 3 | **Payments / subscriptions** | Stripe (or similar): per-release or annual plans, invoices, taxes (VAT/GST), refunds, dunning, coupons. | New billing module |
| 4 | **Music metadata validation** | DSP-spec checks: audio quality (sample rate, bit depth, clipping, silence), loudness, artwork ≥ 3000 px, banned words/logos, title formatting, explicit-flag consistency, language/script checks, duplicate-content detection. | Extend `shared/schema.ts` + upload pipeline |
| 5 | **ISRC / UPC integration** | Become (or partner with) an ISRC/UPC registrant; allocate and store codes; validate user-supplied ones; collision detection. | `isrc` / `upc` fields already captured |
| 6 | **DSP integrations** | Deliver metadata + assets to Spotify, Apple, Amazon, etc. via DDEX ERN feeds or aggregator APIs; takedowns, redeliveries, per-store status and error handling, pre-save links. | `stores` selection already captured |
| 7 | **Royalty accounting** | Ingest DSP sales/streaming reports, normalise, split by collaborator, ledger, balances, payout (PayPal/bank), tax forms, audit trail. | New ledger service |
| 8 | **Analytics** | Streams, listeners, geography, playlist adds, trend dashboards fed by DSP reports and platform APIs. | New data pipeline |
| 9 | **Artist dashboard** | Artists see their releases, statuses, edit metadata, upload revisions, view earnings/analytics, manage profile and payouts. | `/distribute` flow becomes one part of this |
| 10 | **Admin operations** | Review queues with assignment, checklists and rejection reasons, templated emails, bulk actions, audit logs, role-based access (support/ops/finance), fraud/abuse tooling, saved exports. | Evolve current `/admin` |
| 11 | **Rights management** | Content ID / fingerprinting, ownership disputes, split sheets and contracts, e-signatures, publishing/PRO linkage, DMCA workflow. | Declarations are placeholder text today |
| 12 | **Security & compliance** | Pen-testing, secrets management, rate limiting, CSRF/WAF, encryption at rest, GDPR/CCPA (consent, export, deletion), KYC/AML for payouts, SOC 2 readiness, observability/alerting, DR plan, legal terms and DSP agreements. | Demo validation/sanitisation is a starting point only |

## Demo shortcuts to remove first

1. Unauthenticated admin + admin file endpoints.
2. JSON-file persistence and local-disk uploads (single process, no backups, no concurrency across instances).
3. In-memory multipart buffering (`multer.memoryStorage`) — use streaming/direct-to-bucket uploads.
4. No rate limiting, bot protection, or email verification on submissions.
5. Duplicate detection is a simple email + title + type check.
6. Declarations are checkboxes only; no legal text, versioning, or consent record.
