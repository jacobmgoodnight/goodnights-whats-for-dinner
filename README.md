# Goodnights, What's for Dinner? 🍽️

A free, mobile-first restaurant voting app for the Goodnight family. No framework, no build commands, no advertising, no accounts for voters.

## What this version does

- Maintain your own family restaurant list. Add any restaurant manually, or optionally find restaurants near a town or current location through public OpenStreetMap services.
- Create **Lunch** or **Dinner** polls (2–20 restaurants; 1–20 expected voters).
- Choose from **Approval** (pick up to 2), **Swipe/Consensus** (yes/no for each), and **Ranked choice** (rank top 3; instant-runoff tally).
- Send an unguessable voting link so each family member can vote from their own phone. Voters type a name instead of creating an account.
- Hide the results until all expected votes arrive or someone with the family link closes the vote early. View history, and run a follow-up vote when there's a tie.
- Install as a web app on a phone through the browser's Add to Home Screen option.

**Important:** Cross-device voting requires the free Supabase database. Until configured, the app runs as a one-browser demo and cannot exchange votes between devices. The included starting restaurant names are illustrative, not verified nearby businesses.

## A. Try the demo first

Open `index.html` in a modern desktop browser. With an empty `config.js`, the app automatically runs as a **local demo**. You can add restaurants, create polls, vote and see a winner on that device. Its data is saved in that browser's local storage. On mobile phones, host the files using the GitHub Pages instructions below for the best experience.

## B. Enable real shared family voting (free)

**1. Create a Supabase project:** Go to [Supabase](https://supabase.com/dashboard), create a free project, then open **SQL Editor → New query**. Paste in `database.sql` and run the whole script. This creates database tables, voting rules, and limited-access functions. The free project is intended for a single family and rejects creation of additional households.

**2. Set the two public configuration values:** Go to your Supabase project's **Connect** screen or **Settings → API Keys**, copy its project URL and **publishable** key (starts `sb_publishable_`), and paste into `config.js`:

```javascript
window.GW_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  publishableKey: "sb_publishable_YOUR_PUBLIC_KEY"
};
```

**Never paste a `sb_secret_` key or `service_role` key into the website**; those would provide privileged access. The publishable key is designed to be visible in browser code. The SQL layer prevents direct browsing of the family tables.

**3. Publish the files to GitHub Pages:** Make a new **public** GitHub repository at https://github.com/new, e.g. `goodnights-whats-for-dinner`. Upload the individual contents of this folder to the top-level of the repo (so `index.html` is at the root). Under **Settings → Pages**, set **Source: Deploy from a branch**, select **main** and **/(root)**, then Save. Your site will have a URL like `https://jacobmgoodnight.github.io/goodnights-whats-for-dinner/` if you choose that repository name. Public GitHub Pages hosting is available on GitHub Free.

**4. Create your household:** Visit the live website, select **Create our family**, give it a name, and immediately save/share the **family invite link** from the home screen. Each family member can use that link to access your restaurant list; a poll's **vote link** can be sent separately to voters. After everyone votes, the result appears automatically (the app checks about every 8 seconds).

*Note:* Supabase free projects can pause after a week of low activity. If this happens, log into your Supabase Dashboard and resume it. No recurring charges are needed within the services' free allowances, though service limits can change.

## Restaurant search / OpenStreetMap

The **Restaurants → + Add** screen includes a manual entry form and optional free location search. Search near **New Palestine, Indiana** or allow location access on your phone. It sends one user-initiated geocode request to Nominatim, then searches a ~6-mile (10-km) radius with Overpass. Public OSM data may be incomplete and public servers can be slow, rate-limited, or unavailable. Restaurants may not have complete addresses; hours and driving times are not provided. Results use straight-line distances. Manual entry is always available. Data © OpenStreetMap contributors under ODbL.

## How voting works

- **Approval:** One or two approvals per person. The restaurant with the most approval votes wins.
- **Consensus:** Every person responds yes/no to every option. With everyone voting on the same options, the most yes votes also gives the highest approval percentage.
- **Ranked:** Each person ranks up to three choices. The app counts first choices and eliminates a lowest-scoring candidate per round, transferring preferences when possible. A remaining unresolved tie gets a fresh runoff instead of a random winner.
- **Tie:** If multiple candidates remain tied, the family organizer can launch a new ranked-choice poll between those candidates.

## Security and privacy

This is a **trusted-family game**, not an authenticated election. Invite links are randomly generated, but possession of the family link permits adding/removing restaurants and closing polls. A poll link allows someone to submit a named vote, and a voter could use another name or submit multiple names. Links could be forwarded. Do not put sensitive personal information in poll names or the restaurant list.

The website's source code is public on free GitHub Pages. The family database is not publicly listed: direct table access is blocked; all access is via narrowly-scoped SQL functions. The Supabase publishable key can safely appear in client code *with these database permissions*. Share only the family or poll links with your family.

For more rigorous identity verification, strong abuse protection, or a larger public app, we'd add user authentication and dedicated policies.

## Project contents

| File | Purpose |
|---|---|
| `index.html`, `styles.css`, `app.js` | Responsive browser UI and app behavior |
| `voting.js` | Vote tallies and instant-runoff algorithm |
| `database.sql` | Supabase tables, row-level-security, access-limited RPC functions |
| `config.js` | Public Supabase project URL and publishable key (empty = demo) |
| `icon.svg`, `manifest.webmanifest` | App icon and phone home-screen metadata |
| `tests/voting.test.js`, `tests/app-smoke.test.js` | Vote counting and UI smoke tests; run both with Node.js |

No `npm install` or JavaScript build system is required.

## Useful links

- [GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Supabase API key guidance](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase free plan / pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Overpass API limitations](https://wiki.openstreetmap.org/wiki/Overpass_API)
