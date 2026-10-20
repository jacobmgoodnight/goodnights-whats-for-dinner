# H4: location-aware restaurant saving

Status: implemented for review; production migration **not applied**.

Manual, pasted Maps and OSM additions now open a name/address review before saving. Suggestions beside the name fields use only already-loaded active saved restaurants. Typing never invokes Nominatim, Overpass, Google or a new RPC. Online discovery still requires its existing search button.

## Identity and recovery

- An exact canonical OSM object (`node/…`, `way/…`, `relation/…`) identifies a saved row within the family, including an archived row. Source identity takes precedence over an upstream name/address change. A retry/restore never overwrites saved metadata, coordinates or visuals.
- Manual matching requires both a normalized name and a **non-empty** normalized address. Normalization folds ASCII case and whitespace, preserving punctuation and accents. Loose punctuation matching suggests review only. Different addresses remain separate locations, even for the same chain name.
- Different OSM node/way identities, same-name entries, same-address entries, and missing manual addresses are uncertain. Coordinates alone never prove identity. The organizer can use a saved row, edit an active saved row, or explicitly keep a separate location. Multiple exact name/address matches require choosing a saved row or editing the incoming address; the app never picks an arbitrary historical ID.
- The server includes hidden records in review, even though the family reader supplies only active records. A stale review must acknowledge newly discovered candidate IDs before creating separately. Exact identity retries still reuse the same ID. Missing-address entries may intentionally remain separate after explicit review; no name-only unique constraint is added.
- Choosing a saved location preserves its name, address, category, visual settings and historical references. New-row appearance validation happens in the same transaction as insertion; a failed logo validation leaves no partial new restaurant.
- Confirmed address edits retain the existing ID and poll references, but clear its OSM identity and coordinates to prevent stale distance/source data. A distinct branch should be added separately. Canceling the confirmation leaves the row unchanged.
- Read/search/save failures preserve entered details and the review for retry. The new UI never falls back to the old unsafe RPC when the migration is unavailable.

## Read-only deployed inspection

On October 20, 2026, inspected the deployed `gw_add_restaurant`, `gw_update_restaurant`, archive/family readers, indexes and constraints on project `rwqclcpmtuebxndadkxv`. The database reported PostgreSQL **17.11**. The add RPC used name-only matching and `ORDER BY active DESC LIMIT 1`, confirming the branch-collapse risk. Existing indexes were the restaurant primary key and family index; no location identity index existed. The update RPC retained coordinates/source identity when changing an address.

Aggregate read-only checks found **0 duplicate OSM groups**, **0 exact non-empty normalized name/address groups**, and **0 legacy source IDs outside the accepted OSM format** under the checked normalization. This is a point-in-time preflight, not proof that past name-only saves never conflated places. No family records, addresses, tokens or row IDs were copied into commits or fixtures. H4 does not infer missing historical branches or rewrite past polls.

[sql/location_identity_audit.sql](../sql/location_identity_audit.sql) is the read-only owner/operator report for duplicate sources, duplicate manual identities, missing addresses and legacy source IDs. Run it privately immediately before an approved migration; do not commit its output. Do not merge/delete records to make the migration pass without separate owner direction.

## Proposed migration and deployment order

1. Back up privately, verify the deployed visual upgrade and RPCs, and run the audit on an approved staging copy. Review any duplicate groups without changing IDs or poll references automatically.
2. Rehearse [20261020191956_location_aware_restaurant_saving.sql](../supabase/migrations/20261020191956_location_aware_restaurant_saving.sql). It locks restaurant writes during preflight, refuses existing conflicting groups, creates family-scoped partial unique indexes for OSM identity and non-empty manual name/address, adds the token-guarded save RPC, and wraps the old add signature. No existing restaurant rows are rewritten. RLS/table grants stay unchanged; function grants are explicit and helper functions are not exposed to `PUBLIC`/API roles.
3. Only after separate production approval, apply the new migration transaction before releasing the matching static files. The old add signature safely reuses exact identities and rejects uncertain/missing-address additions instead of merging by name. Cached older clients may need to refresh to review/add a separate location. The UI requires the new RPC and fails without writing if it is unavailable.
4. Validate organizer manual/Maps/OSM additions, hidden restores, exact retries, separate chain locations and address-edit confirmation on synthetic staging data; then release through the normal reviewed Pages process. App/maps/CSS asset query versions are bumped together.
5. Retain the guard if rolling back the UI. Restoring the old name-only RPC reopens the bug. No ballot/restaurant-ID data rollback is necessary. Do not drop indexes or merge/delete data as an automatic rollback step.

The family row is locked before save/restore decisions, so concurrent saves see the first committed result. Unique indexes also guard writes through other paths. Existing active matches remain usable at the 250-active-place limit; a new insert/archived restore still respects it. The family size and bounded catalog keep the review query small.

## Verification

Baseline `node --test tests/*.test.js`: **63/63 passed**. Final suite: **73/73 passed**, including 10 H4 tests for identity, suggestions without requests, manual/Maps/OSM review, escaped input, stale/hidden matches, explicit saved IDs, failed save/search recovery, and member action guards. Existing voting, URL parser, link, image fallback and focus tests remain unchanged in behavior.

Real isolated PostgreSQL **17.10** (also initially checked on 18.4): migration and fixtures passed for separate branches, source-first/exact manual reuse, whitespace normalization, immutable metadata/IDs/ballots/poll references, archived restores, missing-address/ambiguous-source review, stale-review acknowledgment, old-client guard, unauthorized tokens, atomic visuals, coordinate clearing, unique-index enforcement, capacity, RLS/grants and duplicate-preflight refusal. Three genuine two-connection races (OSM duplicate, manual duplicate, archived restore) verified the second session waits on a database lock and returns the same ID after the first commits.

Headless Edge at 320px with intercepted synthetic demo fixtures verified local suggestions without requests, review focus/layout, separate branch creation, exact reuse, failed online-search draft retention, and confirmed/cancelled address edits. Physical phones, real screen readers, Supabase/PostgREST integration of the **unapplied** function, production advisors for the proposed schema, and a full replay of the deployed member/roster migration chain remain unverified. The SQL runner intentionally loads baseline plus the visual upgrade needed by H4; it does not reconstruct unrelated live features.

Normal tests need no install. Optional isolated integration tools can be installed outside this repository:

```powershell
npm install --prefix "$env:TEMP/gw-h4-tests" --no-save --package-lock=false embedded-postgres@17.10.0-beta.17 pg@8.23.1 playwright@1.62.1
$env:GW_PG_RUNTIME="$env:TEMP/gw-h4-tests/node_modules"
node tests/sql/location-saving.cjs
$env:GW_PLAYWRIGHT_MODULE="$env:TEMP/gw-h4-tests/node_modules/playwright"
node tests/browser/location-saving.cjs
```

The SQL runner creates a temporary database bound to `127.0.0.1`, uses fictional records and separate connections, and stops its server afterward. It accepts no production database URL. The browser runner uses installed Microsoft Edge and intercepts all network traffic; its intentional online-search failure is synthetic. No production migration, merge or deployment was performed.
