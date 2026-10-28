# Product and engineering review — October 28, 2026

## Current state and evidence

Reviewed current `main` d91f694, the tracked frontend/helpers/assets, tests, workflow, baseline, all checked-in SQL/migrations, worker and operational documentation; compared PRs #1–19 and the read-only deployed catalog/migration history. The previously checked-out organizer branch was behind the README update; implementation starts from current main and preserves its screenshots and overview.

The application already delivers three voting modes, guided four-step setup, personal/organizer credentials, poll-scoped group invitations, remembered group identities, private personal ballot edits, live waiting status, manual message drafts, themes, result sharing, runoffs and immutable random ties, honest all-no/empty recovery, repeat drafts, named presets, nominations, optional organizer alerts, Home Screen metadata, restaurant logo modes, OSM discovery/Maps paste and location-aware duplicate review. Preserve these. Existing IDs, links, historical polls, palette and names-only native ranked menus remain stable.

Architecture: root-hosted GitHub Pages with no build or frontend runtime dependencies; `app.js` remains the UI/RPC coordinator, with voting/maps/logos/family/alerts helpers. Supabase project uses 13 public RLS tables and token-checked browser RPCs. The private push worker uses a leased queue, bounded retries and Vault secrets. No framework or new external restaurant/AI service is justified.

Baseline: **127/127 Node tests passed**; existing synthetic Edge checks passed repeat/all-no recovery, restaurant review/failure and organizer planning at 320/390px. Tests are evidence of covered behavior, not physical-phone acceptance. Current gaps are actual meals (vote winners are not meals), no-poll decisions, automated browser CI, a reproducible consolidated fresh setup, and invitation replacement on initial URL validation failure. Five tabs already wrap acceptably; a wholesale navigation redesign is not justified by screenshots alone. Organizer Home already prioritizes the active poll and has Start a family vote.

## Security assessment

Read-only inspection confirmed 52 deployed `gw_*` functions, 38 intentionally anonymous SECURITY DEFINER entry points, explicit search paths, anonymous denial on all 13 public app tables, internal worker/helper execution denied, and anonymous schema creation denied. Reviewed function bodies for token checks, family-scoped IDs, active membership, roster membership, group-token locking/vote-once, personal ballot access and reset/removal. `gw_vote` remains inaccessible to browser roles. The 14 RLS/no-policy findings include the private settings table and implement default denial. Do not blindly remediate these warnings by granting policies or revoking the app's public RPCs. See [advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) and [function guidance](https://supabase.com/docs/guides/database/functions).

The performance advisor reports two unindexed restaurant foreign keys (`gw_poll_options`, `gw_nominations`), four unused indexes and an Auth connection configuration advisory. None proves a current household performance issue. Retain indexes supporting future queue/member access; defer production tuning until measurements justify it. No deployed permissions, extensions, worker configuration, keys or records were changed during this review.

Confirmed frontend defect: `init()` used to persist an incoming member/organizer URL before checking it. A typo, reset link or network failure could replace working access. Release 1 verifies first and preserves both stored credentials on failure. A document-wide no-referrer policy further limits outbound URL disclosure. HTTPS/image escaping/SVG fallback and user-selected external hosts remain intact. These measures do not remove bearer links from browser history or forwarded messages.

Residual limitations: first-claim household bootstrap, no self-service organizer rotation, no per-IP rate limiter, and intentionally public completed anonymous ballot arrays (small groups may infer choices). Group links are trusted-family impersonation-capable invitations by design. Contacts/reusable member credentials stay organizer-only; public results omit people. Resource caps and row locks help abuse/concurrency but are not public-service authentication. Backup release notes show historical encrypted backups, not proof of current scheduled/off-device recovery. See [SECURITY.md](../SECURITY.md) and [catalog-only checks](../sql/security-audit.sql).

## Prioritized decisions

Effort estimates are engineering days including verification: S ≤1, M 2–4, L 5–10. Risk concerns regressions/operations, not advisor counts. This is a household backlog, not a commitment to implement every option.

| Priority | Recommendation / current state | User benefit and smallest useful choice | Effort | Risk / dependencies | Decision |
| ---: | --- | --- | --- | --- | --- |
| 100 | Preserve current authorization/voting; implemented | Avoid lost access/data; keep token guards and all three rules | S ongoing | High if changed; deployed catalog | Implement regression checks; reject redesign |
| 99 | Initial invitation validation; bug confirmed | A bad link/network failure cannot erase saved access | S | Low; existing readers | Implement R1 |
| 98 | Browser smoke CI; helpers exist, CI Node-only | Catch broken mobile/member journeys before merge | M | Low; pinned dev-only Playwright | Implement R1 |
| 97 | Fresh install; baseline misses upgrades | A new household can initialize without guessing migration order | M | Medium; inspected schema, isolated PG | Implement core installer R1 |
| 96 | Actual meals; missing | Explicit date/place record, independent of poll | M | Medium; additive schema approval | Implement R2; approval before production |
| 95 | Quick Pick; missing | Choose dinner in seconds without a poll | M | Low–medium; current restaurant library | Implement R2 |
| 94 | Last eaten/rotation; missing | Suggest places not recently visited with honest explanations | M with meals | Medium; date-only history availability | Simplify into R2; no inferred visits |
| 92 | Meal corrections/deletion/recent list; missing | Fix mistakes without altering polls or restaurants | S with meals | Medium; owner-only writes | Implement R2 |
| 90 | Network retries; voting/library guards already present | Preserve drafts and acknowledge saves truthfully | S | Low; intercepted failure fixtures | Preserve; extend to meal writes |
| 88 | First-time onboarding; invitation connection already present | Prioritize the invitation over creating a household | S | Low; saved credentials | Simplify copy/hierarchy after R1 |
| 86 | Local dates/time zones; no meal schema yet | Same calendar date on both coasts, including DST | S | Medium; date-only contract | Implement R2; native date control |
| 84 | Security/recovery/contribution docs; scattered | Explain trusted-group boundaries and safe upgrades | S | Low; catalog evidence | Implement R1 |
| 82 | Active-vote Home / Start vote; implemented in #18 | Returning organizer sees what needs action | None | Existing flows | Preserve; add Quick Pick alongside |
| 80 | Phone acceptance; simulations only | Validate actual Safari/installed/Android interaction | S user/device time | Devices unavailable | Implement checklist; manual verification remains |
| 78 | Cuisine/tonight constraints; poll cuisine/proximity exist | Quickly narrow Quick Pick without permanent profiles | S | Low; saved metadata only | Simplify to cuisine and recent-visit toggle |
| 76 | Preferences/favorite restaurants; missing individually | Personal recommendations without changing voting | M | Medium; private member CRUD/RPCs needed | Defer until family uses Quick Pick |
| 73 | Five-tab navigation; responsive but repetitive | Remove duplicate New vote destination using Home action | S | Low–medium; family familiarity | Defer broad change; validate four-tab trial first |
| 71 | Restaurant website/menu; icon domain only | Open a reliable owner-entered menu/site | M | Medium; schema + safe HTTPS reader separation | Defer to focused details PR |
| 69 | Notes, general price, takeout/dine-in; missing | Decide with known family-supplied information | M | Medium; public poll privacy/unknown semantics | Defer; avoid large form |
| 67 | Distance; existing poll filters with coordinates | Reuse known straight-line distances | S | Low; optional geolocation, missing coordinates | Preserve; add to Quick Pick after usage evidence |
| 65 | Budget/restrictions/dislikes; no trustworthy data | Hard constraints need explicit reliable metadata | M–L | Medium; privacy and zero-match recovery | Defer; never infer from a no vote |
| 63 | Refactor large app.js; 1,216 lines | Pure decision/date logic separately testable | S per extraction | Medium; behavior-preserving tests | Implement focused module R2; defer broad split |
| 61 | Logos, address/Maps, category; already implemented | Distinguish branches and recover broken images | None | Third-party host privacy | Preserve; reject new image API |
| 59 | Repeated data requests; 8s polls/15s Home | Avoid added background meal queries/rerenders | S | Low; cache invalidation after writes | Implement on-demand history R2 |
| 57 | README/screenshots; just updated #19 | Keep accessible overview; link accurate setup | S | Low | Preserve; one setup link R1 |
| 55 | Repo description/website accurate, topics empty | Improve discovery without changing product | S | Admin-capable metadata API unavailable here | Recommend topics; leave values intact |
| 53 | LICENSE missing | Clarify permitted reuse | S | Requires owner's license decision | Recommend MIT; do not add automatically |
| 51 | PR #12 research roadmap; open draft/outdated statuses | Prevent reimplementing H1–H4 | S | Existing review history | Reconcile below; retain research evidence |
| 49 | Isolated demo; empty-config demo already works | Let visitors explore without family access | S | Separate origin/storage required | Document path; defer public deployment |
| 46 | Import/export non-sensitive places; missing | Portability without tokens/member data | M | Medium; CSV/JSON validation/dedup | Defer |
| 43 | Missing FK indexes/minor advisors | Possible future maintenance speed | S | Production approval + measurements | Defer; do not remove unused indexes |
| 40 | Home Screen help/alerts; implemented | Better return visits; explicit device opt-in | None | Physical push verification pending | Preserve; no additional reminders |
| 35 | Wish lists; nominations already implemented | Family can suggest places for review | None | Existing H4 review | Preserve; reject duplicate list |
| 30 | Decision stats; explicitly deferred in AGENTS | Limited value until actual meal data exists | M | Data volume/privacy | Defer |
| 20 | Other-household onboarding/multi-family | Little benefit to this household | L | Auth/tenant redesign/maintenance | Defer onboarding; reject multi-family scope |
| 10 | Scraped hours/ratings, paid AI/Places/SMS | Unreliable/costly for simple dinner decisions | L | Licensing/cost/privacy | Reject |
| 5 | Framework rewrite/offline ballot queue | High migration/conflict burden | L | IDs/links/vote reliability | Reject |

## Reconciliation with research PR #12

#12 remains an open draft, not an unimplemented feature list. H1 honest outcomes merged #13; H2 repeat drafts #14; Q1/H3 ballot details/feedback #15; H4 location-aware saving #16. Subsequent #18 adds Tonight, named presets, nominations and explicit alerts; #19 improves README/screenshots. H5 confirmed meals/rotation is the remaining high-value research brief and becomes R2. Q2 search separation/draft recovery and Q5 truthful instructions largely exist; Q3 invitation-first hierarchy and Q4 compact navigation merit small follow-ups, not a duplicated new flow. Q6 fresh setup is R1. Personalization/statistics/public APIs stay deferred. This document supersedes implementation statuses and priorities in #12; it does not replace its comparative evidence or merge that old PR automatically.

## Release boundaries and deliverables

**R1 Foundation:** verified incoming invitations, no-referrer, browser smoke job and first/returning group coverage, fresh core installer with isolated functional/role tests, setup/security/contribution/physical-device guides. No production migration needed; no deployment/merge performed by this audit. Normal Node suite is 133/133 after the new credential tests. Empty-install rehearsal passes all three methods, saved edits, public/group privacy and permission denial in isolated PostgreSQL. Hosted fresh-project acceptance and physical phones remain manual.

**R2 Smarter decisions:** a separately reviewable, dependent PR for explicit meals and deterministic Quick Pick. Additive production migration must be approved and verified before frontend merge/deployment. New pure date/rotation helpers keep app.js growth focused. Private meal records never enter public poll responses. No preferences profile, food diary, nutrition, paid services or guessed business hours.

**R3 Family feedback:** first-invitation hierarchy, test a smaller nav, optional private favorites only if useful. **R4 Maintenance:** manual menu/site fields and one focused UI extraction at a time. Do not roll these into a large rewrite.

The three highest-value next product improvements are: confirmed meal memory with easy corrections; an explained one-tap Quick Pick; and invitation-first reconnect/onboarding. Judge success by whether an organizer can make a no-poll decision in a few taps, record the actual meal once, and a first-time voter understands their next action. No real household timing study was performed.

## Implementation outcome

[Foundation PR #20](https://github.com/jacobmgoodnight/goodnights-whats-for-dinner/pull/20) passes both hosted Node and Chromium jobs. The browser runner is pinned to Ubuntu 24.04 and Playwright 1.62.1; this matches the verified local tooling and avoids OS/browser version drift found during CI setup. It remains unmerged.

R2 now implements explicit meal CRUD, recent-50 history, last-eaten labels in the restaurant library, deterministic recency rotation, Home Quick Pick, non-repeating alternatives/explicit restart, collapsed dinner filters and invitation-first welcome hierarchy. Pure logic is in `decisions.js`; existing voting logic is unchanged. **140/140 Node tests**, synthetic 320/390px decision/result-meal/error/retry journeys, the existing organizer/repeat/location regressions, and isolated PostgreSQL preservation/authorization/concurrency/date/history checks pass. The [exact migration, verification and non-destructive rollback plan](release-smarter-dinner.md) gates production approval. No migration or frontend deployment has occurred.

Remaining work is deliberately smaller than the original feature menu: physical-device and hosted staging acceptance; approval/application of the exact meal migration before frontend merge; optional private favorites after family feedback; a measured four-tab trial; manual menu/site metadata; and later, focused UI extractions. The current description/website are accurate. Added and visibly verified repository topics through GitHub's metadata editor: `restaurant-voting`, `family-app`, `dinner-planner`, `ranked-choice-voting`, `pwa`, `supabase`, `github-pages`, `vanilla-javascript`. The connector lacks that write operation, so the browser supplied it. Updated the older draft PR #12 description with current shipped/reviewed statuses and links, preserving its historical comparative research. Main is currently unprotected; requiring the normal test/browser checks before merges is a separate owner-reviewed repository setting, not changed here.

For licensing, **MIT** fits an owner who wants broad free reuse: it permits modification, redistribution and commercial use while requiring the copyright/license notice and disclaiming warranties. It also permits proprietary derivatives. It does not relicense restaurant artwork or OpenStreetMap data. No license file was selected or added; the owner must approve that choice. Until then, public source availability is not a general reuse license.
