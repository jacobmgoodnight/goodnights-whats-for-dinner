# Organizer planning release — October 21, 2026

Approved scope: organizer Tonight with the original no-active-vote Home fallback, compact Review, opt-in automatic positive-tie resolution, named presets, moderated member nominations, custom public titles, optional image captions, and explicit organizer alerts. Original colors, native names-only ranked menus, IDs, links, ballots and saved draws remain intact. H5 meal recording/rotation and automatic texting remain excluded.

Frontend release: [PR #18](https://github.com/jacobmgoodnight/goodnights-whats-for-dinner/pull/18), through the existing main/GitHub Pages workflow after backend verification. [Workflow status](https://github.com/jacobmgoodnight/goodnights-whats-for-dinner/actions). The release receipt records the final merge/deployment and non-destructive asset comparison privately.

## Backend applied before frontend

| Source migration | Production version | Outcome |
| --- | --- | --- |
| 20261021115729_organizer_planning.sql | 20261021172847 | Applied; original rows/links/ballots preserved |
| 20261021115730_organizer_alert_delivery.sql | 20261021172857 | Applied; no subscription or event backfill |
| 20261021121321_organizer_alert_scheduler.sql | 20261021173012 | Applied; named once/minute cron job |
| 20261021173122_organizer_alert_queue_privacy.sql | 20261021173431 | Applied; direct cron HTTP, no private headers queued |

Do not blindly db push these timestamps or rerun database.sql: production migration versions differ from the checked-in preparation timestamps. No original table data is rewritten, merged or removed.

The private `goodnights-organizer-alerts` Edge Function is active, version 1, with its own scheduler-key authentication and server-only service-role RPC calls. Private VAPID/scheduler keys are in Vault and privately backed up under Windows protection. No keys, contacts, real invitations or data dumps are in Git. The worker accepts a valid empty-queue request with HTTP 200 and zero claimed/sent notifications; anonymous requests reject with HTTP 401.

Installed extensions: Vault 0.3.1, pgcrypto 1.3, pg_cron 1.6.4, pg_net 0.20.4 and http 1.6. The active cron job runs `select public.gw_dispatch_organizer_push();` once/minute as postgres. Recent job runs succeed. No unrelated job was replaced.

## Hosted queue privacy fix

A live privilege check found platform-owned pg_net tables grant PUBLIC access. Supabase does not allow postgres to revoke those grants. Browser keys cannot query the unexposed net schema through PostgREST, but direct database roles can read queued headers; [Supabase documents the limitation](https://supabase.com/docs/guides/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357).

Before enabling delivery or submitting any private worker request, the follow-up migration replaced pg_net dispatch with bounded direct HTTP from cron. No worker bearer key was placed in that queue. The worker still performs durable leasing/retries and encryption. A trigger-depth guard makes ballot-trigger dispatch return immediately, so saving a vote never waits for HTTP. Notifications can take up to a minute to begin delivery. The pg_net extension remains installed, with no private request queued; its platform grants were not changed or claimed to be private.

## Preservation and verification

- A fresh private OpenPGP-encrypted backup contains the seven original tables and schema. Its encrypted private key has a Windows-protected passphrase. Local in-memory decryption verifies checksum, byte length, complete table arrays/counts and family/member/poll/restaurant references. No real rows were printed, restored into disposable fixtures or used for synthetic tests.
- Immediately before release, data and schema still matched that backup. After all four migrations, hashes/counts of every original field in all seven tables still match exactly. New poll defaults are blank title and automatic tie off. Organizer/member/public readers work; no historical alert/subscription backfill exists.
- New tables have RLS and deny direct anon/authenticated access. Worker/helper RPCs deny browser execution. Live invalid-credential checks reject before any write. Security advisor findings match the intended RPC-only model: 14 RLS/no-policy tables (including private settings) and 38 token-guarded/public reader SECURITY DEFINER RPCs per browser role; no additional category was introduced. See [RLS/no-policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [RPC execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
- 127 Node tests pass. Isolated PostgreSQL fixtures cover old data/draws, all vote modes, all-no/empty/off guards, concurrent final voters, current choices/membership, preset/nomination permissions, queue dedup/leases/retries/expiry/disable and cron-only HTTP/failure isolation. Hosted extension APIs use explicit local stand-ins; actual hosted HTTP and empty-queue worker execution also pass.
- Synthetic Edge QA covers all voting methods at 320/375/390/430px, keyboard/native select retention, scroll/swipe/cancel, backtracking, failed saves, reduced motion and 200% text. New organizer flows pass at 320/390px, including long titles, editable presets, H4 review and caption images. Real pinned Web Push encryption/VAPID signing and Deno 2.1 frozen-lock checks pass with synthetic keys and no device sends.

Physical iPhone/Android, Safari/VoiceOver/native ranking sheets, real software keyboard/OS text sizing/safe areas, real multi-phone voting and actual push permission/receipt remain unverified. On iPhone, open the installed Home Screen app and explicitly enable organizer alerts. Installation alone never subscribes. Real devices have not received disposable test notifications.

Rollback: disable private push settings for delivery problems; retain durable storage for inspection. Revert frontend if needed. Never drop original data, rotate family links, restore a dump over live records, reroll saved draws or remove H1's zero-support guard as a routine rollback. See [implementation/release order](organizer-planning.md).
