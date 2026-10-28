# One-time travel polls — proposed release

Status: **draft; production migration NOT applied**. Foundation #20 and onboarding-only #21 are merged and deployed. Quick Pick and confirmed meal history remain held on `codex/smarter-dinner-proposal-held-20261028`. This release implements the separately requested name-only poll and temporary guest flow; see [the family guide](one-time-votes.md).

## Scope and compatibility

- Organizer Home adds one secondary action. One compact page asks for names and voter count; less frequent controls are collapsed. Existing saved-library voting stays intact.
- `one-time.js` contains small form/validation helpers. `app.js` dispatches the new poll type through dedicated RPCs, preserves per-poll guest identity, and reuses the existing ballots, results, reminders-free waiting status and sharing controls. `family.js`, `styles.css` and cache versions in `index.html` support this flow. No runtime package or build step.
- Existing personal/organizer links, regular group invitations, member IDs and voting algorithms are unchanged. Guest identities never update the browser's remembered permanent family person. Organizer credentials saved on that browser are preserved when opening a guest invitation.
- Creation retries reuse a per-draft UUID. Joins recover an unsubmitted matching normalized name; pre-vote corrections keep the same guest slot. Identical ballot retries are acknowledged but different ballots cannot replace a submitted guest vote.

## Exact database change and dependencies

Apply only [`supabase/migrations/20261028162644_one_time_travel_polls.sql`](../supabase/migrations/20261028162644_one_time_travel_polls.sql), individually, **after explicit production approval**. Do not run `database.sql`, the empty installer, or blanket `supabase db push` on the existing project. Repository historical filenames differ from deployed migration history.

The migration is one transaction with a five-second lock timeout. It adds `gw_polls.one_time default false`, one RLS-enabled `gw_poll_guests` table (UUID, poll ID, normalized name, display name, timestamp), and two narrowly granted token-checked functions. The unique `(poll_id,name_key)` index also covers the poll foreign key. No direct browser table grants or policies are added. New functions use an empty search path and qualified relations. Existing grants are preserved; private `gw_vote` remains inaccessible to browser roles.

The public `gw_get_poll(uuid)` retains its explicit privacy whitelist and adds only `one_time`. The migration refuses a public-reader definition that differs from the reviewed deployed source (whitespace ignored). It also checks the existing ballot writer, poll settings and dinner-processing dependencies. It relies on the already applied roster/settings, title/planning, private ballot validation and trigger behavior. The read-only production catalog was inspected October 28, 2026, including actual function bodies and poll/restaurant columns. No private records were used. Current Supabase [function security guidance](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker) informed the grants and search-path checks. Existing advisor findings about intentionally guarded RPCs and no-policy RLS tables are not blanket vulnerabilities; this change does not revoke existing privileges or weaken RLS.

Name-only options are **new inactive** restaurant rows, each attached to its poll through existing options. Existing rows are never rewritten. There are no automatic meals, family members, paid APIs, contact storage or external image requests for these choices. The existing single-family constraint stays intact.

## Approval, application and verification order

1. Review this PR, the exact migration, CI results and the rollback choices below. Confirm project `rwqclcpmtuebxndadkxv` and a recoverable encrypted backup in the private owner workflow. Do not paste backup contents, tokens or private rows into this public repository.
2. Immediately before application, re-read `pg_get_functiondef('public.gw_get_poll(uuid)'::regprocedure)`, `gw_vote`, `gw_poll_settings` and the existing poll/restaurant columns, constraints and triggers. Compare with the reviewed migration and fresh-core fixture. Stop on drift; never edit away a failed preflight just to proceed.
3. With explicit approval, apply **only** the named migration in full through a reviewed production migration operation. Record its actual applied version; do not rename/replay historical files. A failed transaction leaves existing objects unchanged.
4. Verify schema only: `one_time` is non-null/default false; `gw_poll_guests` has RLS and zero direct grants to `anon`/`authenticated`; both new functions have `prosecdef=true`, `search_path=""`, and no PUBLIC execute; `gw_vote` still denies browser execution. Recheck public-reader definition and hosted advisors. Do not log poll or invitation values.
5. Only after database success, merge/deploy the frontend PR. Run synthetic acceptance in an isolated instance. A voluntary real family poll may be used normally after deployment; automated fixtures never point at production. Verify regular invitations still load. Report the deployment commit and checks.

Useful read-only verification (no family data):

```sql
select column_default,is_nullable from information_schema.columns
where table_schema='public' and table_name='gw_polls' and column_name='one_time';
select relrowsecurity from pg_class where oid='public.gw_poll_guests'::regclass;
select grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name='gw_poll_guests';
select proname,prosecdef,proconfig,proacl from pg_proc
where pronamespace='public'::regnamespace
and proname in ('gw_create_one_time_poll','gw_one_time_access','gw_vote');
select has_function_privilege('anon','public.gw_vote(uuid,text,jsonb)','execute');
```

## Data-preserving rollback

Before anyone creates a one-time poll, the previous frontend can be restored to the merged onboarding release. Leave the additive database objects in place; old readers ignore the new default column. Dropping columns/tables or deleting historical options is unnecessary.

After use begins, **keep this frontend's guest handling and the new reader/RPCs** so existing invitations and history keep working. To pause new creation, deploy the same frontend with optional `oneTimePolls: false` in the existing public `GW_CONFIG` object. This hides the Home entry and guards the creation action; existing guest invitations continue to work. It is an operational switch, not an authorization boundary. No database permissions, credentials or records change. Remove/set true to resume. This is the preferred rollback; diagnose using synthetic fixtures before proposing further SQL.

Any later removal or security-grant change needs separate explicit approval and an audited plan for existing one-time polls. Never roll back by resetting family tables or reverting to an unguarded name-voting RPC. The isolated SQL suite also verifies that restoring the prior reader leaves ballots intact, but that is **not** the recommended post-use production rollback.

## Validation and remaining sign-off

- Node: 136 tests, including all existing voting/branding/identity behavior and new draft/escaping/invitation tests.
- `tests/sql/one-time-polls.cjs`: isolated fresh PostgreSQL; additive data/ACL preservation; organizer, browser-role and cross-poll boundaries; all methods; public results privacy; normalized names and corrections; join/creation/vote retries; capacity and voting races; immutable positive tie draw; all-no rejection; invitation revocation/rotation; unchanged active library/members. Its harness also checks the original core install and permanent personal vote edits.
- `tests/browser/one-time.cjs`: intercepted synthetic service, 320/390px; all methods, creation, guest naming/correction, same-phone return, shared phone, network retry, keyboard activation, all-no results and absence of personal/member/library RPC calls. CI adds this suite and a pinned disposable PostgreSQL job. No production credentials accepted by fixtures.
- Actual iPhone Safari, installed iPhone mode, Android, native share sheets, software keyboards and VoiceOver/TalkBack remain manual sign-off. Chromium emulation is not physical-device testing. See [mobile QA](qa/mobile-checklist.md).
