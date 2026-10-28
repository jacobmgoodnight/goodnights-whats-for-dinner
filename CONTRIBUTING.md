# Contributing

Read [AGENTS.md](AGENTS.md) and [SECURITY.md](SECURITY.md). Keep static GitHub Pages, vanilla JavaScript, stable personal links and existing voting rules. Prefer a small branch and PR per release. Never use real household data as fixtures or commit invitations, backups or service-role keys.

Run `node --test tests/*.test.js` on Node 22 or later. For optional browsers, install `playwright@1.62.1` outside the app, set `GW_PLAYWRIGHT_MODULE` to that installation and `GW_BROWSER_CHANNEL=chromium` (or use installed `msedge` by default), install its matching browser, and run the scripts in `tests/browser/`. CI runs synthetic intercepted fixtures; it needs no Supabase secrets. Physical-device acceptance remains [a manual check](docs/qa/mobile-checklist.md).

For SQL, rehearse the fresh installer and any additive migration in isolated PostgreSQL first. Do not push the historical migration directory to production. Include preflight, exact SQL, verification and non-destructive rollback in the PR. Approval to review a PR is not approval to alter production.

This repository currently has **no LICENSE**. Public visibility does not grant a general license to reuse or redistribute it. The maintainer must approve a license before one is added; the product review recommends considering MIT for straightforward permissive reuse. Third-party assets/data retain their own terms.
