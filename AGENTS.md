# Goodnights — Codex Instructions

This repository powers the Goodnight family's **live** restaurant-voting web app at
https://jacobmgoodnight.github.io/goodnights-whats-for-dinner/

## Architecture
- Static, mobile-first, no-build HTML/CSS/vanilla JS (GitHub Pages, `main` branch and repository root).
- `app.js`: screen rendering, restaurant search, family links, three voting modes and Supabase RPC requests.
- `voting.js`: approval, swipe/consensus and instant-runoff/runner-up tally.
- `maps.js`: free browser Google Maps search deep link and paste-parser, plus OpenStreetMap lookups in app.js.
- `logos.js`: SVG food icons, manually specified HTTPS logo images, and website/brand favicons. The favicon endpoint is a best-effort third-party service, not a paid Google Places API. Use SVG fallback if unavailable.
- `config.js`: **public** Supabase project URL and publishable key, safe to commit. Never commit a service-role, secret key, or private family/member link.
- Supabase Postgres project ref `rwqclcpmtuebxndadkxv`. Its existing tables begin `gw_`, all RLS-enabled. Browser uses a publishable key to call token-guarded `gw_*` SQL RPCs; it does not directly query tables.
- Existing `database.sql` is the **original baseline** and should not be rerun on the live database. Schema enhancements live in applied Supabase migrations and `sql/restaurant_visuals.sql`; **before initializing a fresh environment**, reconcile baseline and subsequent migrations.

## Current functionality
- Family owner and personal member links, persistent across devices. Member tokens must never be exposed to others; owner can reset them. New votes require a valid member link.
- Restaurant list, OpenStreetMap search by name and/or town, free Google Maps search + copy/paste/manual add.
- Restaurant visual modes: `auto` (known chains -> website favicon), `logo_url` (direct HTTPS image), `website` (domain favicon), `builtin` (15 SVG icons). Owner can edit name/category/address/visuals; poll cards/results inherit visuals.
- Three vote modes, poll history and results. No paid integrations or login subscriptions.

## Local work
- No npm install needed. Run `node --test tests/*.test.js` (Node 22+) after changes.
- GitHub Actions workflow `.github/workflows/verify.yml` runs the same checks.
- Prefer small pull requests rather than overwriting the live `main` branch. Keep existing data and URLs stable.
- Browser/visual tests and real multi-phone voting should be retested after any changes to member tokens or poll results.

## Security and operational caveats
- The app is a trusted-family tool, **not** a secure public election or full login/auth implementation. Browser-visible URLs are bearer credentials. Organizer token grants elevated control; family member URLs allow votes. Do not put tokens in README, logs, screenshots, or commits.
- SQL functions declared `SECURITY DEFINER` need explicit token checks and tightly scoped grants. RLS is enabled; do not replace it with permissive table policies. Keep `gw_vote` (the old name-only voting RPC) inaccessible to `anon`.
- External logo image URLs can expose visitor IPs to the image host; owner knowingly selects them. Validate URL schemes, HTML-escape image URLs, and use `referrerpolicy="no-referrer"` with SVG fallback on error.
- Do not scrape Google Maps or depend on undocumented Google Places content/storage. Using ordinary Google Maps links + manual entry is free.
- Keep free GitHub Pages + free Supabase deployment.
- Existing saved restaurants, member IDs, votes and organizer/member invite links must survive schema changes.

## Suggested next tasks
1. Verify responsive layout, image fallbacks, and editing on real iOS and Android phones.
2. Improve mobile navigation (five tabs may wrap), and add a non-secret owner settings screen.
3. Review security of token-based RPCs; explore optional passwordless sign-in without adding ongoing costs.
4. Improve location deduplication and restaurateur image/website attribution, keeping manual overrides.

## Guided polls and profile invariants
- New polls use `gw_create_poll_for_members`; selected IDs are in RLS-protected `gw_poll_members`. The count is derived from selected active members. Historical polls have `roster_enabled=false` and keep their original head-count behavior.
- `gw_get_poll_people` requires an organizer or same-family member token. It returns status/name/avatar only, never contacts, invite tokens or ballots. Public `gw_get_poll` must not reveal participant identities. Routine status refreshes set `p_include_avatars=false` and reuse cached images.
- Profile photos are compressed to 256×256 JPEG data URLs, up to 120,000 characters. Old photos remain valid. The existing `phone` field accepts a phone number or iMessage email and remains organizer-only.
- Texting stays user-sent drafts. Do not imply automatic notification or delivery, install a messaging provider, or add costs without new user direction.
- Additive SQL for this flow is in `sql/guided_poll_participants.sql`; it is already applied to the live database.
- When group name selection is disabled, invitations share a token-free `?poll=` entry URL. Reuse a stored member identity, or verify a pasted same-site personal link before saving it. Never publish reusable member tokens in a group invitation or public chooser.
- New-vote UI defaults to the poll-scoped avatar/name picker (the organizer can disable it) (`?poll=…&join=…`). The UI discloses that anyone with that invitation can see the invited names/photos and submit once as any invited person. `gw_group_poll` validates the poll-specific group token and invited membership; it never returns reusable member tokens, contacts, family history, or saved individual ballots. Only personal links may edit saved votes. Disabling group access revokes the token; reenabling rotates it. Never include a group token in results shares.
- `sql/voting_experience.sql` is the applied additive settings/group-entry/history upgrade. `gw_poll_settings`, `gw_create_poll_configured` and `gw_delete_polls` require organizer credentials. History deletion requires explicit UI confirmation; clear-history deletes only finished polls. Never delete actual family records while testing; use rollback-only fixtures.
- `allow_member_home` hides member home navigation on a poll and its results; it is a UI preference, not a security boundary. Existing personal links and history APIs remain compatible.
- Ranked-select changes must update controls in place, without replacing or refocusing the native select (iOS can reopen it). Defer background rerenders while a form control is focused. Submission animations respect reduced motion and run only after a successful save. Results-image creation/sharing is organizer-only; including crew photos/names is opt-in.

- New-vote UI defaults: allowMemberHome=false, groupJoin=true. Existing poll settings and SQL defaults stay unchanged; always pass the chosen UI settings through gw_create_poll_configured.
- Cuisine selection replaces the shortlist with matching saved places (up to 20), retaining search/location constraints. Never classify cuisine from an address or change restaurant records while filtering.
- Keep Waiting on… compact, with adjacent dots and visible Already voted checks; preserve organizer reminders. Extra results highlights are optional (at most one), never turnout or routine round-count cards.
- Installation uses the existing web app, with public credential-free manifest and code-derived icons. No service worker, offline ballot queue, subscription or background push is configured. Do not claim installation alone provides notifications. Welcome-screen invitation connection must verify same-site URLs and credentials before saving.

- Explicit cuisine metadata is stored by the token-guarded gw_create_poll_themed wrapper; do not infer a historical theme from restaurant names. sql/themed_family_votes.sql is applied. Retain theme through runoffs and every invitation/results surface.
- gw_group_poll people responses include an opaque family_id only after group-token validation. It scopes a browser-local member-ID preference, never an authorization credential. Verify the remembered ID is invited/active under the current group credential. New per-poll memories also include familyId. Legacy memory upgrades require one unambiguous eligible identity. Not you stores an empty family preference to pause restoration; do not let legacy fallback immediately choose the old person again.
- Disable already-voted picker buttons and guard the action, including a fresh has_voted check before accepting manual selection. Remembered voters may return to their saved acknowledgement. Keep the server’s group vote-once guard and personal-only ballot editing.
- Members has explicit reset/remove actions with confirmations; no typed command prompts. Removing a member preserves historical ballots but also disables current voting access.
- Use only animated dots beside Waiting on. Results animation is once per poll/tab session and supersedes submission animation for the final voter. Preview votes do not celebrate as real results. Honor reduced motion for all added movement.
- Defer an organizer statistics page until the user asks again after more data accumulates.

- Optional random tiebreakers require organizer credentials and a finished, genuinely tied tally. gw_resolve_tie_random computes leaders on the server, locks the poll and saves one immutable pick. Never reroll in the browser, change ballots/counts, or select eliminated ranked candidates. Preserve the random-choice disclosure in every results surface and suppress misleading consensus highlights. sql/random_tiebreaker.sql is additive.
