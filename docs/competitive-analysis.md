# Goodnights competitive analysis

Research date: October 20, 2026

Status: **Research and recommendations only; awaiting owner approval.**

Companion document: [Prioritized product roadmap](product-roadmap.md)

## Executive summary

Goodnights should become the quickest way for this family to choose from places they know, discover an occasional new option, and remember where they actually ate. It already has a much stronger family foundation than a disposable restaurant poll: reusable personal links, a shared restaurant library, named participants, avatars, three voting methods, history, runoffs, a saved random tiebreaker, and group-chat invitations.

The best next investment is refinement and trustworthy data, rather than adding another voting mode or a paid restaurant feed:

1. **Make unsuccessful votes honest.** An all-no consensus ballot currently produces a tie between rejected restaurants. Distinguish no acceptable option from a positive tie, and prevent a new random draw from selecting an all-no option.
2. **Shorten repeat decisions.** Let the organizer review a fresh draft based on a previous dinner, preserving active people and saved places without carrying over votes or credentials.
3. **Make ballots easier to scan and operate.** Improve contrast, show the location being voted on, and make swipe feedback clearer while retaining buttons, progress, backtracking, and reduced motion.
4. **Make saved places reliable.** Address location-aware deduplication and make the existing OSM/manual/Maps entry paths clearer. Autocomplete should use already-loaded family data, not public Nominatim.
5. **Record actual meals.** An optional “We ate here” action can support useful rotation suggestions. A poll win is not evidence of a visit.

Competitor evidence supports short setup flows, progressive disclosure, useful restaurant facts, and clear outcomes. It does **not** establish that AI recommendations, extra animations, or unanimity-first matching produce better family decisions. None was evaluated in a controlled family study.

Keep GitHub Pages, vanilla JavaScript, and Supabase. Do not add Google Places billing to the next sprint. Keep existing family/member links, restaurant IDs, ballots, and historical outcomes intact. Detailed effort estimates and approval boundaries are in the [roadmap](product-roadmap.md).

## Method, evidence, and limitations

The repository root in this workspace is `app/`; paths below are relative to that root. Read `AGENTS.md`, `README.md`, `app.js`, `family.js`, `voting.js`, `maps.js`, `logos.js`, `styles.css`, `index.html`, the baseline SQL, additive SQL, tests, and CI configuration. The research branch starts at upstream `main` commit **`bb15b00`**; its application files matched the initially inspected local commit **`c6e43b8`**. No production database query, feature implementation, migration, or deployment was performed.

Evidence labels:

- **O — Observed:** directly inspected browser UI, screenshot, local source, or local demonstration. A form inspection does not prove its backend works.
- **C — Claimed:** official website, help page, or developer-authored App Store description. This verifies the published claim, not successful use.
- **I — Inference:** design judgment or predicted benefit.
- **U — Unverified:** unavailable, not disclosed, or inaccessible within this research.

### Inspection log

| Product | What was inspected | What was not tested |
|---|---|---|
| Goodnights | Public live welcome; source at the commits above; an isolated temporary copy with empty configuration, exercising the existing local demo. Verified 390×844 viewport, Places → People → Method, Pick 5, practice swipe voting and all-no results. | Private live family records, live SQL deployment state, real multi-phone voting, physical iPhone Safari, VoiceOver. Demo results are not production integration tests. |
| PlatePoll | Official landing page and rendered visual design, pricing, FAQ, terms. | Native app unavailable through the observed launch-waitlist flow; no household or ballot tested. |
| Dinnduh | Rendered welcome and embedded illustrative ballot; host signup screen; plans table; help, including expanded voting FAQ. | No account created, verification code requested, paid flow, live session, or real ballot. |
| DineVote | Search-indexed official homepage describing v3.0 forms. | Direct web retrieval timed out; browser reported DNS resolution failure. Indexed copy was marked roughly six months old. No current UI or functionality verified. |
| TableVote | Landing → Start Voting → Set the Table; name, ZIP, radius, categories; opened Pro explanation. | No location permission, restaurant query, table creation, joining, live sync, payment, or ballot. |
| DinePoll | Browser landing → new poll; manual shortlist screen → search alternative; pricing. Official how-it-works and planning guides. | No poll published or ballot submitted; no restaurant result accuracy, tie settlement, or paid purchase tested. Web extraction timed out, but browser access succeeded. |
| Chicken Tender | Official page, rendered favorites/card screenshots and feature explanations. | Native installation, Bluetooth pairing, actual gestures, and data accuracy. Published images are not hands-on app testing. |
| Hangrily | Official web text and pricing route. | Authenticated flow and rendered ballot; pricing route extraction repeated homepage content. |
| Where2Eat, Fork the Vote, Tine | US App Store descriptions, available release notes, prices, and reviews where present. | Native apps and their actual interfaces; screenshot placeholders in extracted listings were not treated as visual inspections. |
| Ready to Echo | Official feature descriptions and pricing section. | Link extraction, shared spaces, polls, billing, and native share extension. |

Prices below are USD as displayed on the research date, not guarantees. Review counts are small; Tine's displayed reviews include older versions. Reviews provide anecdotal context only. No claims of “under two minutes,” “fair,” “verified,” or “everyone agrees” were accepted as independent performance evidence.

Research validation: the unchanged application's existing Node suite passed **63/63 tests**. Local Markdown links were checked. The all-no finding was reproduced separately in practice mode and by calling the existing tally helper; passing the existing suite does not mean this uncovered behavior is correct. No new test or application file was added for this research.

## Existing capability inventory

**Implemented** means supported by inspected code, with deployment claims identified separately. **Partial** means a useful version exists but the broader requested capability does not.

| Capability | Status | What exists and the remaining gap | Code evidence |
|---|---|---|---|
| Family creation and management | Implemented for one household | Organizer setup and member administration; baseline intentionally restricts installation to one family. Not a multi-household SaaS. Welcome still emphasizes creation even when an existing family member needs to reconnect. | `app.js` `renderWelcome`, `renderMembers`; `database.sql` `gw_one_family_only` |
| Persistent personal voting links | Implemented | Token-checked personal links, reset/remove, remembered identity, same-site connection validation. Group picker is a disclosed honor-system convenience, not authentication. | `app.js` `restoreGroupPerson`, `connectVote`; `AGENTS.md` |
| Group invitations and people | Implemented | Selected roster, avatar/name picker, personal invitations, user-sent SMS/iMessage/share drafts, waiting/voted status, reminders. Routine refresh roughly every eight seconds; not a websocket presence service. | `app.js` `pollSharing`, `peoplePanel`, `loadPeople`; `sql/guided_poll_participants.sql`, `sql/voting_experience.sql` |
| OSM discovery | Implemented, limited coverage | Nominatim town geocode, 30-day local town cache; Overpass name/brand lookup within 20 km, browsing within 10 km, capped at 45 displayed results. Geolocation and manual fallback. No reliable ratings, photos, or current-hours feed. | `app.js` `getTown`, `findNearby` |
| Google Maps addition | Implemented, manual | Free outgoing search links and parser for pasted text/readable long URLs. Short links do not contain a readable restaurant name; there is no Places API lookup or automatic redirect resolver. | `maps.js`; `app.js` restaurant forms |
| Restaurant library | Implemented | Shared saved list, filtering, editing, hiding, restoring. The UI calls all saved entries “favorites”; no separate star or per-member favorites model. | `app.js` `renderRestaurants`; `database.sql` `gw_add_restaurant` |
| Deduplication | Partial; correctness risk | Search results deduplicate exact OSM object IDs. Checked-in add RPC instead restores/matches case-insensitive name alone, which can conflate chain locations. No location-aware matching workflow or concurrency-safe location identity is evident. Verify deployed RPC before implementation. | `findNearby`; `database.sql` `gw_add_restaurant` |
| Logos | Implemented, best effort | Known-brand website favicons, custom HTTPS images, website icons, 15 SVG fallbacks, preview/editing. These are not a reliable full-size logo catalog. | `logos.js`; `sql/restaurant_visuals.sql` |
| Restaurant photos, ratings, hours | Missing as structured features | Custom image slot could show a photo but is styled as a logo. No licensed photo collection, review score feed, or trusted “open now.” | `logos.js`, restaurant schema and rendering |
| Cuisine and distance filters | Implemented | Cuisine themes replace shortlist with matching saved places; name/category/town search; straight-line sorting and 5/10/20-mile limits when coordinates exist; unknown-coordinate handling. Not per-member tastes. | `family.js` `cuisines`, `matchesCuisine`; `app.js` `pollChoices`, `chooseCuisine` |
| Poll creation | Implemented | Four steps, Lunch/Dinner, 2–20 restaurants, 1–20 selected members, Pick 5, select all, review, method practice, explicit settings. No general repeat-poll draft shortcut. | `renderCreate`, `stepReady`, `makePoll` |
| Approval | Implemented | Choose one or two; most approvals wins. This is capped approval, not unrestricted approval voting. | `renderPoll`; `voting.js` |
| Swipe/consensus | Implemented, interaction refinement useful | Yes/no buttons and touch-end horizontal gesture; answer count, progress, back button, explicit submission. No drag-following card feedback. Highest yes count wins; unanimity is not required. | `renderPoll`, touch handlers, `voteSwipe`; `voting.js` |
| Ranked choice | Implemented | UI requires `min(3, option count)` distinct ranks; instant runoff eliminates equally lowest candidates together. README's “up to three” wording is looser than the actual UI. | `rankReady`, `renderPoll`; `voting.js` |
| Vote reliability | Implemented with limits | Pending controls, preserved form drafts/focus, personal-link ballot editing, hidden-until-finished results, tab-hidden refresh pause. Session write lock is not server request idempotency. | `syncPendingUI`, `renderKeepingFocus`, `openPoll`; `sql/member_ballot_read.sql` |
| Results and ties | Implemented; all-no gap | Bars, winner/address/Maps link, ranked explanations, runoff, immutable server random draw, restrained highlights, once-per-session celebration, organizer result image. No new winner-animation project needed. | `renderResults`, `makeResultsCard`; `family.js`; `sql/random_tiebreaker.sql` |
| History | Implemented, limited | Past polls/results and confirmed deletion. Some family payload definitions return a bounded latest-20 list; not a complete meal log. Deletion must remain intentional. | `renderHistory`; `sql/restaurant_visuals.sql`, `sql/voting_experience.sql` |
| Avatars | Implemented | Emoji or compressed JPEG profile photo; contacts organizer-only. No need to recommend avatars as new. | `readAvatar`, `memberEditor`; `sql/member_profiles.sql` |
| Personalization | Partial | Saved family places and cuisine themes exist. Per-member favorites, cuisine preferences, dietary notes, dislikes, hard vetoes, and recommendation explanations do not. | `family.js`; member/restaurant schema |
| Recent meals, rotation, statistics | Missing | Winning history exists, actual visits do not. General organizer statistics explicitly deferred in `AGENTS.md`; do not quietly reintroduce a dashboard. | `AGENTS.md`; poll/history implementation |
| Installable mobile app | Implemented, online only | Manifest, Apple icon, installation help, safe-area bars, 16px mobile inputs, touch targets, reduced-motion rules. No offline ballot queue, service worker, or background push. | `index.html`, `manifest.webmanifest`, `styles.css`, installation tests |
| Backend and deployment | Implemented; schema reproducibility partial | Static no-build GitHub Pages, raw fetch to Supabase token-guarded RPCs, RLS tables, tests in Actions. Historical baseline omits subsequent upgrades; README includes an outdated fresh-install sequence. Applied-state statements come from repository guidance, not a live schema audit. | `AGENTS.md`, `README.md`, `database.sql`, `sql/`, `.github/workflows/verify.yml` |

## Competitive feature matrix

“Not verified” must not be read as “competitor lacks this.” Design strengths are judgments about the inspected surface, not usability-study scores.

| Competitor | Notable features and access | Design strengths | Weaknesses / limitations | Goodnights already has | What to learn | Sources |
|---|---|---|---|---|---|---|
| **PlatePoll** | **C:** household yes/no voting, iCloud sync, restaurant/recipe/solo paths. **O:** launch waitlist. Pro landing price $14.99/month or $79.99/year; free limits U. | **O/I:** cream/green palette, strong typographic hierarchy, concise three-step story. | Installed Apple app required per FAQ; actual app untested. Terms show $79/year, conflicting with landing price. | Shared family voting, swipe mode, recognizable family branding. | Borrow clear starting choices and restrained hierarchy; defer recipes. | [Site](https://platepoll.com/), [terms](https://platepoll.com/terms/) |
| **Dinnduh** | **C:** asynchronous yes/no/maybe, runner-ups, dietary filters, contacts, reminders. Free: 4 sessions/month, 3 friends, 10 options; paid $5.99/$12.99 monthly. | **O/I:** illustrative ballot surfaces choice progress and compatibility near the restaurant. | **O:** host signup asks for phone verification, with email alternative. Live voting untested; “maybe” weight U. Paid location/AI tiers add complexity. | Browser voting, invited members, contacts/drafts, status, results. | Make constraints visible before shortlisting, without claiming allergen safety. | [Welcome](https://www.dinnduh.com/welcome), [plans](https://www.dinnduh.com/benefits), [help](https://www.dinnduh.com/help), [signup](https://www.dinnduh.com/sign-up) |
| **DineVote** | **C, stale indexed page:** session codes; nearby discovery or each person nominating up to three; cuisine/travel preferences; top-picks or elimination modes; timer and anonymous-vote controls. Price U. | **I from indexed form:** naming the selection strategy upfront could reduce organizer effort. Visual polish U. | Direct access failed; no current UI, accuracy, persistence, or operational state verified. | Shared voting, shortlists, cuisine/distance filters, runoff. | Consider nominations later; do not copy an unverified algorithm. | [Indexed official homepage](https://dinevote.com/) |
| **TableVote** | **O:** name/ZIP/radius setup; category filters Pro at $1.99/month, All Restaurants free. **C:** code joining, Google details, group sync/chat, four-hour session expiry. | **O/I:** narrow, calm form; clear location alternative; visible radius value. | No end-to-end session tested. Temporary sessions offer less family continuity; advertised speed unmeasured. | Link joining, participation status, Maps links, swipe voting. | Borrow compact setup; preserve saved family data and free filters. | [Site](https://tablevote.app/), [app and Pro dialog](https://tablevote.app/app) |
| **DinePoll** | **O:** manual names first, optional occasion, separate location/cuisine discovery path labeled Yelp. Free 3 polls/month; Plus $1.99/month after 7-day trial. **C:** organizer confirms final choice. | **O/I:** one dominant task, bottom navigation, progressive disclosure, clear disabled-action guidance. | Actual search and voting untested; manual entry cannot establish accurate hours or dietary suitability. | Custom lists, group links, results, tie handling. | Faster reviewable drafts; distinguish leading option, confirmed plan, and actual meal. | [New poll](https://dinepoll.com/new-poll), [pricing](https://dinepoll.com/pricing), [guide](https://dinepoll.com/how-it-works) |
| **Chicken Tender** | **C:** nearby Bluetooth groups, mutual matches, undo, filters, favorites/private notes, detail links, random selection; free without subscription or in-app ads. | **O, published screenshots:** photo-led card with compact facts; details separated from voting; persistent undo/progress. | Native, nearby-group model differs from asynchronous family links. Pairing and match fairness untested. | Swipe/backtracking, shared saved places, progress, directions, random tie resolution. | Useful card facts and personal notes; do not copy location-independent chain favorites into location identity. | [Official site and screenshots](https://www.chickentenderapp.com/) |
| **Hangrily** | **C:** solo/couple/group, up to 10, preferences, photo/rating/price cards; trial and $4.99/month unlimited. | **I:** choosing context before voting may simplify setup. Visual quality U. | Exact matching, fallback, free trial limits, history U; speed claims untested. | Cuisine/distance filters, family group and solo-sized polls. | Simple context presets, not extra modes by default. | [Site](https://hangrily.app/) |
| **Where2Eat** | **C, App Store:** browser guest links, unanimous matches; premium cuisine/search/favorites/multi-match. $1.99 lifetime IAP listed. | **I from description:** collecting matches before final choice could preserve alternatives. Visual quality U. | Native host untested. Release notes say ads removed; listing still includes advertising metadata. Four ratings are weak evidence. | Browser participation, cuisine filters, saved places, runoff. | Explicit no-match recovery; retain asynchronous completion. | [Listing and release notes](https://apps.apple.com/us/app/where2eat-swipe-match/id6757765189) |
| **Fork the Vote** | **C:** free, one-phone offline pass-and-play; nominate three, review duplicates, optional single veto, drag ranking, lowest summed ranks wins. | **I:** clear stages give members input before voting. Visual quality U. | Not Goodnights' instant-runoff method despite “ranked-choice” label. Same-device social friction; real secrecy untested. | Ranked ballots, family voting, some duplicate checks. | Location review and later optional nominations; hard veto requires careful rules. | [App Store](https://apps.apple.com/us/app/fork-the-vote/id6761288326) |
| **Tine** | **C:** event invitations, swipe discovery, tailored lists; Team Mode adds saved lists and roles. Free with team IAPs $49.99/$99.99 monthly. | **I:** event context can help form a shortlist. Visual quality U. | Family free limits and voting algorithm U. Displayed reviews include older releases; no native flow tested. | Named participants, saved list, poll history, vote editing. | Optional dinner context; skip organizational roles for one household. | [Listing, updates, reviews](https://apps.apple.com/us/app/tine-group-dining-planner/id1464574308) |
| **Ready to Echo** | **C:** saved places/notes, shared spaces, link extraction, majority activity votes. Free 8 saves; $4.99 one-time pass; Pro $1.99/month or $12.99/year; family $9.99 first year then $2.99/month. | **I:** separating “want to try” from visited places is useful. Actual UI U. | Trip workspace exceeds dinner scope; extraction accuracy and platform permissions untested. | Shared places, Maps navigation, votes. | Capture why a place was saved; separate meals from poll history. | [Features and pricing](https://readytoecho.com/) |

### Primary competitors: practical interpretation

**PlatePoll — attractive positioning, limited product evidence.** The observed page presents a cohesive family story and household imagery. That is branding evidence, not evidence of successful household onboarding or live synchronization. The older terms and current landing price disagree; the annual price requires checkout verification. Its terms explicitly qualify third-party restaurant information as potentially incomplete or outdated. Goodnights should retain warm dinner language, but avoid expanding into recipes merely to match a prelaunch proposition. [Landing](https://platepoll.com/), [terms](https://platepoll.com/terms/)

**Dinnduh — useful constraints, more account and plan overhead.** The plans table makes dietary filtering and compatibility badges available across tiers while reserving geographic midpoint and driving-time optimization for paid tiers. That is a strong reason to consider explicit family needs, not to implement paid routing. The help answer describes a most-votes winner but does not explain “maybe” weights, tied totals, or guarantees of consensus. The illustrated ballot's busy banners are a caution: Goodnights should keep guidance adjacent to the action without adding stacked promotional or status strips. The signup inspection stopped before any personal data or account creation. [Plans](https://www.dinnduh.com/benefits), [help](https://www.dinnduh.com/help), [signup](https://www.dinnduh.com/sign-up)

**DineVote — potentially useful nomination model, low confidence.** The cached form suggests involving people in candidate selection, not just voting. That could reduce organizer bias. It also asks participants for several preferences, which may increase coordination time. Both are design inferences from a stale indexed page. Availability must be rechecked before using it as an interaction benchmark. [Official URL](https://dinevote.com/)

**TableVote — very clear front door; limited continuity.** Observed creation uses one primary action and a location fallback. Its public promise of agreement does not disclose what happens if no restaurant receives unanimous support. Session expiry is suitable for an outing but is a poor fit for Goodnights' history and reusable family identities. The free-versus-Pro boundary was directly visible, including its price; no purchase was made. [App](https://tablevote.app/app), [site](https://tablevote.app/)

**DinePoll — strongest directly observed simplification reference.** The current browser first offered adding restaurant names, with occasion details collapsed and discovery a secondary action. Switching to discovery revealed an explicit three-step progress indicator, area combobox, and cuisine/occasion field. This differs from older indexed copy emphasizing discovery first. Goodnights already knows the family's people and restaurants, so a repeat-dinner draft can be even shorter. DinePoll's guide distinguishes a result from an organizer-confirmed destination; a confirmation does not book a table or prove a visit. [New poll](https://dinepoll.com/new-poll), [how it works](https://dinepoll.com/how-it-works), [planning template](https://dinepoll.com/group-restaurant-shortlist-template)

### Cross-product UX coverage

| UX dimension | Evidence and implication |
|---|---|
| Onboarding / joining | Browser guest participation is increasingly common; installation-free entry is not unique. Goodnights' reusable family identity is more valuable than adding another code. Its welcome should emphasize reconnecting to this existing family. |
| Discovery / search | Rich feeds are attractive but introduce data and service dependencies. Keep local-first filtering, show locality clearly, and label incomplete data. No competitor's result accuracy was independently tested. |
| Photos / logos / details | Chicken Tender's published cards make facts available without leaving the vote. Goodnights can immediately show existing addresses and Maps actions without purchasing photos or ratings. |
| Swipe / animation | Actual Goodnights buttons, progress and backtracking already work in practice. Add tactile feedback, not more celebration. Competitor gesture smoothness was not measured. |
| Methods / fairness | “Consensus” can mean unanimity, most approvals, weighted likes, or a majority threshold. Goodnights should explain its capped approval and truncated instant-runoff rules in plain language; do not silently replace them with rank sums or first-match stopping. |
| Results / participation | Goodnights already shows waiting/voted members privately and has saved tie resolution. Preserve hidden ballots until completion; displaying popularity during voting can influence later voters. |
| Preferences / favorites | Shared saved restaurants are already present. Member favorites, constraints, and notes would add a distinct layer; current cuisine filters are not persistent preferences. |
| History / repeat avoidance | Competitor claims did not establish a robust family visit-history model. This is an opportunity inferred from the family use case, not a claim of category uniqueness. TableVote's expiry explicitly favors temporary use. |
| Mobile / speed | Observed desktop and responsive browser screens support qualitative comparisons only. No timed multi-person study, network benchmark, or physical-device competitor test was conducted. |
| Free / paid | Goodnights can keep core family decisions free. Several competitors charge for frequency, filtering, or personalization. Chicken Tender is a claimed free counterexample, so “all competitors charge” would be false. |

## Goodnights UX assessment

### What works well

- The cream, coral, rounded type, and plate/heart mark already form a recognizable identity. Keep them.
- Saved family restaurants avoid repeated search and preserve family knowledge.
- Personal links and optional group selection accommodate both private identities and easy group-chat entry.
- The four-step organizer flow has explicit counts and review. Voters see method instructions, disabled-action explanations, and saved-vote acknowledgement.
- The source anticipates real mobile problems: large inputs, safe-area padding, reduced motion, preserved native-select focus, image fallbacks, and refresh coordination.
- Results already answer “who won?” and “how do we get there?” and can be shared without exposing personal invitation tokens.

### Most important issues

| Finding | Evidence and severity | Recommendation |
|---|---|---|
| All-no choices appear as tied winners | **O, high:** local practice voted no on three options and showed a three-way tie at 0%. Direct `tally()` evaluation with two all-no ballots did the same. SQL random draw only requires tied leaders, not positive support. Live RPC behavior not exercised. | Dedicated no-acceptable-option result; preserve ballots, offer a new shortlist, block new random resolution of zero-support ties. |
| Two locations can collapse on save | **O code / I consequence, high:** OSM keeps distinct object IDs, but baseline add RPC compares only `lower(name)`. No replacement definition was found in the inspected additive SQL. | Verify live definition later, then use family + OSM identity or explicit name/address matching; never merge historical restaurant IDs automatically. |
| Contrast is insufficient in common tokens | **O calculation, high:** white on `#f66f40` ≈ 2.89:1; `#7b786f` on `#fffefa` ≈ 4.37:1. These do not meet 4.5:1 for ordinary active text. Not a full accessibility audit. | Darker action color or dark text; stronger secondary text. Check computed combinations, focus, errors, and enabled controls. [WCAG guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) |
| Setup spends scarce vertical space before restaurants | **O, medium:** at 390×844, two-row organizer navigation, heading, steps, meal selector and filters push initial options below the first screen. | Compact heading/nav; collapse optional location filters; preserve selected counts and primary action. Validate with family use, not only screenshots. |
| Ballots omit existing useful location details | **O source, medium:** approval/swipe primarily show name and category; address appears in organizer lists/results. | Consistent name, cuisine, address/locality and optional details action across methods. Distinguish branches without relying on a logo. |
| Repeat dinner requires rebuilding setup | **O source, medium:** runoffs reuse tied leaders, but no general repeat-draft action. | Repeat a past dinner into editable Review, revalidate people/places, then create a new poll. |
| History cannot support truthful visit rotation | **O schema, medium:** polls/ballots exist, confirmed meal events do not. | Explicit “We ate here” and editable date; never label a poll win “last visited.” |
| Search capabilities and limits are hard to infer | **O source, medium:** separate saved filtering, OSM query and Maps paste; short Maps URLs cannot resolve themselves; OSM address gaps. | Label local versus online search, expose a useful no-result/manual path, add location review before saving. |
| Operational setup instructions lag the code | **O docs, medium:** README fresh setup says run baseline, while AGENTS warns that the baseline is incomplete. | Reconcile documentation and a reproducible fresh-install procedure in a later approved maintenance change. Do not rerun baseline on production. |

Additional constraints: source SQL returns mutable restaurant details rather than a complete immutable presentation snapshot for each historical poll. Future edits/merges need a deliberate history policy. The analysis is not a full security audit; bearer-link authorization and group-picker impersonation limits are already documented and must remain visible.

## Data, pricing, licensing, and viable free alternatives

These are engineering constraints based on provider documentation, not a blanket legal clearance. Recheck terms before integration. **None of the following integrations was enabled.**

### Recommended default

Use family-entered facts and saved restaurants first; keep explicit OSM search with attribution and an immediate manual fallback; open Maps for current hours, menus, ratings and navigation. Do not silently import third-party reviews, photos, or listing databases.

| Option | Verified constraints / practical consequence | Decision |
|---|---|---|
| Public Nominatim | Maximum **1 request/second across the application**, identifying Referer/User-Agent, attribution, caching, provider-switch capability. Public autocomplete is prohibited. No confidential data should be submitted. Current local caching helps but does not enforce an aggregate multi-device limit. [Policy](https://operations.osmfoundation.org/policies/nominatim/) | Keep optional deliberate searches only. Add autocomplete over loaded family entries, not network geocoding. If online usage expands, use a bounded shared gateway or a separately verified provider; do not imply client debounce ensures aggregate compliance. |
| Overpass / OSM | Community coverage and public service availability vary. Preserve OSM attribution and ODbL obligations; substantial published derived databases need license review. Search calls should be bounded, user initiated, cached appropriately, and tolerant of failure. [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API), [license](https://www.openstreetmap.org/copyright) | Keep current small-family discovery. Do not offer mass background harvesting, endpoint hopping to evade limits, or an accuracy guarantee. |
| Google Maps URLs | Normal Maps URLs require no API key and support search/directions. A link is not a data API. [Documentation](https://developers.google.com/maps/documentation/urls/get-started) | Retain. Let users confirm their own entry; no scraping, short-link scraping proxy, or automatic import of reviews/photos. |
| Google Places (New) | Billing and key required; fields determine charged SKU. Per-SKU monthly free caps do not mean the application is free of billing risk. [Usage](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing), [pricing](https://developers.google.com/maps/billing-and-pricing/pricing) | Defer under the no-paid-API constraint. If reconsidered, require explicit billing approval, field masks, restricted credentials, enforceable quotas, abuse controls, and usage monitoring. |
| Google Places storage and attribution | Content caching/storage restricted except allowed exceptions; place IDs may be stored. Display appropriate Google Maps attribution even off-map, plus supplied author/provider attribution. Google data on a map requires a Google Map. Public terms/privacy documents required. [Policies](https://developers.google.com/maps/documentation/places/web-service/policies) | Do not persist Google ratings/details/photos as the permanent family catalog or mix them into OSM maps. |
| Google photos | Photo names can expire and cannot be cached; obtain current names through documented APIs and display supplied attribution. [Photo documentation](https://developers.google.com/maps/documentation/places/web-service/place-photos) | Do not store photo endpoints as evergreen custom-logo URLs or copy images into the repository. |
| Existing Google favicon endpoint | `logos.js` uses `google.com/s2/favicons`. No supported restaurant-logo API contract, usage allowance, or redistribution license was verified. | Treat as optional best effort only, with existing SVG fallback. Do not expand it into a core image dependency. |
| Logo.dev | Community plan currently offers 500,000 monthly CDN requests, $5 monthly API credits, no credit card, and a hard CDN stop. Commercial free use requires attribution; personal projects are exempt under its current guide. CDN images and API-returned assets have different hosting rules. [Pricing](https://www.logo.dev/pricing), [attribution](https://www.logo.dev/docs/platform/attribution) | Possible optional future provider, not needed next sprint. CDN allowance is not unlimited search/API usage. Confirm terms, origin restrictions and trademark use; preserve fallback and avoid secret API keys in Pages. |
| Family/restaurant-supplied photos | Rights must be owned or explicitly granted for the intended use. A publicly accessible image URL is not permission to redistribute it. Wikimedia assets require individual license/credit review. [Commons reuse](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) | Best eventual photo source: a few approved images with provenance, resized client-side, and optional loading. Do not use generic food images as photographs of a specific restaurant. |
| Supabase Free | Published allowances include 500 MB DB, 1 GB file storage, 5 GB egress plus 5 GB cached egress; projects may pause after one inactive week. Automatic backups and image transformations are not in Free. [Pricing](https://supabase.com/pricing) | Existing family scale is plausible, not a measured capacity guarantee. Keep compact RPC payloads and client compression; plan a private export before approved migrations. Do not add automated keepalive traffic just to defeat pausing. |
| GitHub Pages | Static hosting; published limits include 1 GB site size and soft 100 GB monthly bandwidth. [Limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) | Keep static assets lean. Any future secret-bearing provider integration belongs in a controlled backend, never bundled JavaScript. |

Selected Google pricing, as displayed October 20, 2026; rates are **per 1,000 billable events in the first paid volume band**, after the monthly free cap:

| SKU | Monthly free cap | First paid rate |
|---|---:|---:|
| Autocomplete Requests | 10,000 | $2.83 |
| Place Details Essentials | 10,000 | $5.00 |
| Place Details Pro | 5,000 | $17.00 |
| Nearby Search Pro / Text Search Pro | 5,000 each | $32.00 |
| Place Details Enterprise | 1,000 | $20.00 |
| Place Details Photos | 1,000 | $7.00 |

Do not assume names, ratings, hours and photos all fit one inexpensive lookup; requested fields and separate image calls affect the charge. As an illustrative calculation, 3,600 photo calls alone exceed a 1,000-event cap by 2,600, or $18.20 at $7/1,000, before other SKUs. These prices come from the [current pricing table](https://developers.google.com/maps/billing-and-pricing/pricing), not the discontinued generic monthly-credit model.

## Visual design direction

Keep the Goodnights brand and improve its consistency. These are proposed changes, not implemented mockups.

| Surface | Specific direction | Inspiration / rationale |
|---|---|---|
| Color and type | Keep cream/coral identity, use a darker accessible action token, strengthen muted text. Retain system fonts; use 16px body/input text and a restrained heading scale. | Existing brand; measured contrast issue. No font download needed. |
| Navigation | Trial four compact organizer destinations: Home, Places, Votes, Family; New vote remains the primary Home/Votes action. Test against the current labels before changing them. Avoid adding a second fixed bottom bar over ballot actions. | DinePoll's compact navigation; current two-row mobile navigation. |
| Restaurant card | 48px contained logo; clear name, cuisine and locality/address; details button outside the selection label. Distinct states for selected, unavailable, and incomplete address. Never invent star ratings. | Chicken Tender's published fact hierarchy. |
| Swipe card | Short top line “2 of 5 answered”; restaurant/locality; explicit no/yes buttons. Short transform/opacity feedback; clear backtracking and final review. Respect vertical scrolling, reduced motion and keyboard access. | Existing Goodnights behavior, with the card clarity seen in competitor illustrations. |
| Setup | Keep four-step guided flow for new users; repeat-draft entry lands on Review. Fold optional filters into a disclosure. Keep counts and hidden selections visible. | DinePoll progressive disclosure; family repetition. |
| Results | Winner, truthful support, location and Maps first. Distinct positive tie/no-choice panels. Retain current one-time celebration and at most one meaningful highlight. | Existing strengths; avoid equating plurality with unanimity. |
| Empty/error states | Explain exactly what to do next: add two places, connect a personal link, broaden a filter, or use manual entry when a public service is busy. Keep drafts. | Recovery should end in an action, not a dead end. |
| Icons and spacing | Small in-repo SVG navigation/action set; keep emoji for cuisine and celebration. Reuse spacing steps of 4/8/12/16/24/32px and consistent corner sizes. | Stable rendering across phones without an icon-library dependency. |
| Images | Preserve SVG fallback, intrinsic size, lazy loading, no-referrer for external images, and safe canvas fallback. Future photos are optional and creditable. | Fast, recognizable cards even when an image host fails. |

## What not to build now

Do not rebuild avatars, favorites-as-a-shared-list, live participation status, cuisine filters, practice voting, group invitations, random ties, result sharing, or installation support: they already exist. Do not add in-app chat when the family uses Messages. Defer recipe planning, native apps, AI recommendations, driving-time midpoint optimization, automatic SMS, public social profiles, and generalized statistics. Web Push is a separate future infrastructure project, not a side effect of installation.

The user-requested statistics idea is recorded as a future candidate, but `AGENTS.md` asks to defer an organizer statistics page until more data exists. The proposed small meal log is useful input for rotation and does not require such a dashboard.

## Source register

All links were consulted or attempted on October 20, 2026. Failed access and the extent of UI testing are recorded above.

- PlatePoll: [home / FAQ / pricing](https://platepoll.com/), [terms](https://platepoll.com/terms/).
- Dinnduh: [welcome](https://www.dinnduh.com/welcome), [signup](https://www.dinnduh.com/sign-up), [plans](https://www.dinnduh.com/benefits), [help](https://www.dinnduh.com/help).
- DineVote: [official homepage](https://dinevote.com/) — indexed evidence only; direct access failed.
- TableVote: [home](https://tablevote.app/), [app](https://tablevote.app/app).
- DinePoll: [home](https://dinepoll.com/), [new poll](https://dinepoll.com/new-poll), [pricing](https://dinepoll.com/pricing), [how it works](https://dinepoll.com/how-it-works), [shortlist template](https://dinepoll.com/group-restaurant-shortlist-template).
- Additional products: [Chicken Tender](https://www.chickentenderapp.com/), [Hangrily](https://hangrily.app/), [Where2Eat](https://apps.apple.com/us/app/where2eat-swipe-match/id6757765189), [Fork the Vote](https://apps.apple.com/us/app/fork-the-vote/id6761288326), [Tine](https://apps.apple.com/us/app/tine-group-dining-planner/id1464574308), [Ready to Echo](https://readytoecho.com/).
- Provider and accessibility references are linked beside their claims in the constraints/design sections.
- Goodnights: [repository](https://github.com/jacobmgoodnight/goodnights-whats-for-dinner), [public app](https://jacobmgoodnight.github.io/goodnights-whats-for-dinner/), [instructions](../AGENTS.md), [README](../README.md), [UI](../app.js), [tallies](../voting.js), [family helpers](../family.js), [Maps parser](../maps.js), [logos](../logos.js), [styles](../styles.css), [baseline SQL](../database.sql), [additive SQL](../sql/).
