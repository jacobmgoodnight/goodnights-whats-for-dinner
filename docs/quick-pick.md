# Quick Pick — release notes and next step

**Status:** frontend only. No database migration, new RPC, permission change or stored data. Safe to deploy through the normal Pages flow after review.

## What it does

- Organizer Home shows **⚡ Quick pick** next to **Start a family vote**. While a vote is open, Home keeps the Tonight card first and offers Quick Pick once, as an escape hatch.
- Personal members see **No vote? Quick pick a place** on their home screen. Group-invitation and one-time guests do not get Quick Pick, because they never receive the family library.
- One suggestion from the saved, active restaurants, with logo, category, address and **Open in Maps** (the existing name+address Google Maps search link, with no credentials in it).
- **Try another** walks through the list without repeating anything. **Show me 3** lists three side by side. At the end it says so and offers **Start over**.
- **What sounds good?** reuses the existing cuisine definitions (`family.js`). It updates results in place and never replaces the native select (iOS reopen rule).
- Organizers can turn the 2–3 options on screen into a normal vote: **Let the family vote on these 3** opens the existing create flow at step 1 with those places (and the chosen cuisine) preselected. Nothing is created until the usual Review → Create.

## Rules (keep these)

- `decisions.js` is pure: no requests, no storage, no meal records. Order is a daily FNV hash of `localDate + restaurant id`, so every phone sees the same order on the same day regardless of list order, and it reshuffles at local midnight. It is deterministic and testable; there is no hidden ranking or personalization, and the UI says so.
- Quick Pick never records a meal, creates a poll or changes a restaurant. The copy says "nothing is saved" and "opening hours aren't checked". Do not claim personalization or rotation until confirmed meal history exists.
- Hidden (`active:false`) and duplicate IDs are excluded.

## Verification

- `node --test tests/*.test.js`: 145/145 (136 existing + 9 new in `tests/quick-pick.test.js`).
- `tests/browser/quick-pick.cjs` (synthetic, intercepted, now in CI) at 320/390px: one tap from Home, Maps link without credentials, Try another keeps focus, in-place native select, three options, ≥44px targets, no horizontal scroll, editable vote draft, zero write RPCs. All existing browser journeys still pass locally in Edge.
- **Not yet done:** physical iPhone Safari / installed mode and Android checks (see [mobile checklist](qa/mobile-checklist.md)).

## Next: confirmed meal history (needs owner approval)

This is the data-dependent half of the held proposal on `codex/smarter-dinner-proposal-held-20261028`. That branch is **not** mergeable as-is: it predates one-time polls (#22) and mixes UI with SQL.

Proposed shape (unchanged from the reviewed proposal): one RLS table `gw_meals` (id, family_id, restaurant_id, `eaten_on DATE`, optional poll_id, created_at, unique per place/date) and three token-guarded RPCs: `gw_meal_history` (organizer or active personal member reads), `gw_save_meal` and `gw_delete_meal` (organizer only). No backfill: vote winners never become meals. The reviewed source is `supabase/migrations/20261028112638_confirmed_meals.sql` on the held branch (SHA-256 `f2451956…913c`).

Before asking for approval:

1. Re-read the deployed catalog and migration history (read-only) because production changed with `20261028231629_one_time_travel_polls`.
2. Decide how meals treat one-time polls and their inactive name-only restaurant rows. Recommended: allow `poll_id` from a one-time poll, but require the organizer to pick or save a real library place; never auto-link.
3. Rebase the migration and `tests/sql/confirmed-meals.cjs` onto current `main`, then rehearse in isolated PostgreSQL only.

**Approval needed from Jacob:** (a) the table/RPC design above, (b) taking a fresh private backup, (c) applying exactly one reviewed migration to production. Once meals exist, Quick Pick can add "Skip places we ate at in the last 2 weeks" and "Last eaten …" labels by passing a `lastEaten` map into `decisions.js`. No other Quick Pick change is needed.
