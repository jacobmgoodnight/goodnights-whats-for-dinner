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
