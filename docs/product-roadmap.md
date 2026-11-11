# Goodnights product roadmap

Date: October 20, 2026

Status: **Proposed for approval. No application or database changes authorized by this document.**

Evidence: [Competitive analysis, capability inventory, and API constraints](competitive-analysis.md)

## Product objective and guardrails

Make a repeat family dinner decision easy to start, easy to vote in, and trustworthy to act on. Prefer fewer decisions, understandable outcomes, and reliable family data over a long feature list.

- Remain free for this family, on static GitHub Pages with Supabase where practical.
- Preserve restaurant/member IDs, personal and organizer links, ballots, history, themes, and saved tiebreakers.
- Keep vanilla JavaScript and system fonts; no framework rewrite or default new dependency.
- Do not add paid APIs, subscriptions, automatic messages, or background notifications to the proposed sprint.
- Keep token-scoped RPC authorization and RLS. Group invite tokens must never become credentials for persistent preferences or family history.
- Use additive migrations only after approval, a private backup/export, and verification of the deployed schema. The historical `database.sql` is not an upgrade script.
- Preserve existing tally behavior for historical polls. Any new rule must be explicit, tested in JavaScript and SQL, and versioned where necessary.

## Ranking and effort definitions

Ranks are global priorities, not an instruction to start implementation. Tier groups reflect effort and maturity; a Tier 2 correctness issue can outrank a Tier 1 cosmetic change.

**Small:** approximately half a day to two focused engineering days. **Medium:** roughly three to six. **Large:** more than a week or significant external uncertainty. These include targeted verification but are planning ranges, not commitments. Database reconciliation and physical-device testing can change them.

Impact estimates are hypotheses for this family, not measured conversion or engagement results. High means a frequent task becomes substantially easier or an incorrect decision is prevented. Complexity is assessed against the current code and security model.

## Tier 1 — Quick wins

| Rank / ID | Feature and behavior | Inspiration | Why it helps / impact | Effort | Complexity and dependencies | Cost / API restrictions |
|---|---|---|---|---|---|---|
| 3a / Q1 | **Readable ballot foundations:** strengthen text/action contrast; show saved address/locality on approval, swipe and ranked details; consistent focus and selected states. | Existing app; Chicken Tender card hierarchy | Helps everyone identify and read the actual option. **High** | Small | Low; `styles.css`, `app.js`; existing restaurant fields; part of sprint recommendation 3. No migration. | $0; no new API or images. |
| 6 / Q2 | **Cleaner search and recovery:** explicitly distinguish saved-list filtering, online discovery and Maps paste; explain short links and missing coordinates; preserve drafts on errors. | DinePoll's separate manual/discovery paths | Reduces wrong expectations and dead ends. **Medium** | Small | Low; `renderRestaurants`, `getTown`, `findNearby`, `maps.js`; retain current request model. | $0; no Nominatim autocomplete or extra background requests. |
| 7 / Q3 | **Invitation-first reconnect:** emphasize “Open your invitation / connect this phone”; move family creation out of the primary path for this one-family installation; concise explanation of personal vs group links. | Browser guest flows; Goodnights audit | Reduces first-use confusion and accidental organizer-link sharing. **High** | Small | Low–medium; `renderWelcome`, connection validation, installation copy. No family existence enumeration API. | $0; no accounts or SMS provider. |
| 8 / Q4 | **Compact mobile navigation:** trial Home/Places/Votes/Family with a clear New vote action; fold optional setup filters; standardize icons and spacing. | Observed DinePoll navigation; Goodnights 390px layout | Gives restaurants more screen space. **Medium** | Small | Low; `navHtml`, `renderCreate`, CSS; prototype and family-check labels before committing. Avoid competing fixed bars. | $0; in-repo SVGs, system fonts. |
| 9 / Q5 | **Truthful method instructions:** clarify capped approval, required top-three ranks, most-yes versus unanimity, and completion versus online presence. Retain practice ballots. | Comparison of incompatible “consensus” claims | Fewer surprises, no new modes. **Medium** | Small | Low; `app.js`, `family.js`, README; no tally changes in this item. | $0. |
| 10 / Q6 | **Schema/setup documentation reconciliation:** document baseline plus upgrades and a safe fresh-instance process, remove contradictory setup advice after verification. | Repository audit | Prevents accidental data damage and broken fresh setups. **High operational** | Small | Medium uncertainty; deployed-schema inventory is needed after approval, plus isolated initialization check. No production rewrite. | $0 within existing tooling. |

## Tier 2 — High-impact improvements

| Rank / ID | Feature and behavior | Inspiration | Why it helps / impact | Effort | Complexity and dependencies | Cost / API restrictions |
|---|---|---|---|---|---|---|
| 1 / H1 | **Honest consensus outcomes:** all-no → “No shared choice”; no new random draw from zero-support leaders; positive ties keep existing choices. | Reproduced Goodnights issue; Where2Eat's no-match recovery claim | Prevents a rejected restaurant becoming a celebratory winner. **High** | Medium | Medium; tally/UI/share parity, additive server guard, historical resolution policy. | $0; no external APIs. |
| 2 / H2 | **Repeat dinner draft:** copy previous places, eligible people, method, meal and explicit cuisine into an editable review; fresh poll on confirmation. | DinePoll simplicity; family repetition | Removes routine setup while keeping control. **High** | Medium | Medium; existing owner reads/create RPCs; refresh roster/places, never copy ballots/tokens. No migration expected. | $0; reuse current RPCs. |
| 3b / H3 | **Clear, responsive swipe cards:** extend Q1 with directional feedback, visible card progress, accessible buttons and backtracking; retain explicit submit. | Chicken Tender published cards; Goodnights practice test | More understandable and enjoyable voting. **High** | Medium | Medium; touch/pointer coordination, focus and scrolling, reduced motion, stale-refresh protection. No migration. | $0; CSS/vanilla JS; no animation library. |
| 4 / H4 | **Location-aware restaurant saving:** exact source identity, name/address review, duplicate warnings and safe restore; local-only suggestions over family entries. | Goodnights SQL mismatch; Fork the Vote review stage | Prevents wrong branches and fragmented history. **High** | Medium | Medium; additive RPC/index migration after inspecting deployed definition; uncertain matches remain user-reviewed. | $0; existing OSM policy applies. No paid autocomplete, scraping, or mass geocoding. |
| 5 / H5 | **Actual meals and rotation:** optional confirmed meal/date; editable mistakes; rank shortlist suggestions by time since recorded meal; include unknowns. | DinePoll's decision distinction; Ready to Echo saved-place concept; family request | Stops repeat meals without pretending a vote equals a visit. **High** | Medium | Medium; new private meal table/RPCs, time-zone handling, full-history aggregate independent of latest-poll list. Depends on H4 identity policy. | $0 within Supabase allowances; no external API. |
| 11 / H6 | **Member favorites and cuisine preferences:** optional personal stars/soft preferences; explain why a shortlist fits; avoid interpreting every historical no as permanent dislike. | Chicken Tender favorites; Dinnduh preferences | Distinct personalization beyond the existing shared list. **Medium** | Medium | Medium; private preference table and token-guarded reads/writes. Personal link required to edit own preferences; organizer-assisted controls disclosed. | $0; deterministic rules, no AI. |
| 12 / H7 | **Family dining constraints:** optional cuisine/dietary notes and “can't eat here” restrictions reviewed before poll creation; show unverified suitability. | Dinnduh filters; optional veto idea from Fork the Vote | Avoids unusable shortlists. **High for affected members** | Medium | Medium–high; sensitive-data minimization, private scope, explicit conflict/empty-set handling; separate from scored votes. | $0; do not buy or invent allergy-safety certification. Confirm suitability with restaurant. |
| 13 / H8 | **Restaurant detail notes and trusted links:** family note, menu/website/source link, optional owner-confirmed details with date. | Chicken Tender notes; Ready to Echo provenance | Saves practical knowledge at the moment of choice. **Medium** | Medium | Medium; additive nullable fields or metadata table, URL validation and escaping; do not overload `icon_value`. | $0; outgoing links, no copied third-party review content. |
| 14 / H9 | **Suggested single pick:** draw from an organizer-reviewed eligible list, show the candidate set and randomness; separate from poll winner/history. | Solo modes; current Pick 5 and random ties | Faster on nights when voting is unnecessary. **Medium** | Small–Medium | Low–medium; local suggestion only unless later saved as a confirmed meal; H5/H7 can refine eligibility. | $0. No fake vote or repeated hidden reroll presented as fairness. |

## Tier 3 — Future enhancements

| Rank / ID | Feature and behavior | Inspiration | Why / impact | Effort | Complexity and dependencies | Cost / API restrictions |
|---|---|---|---|---|---|---|
| 15 / F1 | **Member nominations / want-to-try queue:** suggest candidates before a poll; organizer reviews branch and duplicates. | DineVote cached model; Fork the Vote | Shares shortlist responsibility. **Medium** | Medium | Medium; private nomination records, scope/limits, moderated promotion into saved places. Needs H4. | $0; no automatic social-media scraping. |
| 16 / F2 | **A small licensed photo collection:** optional restaurant-supplied or family-owned photos with provenance and thumbnail budgets. | Published Chicken Tender imagery | Useful visual recognition where logos are weak. **Medium** | Medium–Large | Medium; storage access design, resizing, license/credit fields, image removal, canvas fallback. | Potentially $0 within storage/egress; rights must permit use. No default Google photo caching. |
| 17 / F3 | **Optional documented logo provider:** trial Logo.dev for approved domains while preserving manual/SVG modes. | Chicken Tender provider attribution | Better brand consistency, not better food decisions. **Low–Medium** | Medium | Medium; public CDN token/origin rules, private API credentials if needed, fallback and attribution. | Free Community currently available with hard limits; recheck CDN vs API credits and hosting terms. |
| 18 / F4 | **Explainable shortlist recommendations:** mix favorites, never-tried and least-recent recorded meals; show reasons and allow overrides. | Family request; preference-based competitors | Useful only after data quality improves. **Medium** | Medium–Large | Medium; H4–H7, cold-start policy, no undisclosed member weighting. | $0 deterministic algorithm; no hosted LLM needed. |
| 19 / F5 | **Opt-in result Web Push:** notify subscribed devices after a poll truly completes. | Coordination use case | Useful when users leave the page. **Medium** | Large | High; service worker, subscription lifecycle, secure server delivery, retries, revocation, duplicate suppression; real iPhone Home Screen tests. | Free allowances may suffice, not guaranteed; no SMS or paid provider assumed. Separate approval and current platform-doc review required. |
| 20 / F6 | **Dinner history statistics:** simple meal/cuisine variety, without member-shaming or public scores. | Explicit user research request | Potentially useful once records exist. **Low now** | Medium | Medium; H5 and enough representative data; preserve repository instruction deferring organizer dashboard. | $0; no analytics SDK or tracking service. |
| 21 / F7 | **Licensed live place enrichment feasibility study:** evaluate current prices, rights, quotas and backend design before any build. | Google-rich competitor claims | Better hours/photos could help; conflicts with zero-billing goal. **Medium potential** | Large | High; secret management, field masks, attribution, retention rules, quotas, provider fallback. | Google billing required; **not recommended under current constraints**. Study only if owner changes priorities. |

Favorites, vetoes and rotation should influence the **shortlist**, visibly and before voting. They must not secretly change vote weights or exclude a selected restaurant after ballots arrive. A hard dietary restriction is not the same as a soft preference. If constraints yield no options, explain the conflict rather than quietly ignoring a member.

## Best next development sprint: five ranked improvements

Recommend a cohesive **“Clear choices, easier repeat dinners”** release. The first four items fit an initial engineering sprint more reliably than all five. Plan approximately 12–20 focused engineering days including integration and device QA for the complete five-item package; if capacity is two calendar weeks for one engineer, ship the first four and carry H5 into the next sprint. The estimate assumes deployed SQL matches the inspected upgrade chain.

### 1. Honest consensus and no-choice recovery — H1

**User experience.** When every restaurant receives zero yes votes, show “Nothing sounds good tonight” with a calm explanation and an organizer action to adjust the shortlist. No trophy, winner announcement, or random pick. If a restaurant wins with positive support short of unanimity, show the actual numerator/denominator and “Most yes votes,” not “Everyone agrees.” Positive ties retain runoff and the existing one-time saved draw.

**Current-app fit.** Extend the tally result with an explicit outcome state used by UI, messages, export image, and celebration logic. Do not add “maybe” or a fourth voting method. The current practice mode is a good place to teach the recovery path.

**Files / data.** `voting.js`; `app.js` (`renderResults`, `resultHighlights` integration, `makeResultsCard`, `celebrateResults`, refresh conditions); `family.js` (`result`, `highlights`); existing voting/family/smoke tests. Add an approved SQL migration updating `gw_resolve_tie_random`; consult `sql/random_tiebreaker.sql` as history rather than rewriting an already-applied migration.

**Migration:** **Yes**, additive function replacement/guard, potentially a rule-version field if the desired historical display requires it. No ballot rewrite. Old saved random outcomes remain recorded and explicitly labeled, even if their tally had zero support. New zero-support draws must be rejected server-side, including calls from an old browser.

**Risks.** JS and SQL can diverge; existing saved draws must remain immutable; “no positive support” is not the same as “no unanimous option.” Do not prohibit ordinary plurality winners or change ranked elimination rules accidentally. A zero-ballot closed poll is a separate empty outcome.

**Tests / acceptance.**

- All-no fixtures with one and multiple voters produce no acceptable option; UI, text/image share, and celebrations agree.
- Positive ties still permit one organizer draw; repeat and concurrent calls return the same saved ID.
- Unauthorized members/group tokens cannot draw; direct zero-support RPC calls fail.
- Historical saved draw remains visible; old links and counts unchanged.
- Zero ballots, single positive winner, mixed yes/no, early closure, ranked ties and exhausted rankings retain explicit expected behavior.
- SQL integration runs only in an approved isolated environment or rollback fixtures; never create/delete real family records for testing.

### 2. Repeat a dinner into a fresh reviewable draft — H2

**User experience.** History/results gain “Use this dinner again.” The organizer sees an editable Review with prior places, eligible people, meal, method and explicit cuisine. Any hidden restaurant or removed member is reported and omitted from the draft. The organizer can return to Places/People, then creates a new poll and shares its fresh invitation.

**Current-app fit.** Reuse the existing four-step state and `makePoll` path. This is a shortcut into the current wizard, not a second setup system. No “one tap sends to family”: messages remain user-sent drafts.

**Files / data.** `app.js` (`renderHistory`, `renderResults`, `renderCreate`, setup state/reset and owner read actions); `family.js` only if summary copy needs it; `tests/poll-setup.test.js`, `tests/guided-poll.test.js`, `tests/journey-reliability.test.js`. Reuse `gw_get_poll`, organizer roster reads and `gw_create_poll_themed`/configured creation chain.

**Migration:** **No expected**, provided existing owner reads supply the source roster. If a historical poll predates rosters, ask the organizer to choose people rather than inventing identity from the head count. Reconfirm this during implementation.

**Risks.** Never copy poll IDs, ballots, group tokens, member tokens, closed status or `tie_winner_id` into creation arguments. Fetch current active membership/restaurants and guard missing/deleted source polls. Existing old poll settings can differ from new defaults; display the draft's chosen settings explicitly. Cancel must leave the original untouched.

**Tests / acceptance.**

- Current and historical no-roster polls, explicit cuisine, hidden places and removed people.
- Minimum/maximum people and options; interrupted load preserves a recoverable draft.
- A new poll receives a new ID and group credential; no existing ballot or result changes.
- Repeated taps cannot create overlapping client requests; verify server idempotency separately if introduced.
- Family task target: at least 30% less organizer setup time over three comparable repeats, measured manually against baseline; no silent defaults.

### 3. Readable, informative ballots and responsive swipe feedback — Q1 + H3

**User experience.** All methods identify the restaurant's locality and cuisine. Swipe cards give immediate yes/no feedback, retain visible text buttons, show answered count, and make backtracking predictable. Enabled actions and secondary text are readable. A user can vote without gestures or animation.

**Current-app fit.** Keep the existing rounded brand, native ranked selects, explicit submit, success-only animation, compact waiting status, and image fallbacks. Show existing data first; no photo procurement blocks this work. A missing address says “Location not saved” instead of implying a verified branch.

**Files / data.** `app.js` (`restaurantRow`, method-specific ballots, `rankLogo`, `voteSwipe`, touch handlers); `styles.css`; `logos.js` only where image sizing/fallback composition requires it; `tests/app-smoke.test.js`, `tests/journey-reliability.test.js`, existing logo tests. No new database fields.

**Migration:** **No.**

**Risks.** Drag handling must not intercept vertical scroll or fire duplicate touch/pointer votes. Native selects must remain mounted while focused on iOS. Details links must not toggle a parent selection control. Do not label straight-line distance as driving distance. Cross-origin images may fail or taint canvas; keep fallback.

**Tests / acceptance.**

- Enabled ordinary text contrast at least 4.5:1; focus visible; do not rely on color alone.
- 320, 375, 390 and 430px widths, landscape, keyboard open, 200% text zoom, safe-area bars.
- Real iPhone Safari and installed mode; VoiceOver buttons/ranks/progress; keyboard-only desktop.
- Horizontal/vertical/cancelled gestures, rapid taps, backtracking after final card, failed save and reduced motion.
- All three methods submit unchanged ballot semantics. No remote request added merely by revealing a card.
- Family task target: identify the intended branch and complete a five-option ballot without assistance.

### 4. Location-aware saving and reliable free discovery — H4

**User experience.** Searching saved places offers instant local suggestions. Online search remains an explicit action. Before adding, show the branch's name/address and “Already saved” or “Possible duplicate” with a choice to use the saved location, edit it, or keep a separate branch. Never collapse two same-name restaurants silently.

**Current-app fit.** Extend the existing OSM/manual/Maps add flows, preserving logo options. Use OSM object identity when available; for manual entries compare normalized name **and** address. A name-only similarity prompts review and never proves a duplicate.

**Files / data.** `app.js` (`findNearby`, restaurant forms and add actions); `maps.js` parser UX; new small pure normalization/matching helper only if useful; `tests/maps.test.js`, `tests/poll-setup.test.js` and focused identity tests. Inspect/replace `gw_add_restaurant` through a new additive migration, plus a scoped unique source-ID index after checking existing duplicates. `gw_restaurants.osm_id`, name/address, coordinates and active status already exist.

**Migration:** **Yes.** Reconcile the actual deployed RPC first. For existing duplicates, produce an owner-review report; do not bulk-merge or delete. Historical `gw_poll_options.restaurant_id` references remain stable. Address edits must not silently repoint the restaurant identity; prevent or explicitly handle stale coordinates.

**Risks.** Same name/different address, OSM node/way representations of one place, incomplete addresses, punctuation, concurrency, and archived restores. A client warning alone cannot prevent concurrent duplication. Do not add a unique normalized-name index. Do not treat coordinate proximity alone as proof.

**Tests / acceptance.**

- Two branches with the same chain name remain distinct; exact OSM duplicate resolves safely.
- Same name with missing address warns; exact saved entry restores without changing historical references.
- Concurrent same-source saves produce one stable identity or a recoverable conflict.
- URL parsing and escaped text cannot inject markup; unsupported short Maps URLs remain manual.
- Offline/public-service failure retains drafts and offers manual entry.
- Local suggestions cause zero network requests. Any online expansion complies with the [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/), including aggregate rate limits; do not call ordinary per-device debounce sufficient.

### 5. Confirmed meals and gentle rotation — H5

**User experience.** On results, the organizer may tap “We ate here,” confirm a date, and save a meal record. A changed plan can be recorded at another saved restaurant. Next time, an optional “Not recently eaten” filter uses actual recorded meals, explains its basis, and offers “Show all.” Unknown history remains eligible.

**Current-app fit.** Add a small meal section within existing History, not a statistics dashboard. Keep poll results and meal records separate. No meal is created automatically by a win, a tie draw, or a Maps tap.

**Files / data.** `app.js` (`renderResults`, `renderHistory`, shortlist controls); `family.js` date/summary helpers if needed; focused meal/rotation tests. Proposed new `gw_meals` table: family, restaurant, optional source poll, meal date, timestamps, stable ID. Names/RPC signatures are design proposals, not existing objects.

**Migration:** **Yes**, additive table, indexes and narrowly scoped organizer RPCs with RLS/direct access denied. Store no personal dietary notes in meal records. Use `source_poll_id` with a non-cascading history policy such as `ON DELETE SET NULL`; deleting a poll must not silently erase confirmed meals. Decide explicitly whether any member view is needed; first release can be organizer-only.

**Risks.** Poll deletion/restaurant hiding, repeat taps, wrong dates/time zones, shared-device credentials, and users interpreting missing history as never visited. Never backfill wins as meals. Do not compute rotation from only the latest 20 polls. The server should return meal aggregates over the relevant family history.

**Tests / acceptance.**

- Confirm once, retry, edit/undo an accidental meal without changing ballots; server prevents duplicate event from repeat requests.
- Record another destination after a winning poll; original result unchanged.
- Hidden restaurants retain meal history; deleted source poll leaves independent meal intact.
- Local calendar dates across midnight/DST; zero/one/many recorded meals.
- Cross-family/member/group credentials cannot read or write organizer-only meal history.
- Rotation explains its window and supports override; no-options state is recoverable.

## Suggested implementation order and release boundaries

| Release | Work | Exit condition |
|---|---|---|
| **0 — Approval and baseline** | Approve the five-item scope; agree on historical all-no treatment and meal visibility. Inventory deployed SQL and take a private backup before approved migrations. Record baseline family task times. | Reviewable implementation plan and verified restore procedure; production remains unchanged until authorized execution. |
| **1 — Clear results and ballots** | H1 + Q1 + H3 + Q5. Smaller PRs for voting rules/server guard and UI polish. | JS/SQL outcome parity, existing tests pass, physical iPhone checks, no token/data regressions. |
| **2 — Faster planning and clean places** | H2 + H4 + Q2. Q3 can follow as a small onboarding change. | Repeat-draft task succeeds; branches remain distinct; free fallback works; no existing IDs merged. |
| **3 — Family memory** | H5, then optionally H8. | Explicit actual-meal capture works, privacy checked, rotation grounded in confirmed meals. |
| **4 — Personalization** | H6/H7 only after family feedback; F1/F4 when enough data exists. | Clear soft-preference vs hard-constraint behavior, useful explanations, zero-result recovery. |
| **Later / separate decisions** | Q4 navigation trial; Q6 operational maintenance; photos/logos, push or statistics only when justified. F7 remains outside current cost constraints. | Specific approval and provider/platform review where needed. |

H1 has highest correctness priority; Q1 is an inexpensive parallel part of that release. H4 precedes H5 so meal history is attached to meaningful location identities. Do not delay Q1 for photos, build H5 on inferred visits, or bundle Web Push with unrelated visual work.

## Verification and measurement plan

For implementation after approval, run the existing `node --test tests/*.test.js` suite and add only behavior-focused tests for the new rules. Use isolated/rollback database fixtures; test all existing personal/group/organizer flows and old unrostered polls. Verify before/after row counts, IDs, tokens and relevant constraints privately; no credentials or family records in commits, screenshots or logs.

Complete a short family acceptance session:

1. Organizer reconnects from an invitation and repeats a previous dinner.
2. Member identifies the correct restaurant branch and votes using buttons.
3. Another member uses swipe/backtracking, then edits through their personal link while voting remains open.
4. Exercise positive tie, all-no, early closure, and lost network with synthetic data.
5. Organizer records an actual meal and understands why next week's shortlist differs.

Track task time, requests for help, wrong-branch selections and unsuccessful recoveries manually. Suggested goals: 30% faster repeat setup; no incorrect branch collapse in fixtures; no all-no winner; no loss of drafts on failed searches; all five family tasks completed without explanation. These are proposed acceptance targets, not current measurements. No analytics SDK is needed.

## Approval requested

Approve, revise, or defer **H1, H2, Q1+H3, H4, and H5**. The conservative first sprint is the first four, with meal history as the next release. Approving this roadmap should not be interpreted as permission to purchase services, change authorization semantics, rewrite historical outcomes, or deploy without the agreed implementation review.

See the [analysis](competitive-analysis.md) for competitor evidence, current-feature overlap, visual direction, provider pricing, restrictions, and source links. No proposed schema or feature in this document has been implemented.
