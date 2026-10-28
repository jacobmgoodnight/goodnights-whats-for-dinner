# A fresh household instance

Use a **new, empty Supabase project**, never the Goodnight production project. One household per project remains intentional. No billing provider, paid APIs, framework, or build step is needed. Review current [Supabase free allowances](https://supabase.com/pricing) and [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

1. Fork/download this repository. Create a new Supabase project. In SQL Editor, run **[sql/fresh-install.sql](../sql/fresh-install.sql)** once, in full. It refuses existing `gw_*` objects transactionally. This consolidated core schema includes permanent members, private profiles, ballots, rosters, group entry, themes, saved tie draws, honest all-no outcomes, location identity, presets, nominations and organizer events. It contains no family records, credentials, worker settings, or production URLs.
2. For the one-time-poll frontend in this release, next apply only [the one-time migration](../supabase/migrations/20261028162644_one_time_travel_polls.sql) to that new instance. The core installer intentionally remains the reviewed foundation snapshot; do not replay other historical migrations. Then set only your project's public URL and publishable key in `config.js`. Never use a secret or service-role key. Deploy `main` and repository root using GitHub Pages over HTTPS. Keep the current repository path; application links are relative.
3. Open your new site and create the household **before distributing its URL**. Bootstrap is first-claim, appropriate for a private household project. Save the organizer link from Members in a private password manager. Create two synthetic members and two fictional restaurant locations for acceptance testing in this new instance.
4. On two isolated browser profiles, open personal invitations, create/vote using each of the three methods, edit a ballot before completion, close a poll, and inspect public results without credentials. Verify group entry discloses only invited names/photos/status and does not permit saved-ballot editing. Check that the anonymous API cannot read tables or execute `gw_vote` directly. Use [the QA checklist](qa/mobile-checklist.md).
5. Remove only your new instance's disposable acceptance records through its UI, then add your household. Never point fixtures at production. Keep an encrypted, recoverable backup before future schema changes.

Background push is **unconfigured by design** in the minimal installation. Organizer events still work. Do not apply historical planning migrations on top of this installer. Optional push requires a separate reviewed deployment of the delivery, scheduler and queue-privacy SQL, Vault configuration and private worker described in [organizer planning](organizer-planning.md); extension availability, worker authentication and real-device delivery must be verified separately. Core voting never requires push.

## Versions and upgrades

The installer consolidates the core deployed catalog inspected October 28, 2026. It is a fresh-install artifact, not a live upgrade, rollback script, or way to reconcile Supabase migration tracking. In production, source timestamps differ from applied migration timestamps. [The release records](release-organizer-20261021.md) describe this mapping. Never run `database.sql`, `fresh-install.sql`, or a blanket `supabase db push` against that project. New features require individually reviewed additive migrations.

For local verification, `tests/sql/fresh-install.cjs` starts isolated PostgreSQL with synthetic data and accepts **no database URL**. Install `embedded-postgres@17.10.0-beta.17` and `pg@8.23.1` in a disposable tooling directory, set `GW_PG_RUNTIME` to its `node_modules`, and run `node tests/sql/fresh-install.cjs`. This checks installation, repeat-install refusal, all modes, personal edits, group boundaries and grants. It does not prove hosted extension or physical-phone behavior.

## Recovery and troubleshooting

- Connection errors: check your own URL/key and Supabase project status, then retry. Manual restaurant entry works when public OSM search is unavailable.
- Invalid/reset invitations: ask the organizer for a fresh personal link. An incoming link is verified before replacing saved access. Browser storage is per origin/profile and may be cleared by the device.
- Before a production upgrade, privately back up all affected app tables, functions, grants, triggers and migration records, encrypt the artifact and keep its recovery key separately. Verify decryption/checksums and rehearse restore in isolation. Do not commit backups or screenshots containing invitations.
- Frontend rollback: revert the reviewed frontend commit; retain additive database objects/data. Database restoration over live records is a separate, explicitly approved recovery action. Historical local backups documented in release notes are not evidence of a current scheduled backup or off-device recovery test.

## An isolated public demo

The existing empty-config demo is sufficient for exploration. A future public demo should live at a separate origin with empty configuration and fictional fixtures only. This separates its local storage from the family site and avoids confusing visitors about shared voting. No public hosted demo or new Supabase project is created by this change.
