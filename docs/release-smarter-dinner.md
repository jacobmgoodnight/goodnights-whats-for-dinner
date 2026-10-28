# Smarter Dinner — review and production approval plan

**Status: implemented and tested locally; not approved for production migration, merge or deployment.** This release depends on [foundation PR #20](https://github.com/jacobmgoodnight/goodnights-whats-for-dinner/pull/20), whose Node and hosted Chromium checks passed. Keep this release a draft until the backend approval and verification below are complete. Do not enable auto-merge.

## Behavior and scope

Home offers **Pick dinner for us** alongside the existing family-vote action. Quick Pick immediately suggests one saved place, uses a cuisine filter and an optional fixed two-week recency exclusion, and can offer three alternatives. Unrecorded places rank first, then oldest confirmed dates; equal candidates use a deterministic daily hash of date/restaurant ID. A round excludes already shown IDs and offers an explicit restart at exhaustion. It never silently relaxes a chosen filter. If meal history cannot load, suggestions still work from the saved library and disclose that history is unavailable. No poll is created. There are no claims about current opening hours, price, dietary suitability or driving distance.

Quick Pick uses a focused screen with Home return and collapsed, clearly summarized filters, retaining native cuisine controls in place. It does not add a sixth tab. Existing organizer/member navigation remains familiar. On the welcome screen, connecting an invitation precedes new-household setup.

The organizer can choose **We ate here** from a result, a suggestion, Home or the restaurant library, then confirm the saved location and local calendar date. Recording requires explicit confirmation even for a winner. Recent meals allow correction and confirmed deletion; one place/date represents one visit. No notes, nutrition, diners or preference profiles are stored. Restaurant IDs remain the identity, archived places remain in meals, and deleting a source poll only nulls the optional association. Poll outcomes, ballots and saved ties never change.

Active personal members can read household meal history but cannot change it. Group/public links cannot read it. No meal fields are added to existing public poll responses. Favorites/dislikes, budget/distance/dine-in filters and richer menu/site metadata remain separate proposals because reliable metadata/private preference access do not yet exist.

## Exact database artifact

- [20261028112638_confirmed_meals.sql](../supabase/migrations/20261028112638_confirmed_meals.sql), generated with Supabase CLI 2.122.0 `migration new`.
- SHA-256: `f2451956ae3ddf39f2ebc777e0d900bf4de89527a04f5e9d1353adc73259913c` (LF file content; use the reviewed repository blob).
- One new RLS table `gw_meals`: id, family_id, restaurant_id, eaten_on DATE, optional poll_id, created_at. Five indexes including the primary key and uniqueness constraint support bounded recent/history queries and references. No backfill or existing table/function/permission rewrites.
- Three new explicitly granted token-guarded RPCs: `gw_meal_history(text,text)`, `gw_save_meal(text,uuid,uuid,date,uuid)`, `gw_delete_meal(text,uuid)`. Direct table grants are revoked. Writes require an organizer; reads require an organizer or active same-family personal member. The client-generated meal UUID survives failures/retries, and same-place/date uniqueness catches double entries. Family-row locking serializes capacity/dedup checks.
- Dates travel as `YYYY-MM-DD`, never timestamps at midnight. The browser defaults/maxes to local today; PostgreSQL permits through UTC's next day to accommodate all civil time zones. Relative labels compare calendar days across DST and display a later-zone date explicitly. The only timestamp is creation metadata.

## Before approval / read-only production preflight

1. Review this PR and the exact LF migration hash. Confirm #20 is reviewed and merged first, or retain this PR's dependency while reviewing. Re-read deployed catalog and migration history because production may have changed since the October 28 inspection. This inspection found the new meal table/RPC absent, all 13 public tables denied to anon/authenticated, and schema CREATE denied to both roles.
2. Use [security-audit.sql](../sql/security-audit.sql) and [meal-preflight.sql](../sql/meal-preflight.sql). Confirm the existing family/member/restaurant/poll IDs are UUID, tokens text, member active boolean, required restaurant presentation fields exist, and all three new RPC signatures/table name are unused. No extension activation or worker change is required. Do not replay historical source filenames; several differ from production's recorded application timestamps.
3. Rehearse `node tests/sql/confirmed-meals.cjs` in isolated PostgreSQL. It accepts no database URL. Rehearse against a freshly reconciled **catalog-only** production snapshot if definitions change materially. Recheck advisors and inspect newly changed findings; the three intentional public definer endpoints and one RLS/no-policy table are expected additions, not permission bugs to fix blindly.
4. After approval to proceed, take a fresh private encrypted schema/data backup of all current app tables, grants, triggers, functions and migration records; keep its recovery key separately. Verify decryption/checksum and an isolated restore. Capture private before/after row projections/fingerprints of existing tables and definitions without publishing records or bearer tokens. Historical release backups are not a substitute for this step.

## Approved application sequence (do not execute without approval)

1. Apply **only the exact reviewed migration above**, once, transactionally. It has a five-second lock timeout, validates prerequisites/unused meal objects, creates only additive objects, and reloads the PostgREST schema cache. No `db push`, baseline replay, worker deploy, credential rotation, or data cleanup. Record the actual assigned Supabase migration timestamp and source hash in this release note.
2. Verify the new table is empty; RLS is enabled; anon/authenticated table access is denied; new RPCs are callable but reject invalid credentials; old `gw_vote` and private helpers remain denied. Compare all original table row projections/counts/IDs and old function definitions/grants with the private preflight. No existing field should change. Inspect advisors for unexpected findings.
3. Verify PostgREST resolves the three signatures using deliberately invalid credentials only. Run success/failure/permission acceptance in **synthetic staging**, never disposable production family records. Verify public/group responses contain no meals. Do not log request payloads containing tokens. Production happy-path confirmation waits for the organizer's actual meal.
4. Only after backend checks pass, approve the frontend PR, require Node/browser CI, merge through normal review and verify Pages assets. Verify old personal links and organizer access on actual phones without creating fake production votes/meals. No runtime package/build changes or paid services are introduced.

## Rollback and failure handling

If migration application fails, its transaction rolls back; investigate locks/prerequisites before retrying. If verification fails before frontend merge, leave the current frontend deployed and retain additive objects for investigation. For a frontend regression, revert this release's frontend commit through review and retain meal data/functions/table. Existing readers ignore the new objects. Do not drop meals, restore a dump over production, overwrite outcomes, revoke old grants or rotate tokens as routine rollback. Any destructive cleanup or permission change requires a new explicit approval.

## Validation and remaining checks

- Node suite: **140/140**, including all prior tests and pure decision/date tests for deterministic order, reversed library ordering, recency, exhausted rounds, invalid dates, opposing local time zones, DST and date labels.
- Isolated PostgreSQL 17: fresh core + additive meal migration; original row preservation; no inferred meals from completed votes; retry and two-connection idempotency; same-place/date duplicates; correction/deletion; archived places; deleting a poll preserves its meal; bounded last-50 list plus full last-date index; owner/member/group/cross-family/revoked-member guards and denied direct reads. Embedded distribution uses numeric timezone offsets; named-zone/DST checks run in Node/browser.
- Synthetic Edge 320/390px: Home to immediate no-poll decision, cuisine native node retained, alternatives, explicit meal from a suggestion and a finished result, date input/default/max, failed save preserves values and retry ID, correction/deletion, last-eaten library labels, history failure with truthful fallback/retry and no poll writes. Visually inspected the 320px Quick Pick render.
- Existing organizer/repeat/location browser regressions pass; full ballot browser suite remains in CI. New hosted release CI must pass before approval. Actual iPhone Safari/installed mode, Android, OS keyboard/VoiceOver/TalkBack, real multi-phone date behavior and hosted staging acceptance remain [manual checks](qa/mobile-checklist.md).

No production migration, permission/key/worker change, merge or deployment has been performed for this release.
