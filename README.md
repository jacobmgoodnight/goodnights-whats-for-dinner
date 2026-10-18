# Goodnights, What's for Dinner? 🍽️

A free, mobile-first restaurant voting app for the Goodnight family. No framework, no build commands, no advertising, no accounts for voters.

## What this version does

- Maintain your own family restaurant list. Add any restaurant manually, or optionally find restaurants near a town or current location through public OpenStreetMap services.
- Create **Lunch** or **Dinner** polls (2–20 restaurants; choose 1–20 participating family members).
- Choose from **Approval** (pick up to 2), **Swipe/Consensus** (yes/no for each), and **Ranked choice** (rank top 3; instant-runoff tally).
- Set up named family members in the **Members** tab. Each member has a reusable personal voting link; their ballots are associated with that member, not a name they type.
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

**4. Save the organizer link:** Keep the family invite link private: it permits restaurant and poll management. From **Members**, create a profile for each voter and share their separate personal link. A person's link can be reused for future polls and can be reset by the organizer. After everyone votes, results appear automatically (the app checks about every 8 seconds).

*Note:* Supabase free projects can pause after a week of low activity. If this happens, log into your Supabase Dashboard and resume it. No recurring charges are needed within the services' free allowances, though service limits can change.

## Restaurant search / OpenStreetMap

The **Restaurants** page shows free location search directly; **+ Add** reveals the manual entry form. Search near **New Palestine, Indiana** or allow location access on your phone. It sends one user-initiated geocode request to Nominatim, then searches a ~6-mile (10-km) radius with Overpass. Public OSM data may be incomplete and public servers can be slow, rate-limited, or unavailable. Restaurants may not have complete addresses; hours and driving times are not provided. Results use straight-line distances. Manual entry is always available. Data © OpenStreetMap contributors under ODbL.

## Google Maps fallback (no billing or API key)

On the **Restaurants** page, choose **Search Google Maps** to open an ordinary Google Maps search for the entered name and town. Copy the restaurant's name and address from Google Maps, then paste the lines into **Paste a Google Maps listing**. Choose **Use pasted details**, review or edit the name and address, and choose **Save to family restaurants**.

A long Google Maps URL containing `/maps/place/...` or a Maps search query can also fill the name. Short `maps.app.goo.gl` links do not contain readable place details, so type or paste the name as well. We do not scrape Google's API or need a billing account; the submitted name/address are saved using the app's existing Supabase restaurant function. Your own saved entries stay available for future votes.


## Restaurant logos and SVG icon customization

Open the app as the **family organizer**, go to **Restaurants**, and select **Edit** next to any saved restaurant. You can edit its name, category and address, then choose the logo style:

- **Automatic** — uses a recognizable favicon for known restaurant chains when available, otherwise an SVG food icon.
- **Custom logo image URL** — paste a publicly accessible direct **HTTPS** image link (PNG/JPG/WebP recommended); use **Preview logo** and **Save changes**.
- **Website icon** — paste a restaurant website such as \`https://www.culvers.com\`; the app retrieves a best-effort favicon from a free website icon endpoint.
- **Built-in SVG icon** — select a crisp food icon from the menu.

The same options are available when adding a restaurant manually or through the Google Maps copy/paste form. OpenStreetMap results can be customized after saving. If an external logo fails to load, the browser displays the SVG fallback. Automatic favicons may be smaller than full company logos; for a proper high-resolution restaurant logo, use a direct image URL supplied by the owner.

The database upgrade was applied to the live Supabase project on October 14, 2026 and recorded at \`sql/restaurant_visuals.sql\`. It adds \`gw_restaurants.icon_mode\`, \`icon_value\`, a token-checked \`gw_update_restaurant\` RPC and logo fields in \`gw_get_family\` and \`gw_get_poll\`. **Do not rerun the original \`database.sql\` on the live project**. It is a historical baseline and does not contain the newer member-link and logo migrations.

## Continue developing with Codex

Open https://chatgpt.com/codex and select \`jacobmgoodnight/goodnights-whats-for-dinner\` from connected GitHub repositories. Codex reads the project-level \`AGENTS.md\` for requirements and safeguards. Start with a reviewable branch/PR, run \`node --test tests/*.test.js\`, and test the GitHub Pages site using the owner/member flows before merging.

## How voting works

- **Approval:** One or two approvals per person. The restaurant with the most approval votes wins.
- **Consensus:** Every person responds yes/no to every option. With everyone voting on the same options, the most yes votes also gives the highest approval percentage.
- **Ranked:** Each person ranks up to three choices. The app counts first choices and eliminates a lowest-scoring candidate per round, transferring preferences when possible. A remaining unresolved tie gets a fresh runoff instead of a random winner.
- **Tie:** If multiple candidates remain tied, the family organizer can launch a new ranked-choice poll between those candidates.

## Security and privacy

This is a **trusted-family game**, not an authenticated election. Invite links are randomly generated. Possession of the organizer link permits managing restaurants, polls, and members. Each personal member link permits votes under that member's identity and can be reset if forwarded; do not share the organizer link with all voters. Do not put sensitive personal information in poll names or the restaurant list.

The website's source code is public on free GitHub Pages. The family database is not publicly listed: direct table access is blocked; all access is via narrowly-scoped SQL functions. The Supabase publishable key can safely appear in client code *with these database permissions*. Share the organizer link only with the organizer; share individual member links with their intended voters.

For more rigorous identity verification, strong abuse protection, or a larger public app, we'd add user authentication and dedicated policies.

## Project contents

| File | Purpose |
|---|---|
| `index.html`, `styles.css`, `app.js` | Responsive browser UI and app behavior |
| `voting.js` | Vote tallies and instant-runoff algorithm |
| `maps.js` | Free Google Maps deep link and pasted-place-text parser |
| `logos.js` | Brand favicons, custom HTTPS logo URLs, and SVG fallback icons |
| `sql/restaurant_visuals.sql` | Applied additive restaurant-visuals database upgrade |
| `AGENTS.md` | Repository guidance for Codex and security invariants |
| `database.sql` | Supabase tables, row-level-security, access-limited RPC functions |
| `config.js` | Public Supabase project URL and publishable key (empty = demo) |
| `icon.svg`, `manifest.webmanifest` | App icon and phone home-screen metadata |
| `tests/*.test.js` | Voting, UI smoke, Google Maps paste, and restaurant logo tests; run with `node --test tests/*.test.js` |

No `npm install` or JavaScript build system is required.

## Useful links

- [GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Supabase API key guidance](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase free plan / pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Overpass API limitations](https://wiki.openstreetmap.org/wiki/Overpass_API)

## Choosing and sharing a vote

On New vote, filter saved restaurants by name, category or town. Closest to me uses device location to sort restaurants with saved coordinates; optional 5, 10 and 20 mile limits use straight-line distance. Entries without coordinates are shown last without a distance limit, or can be found by their saved town/address. No location is saved to the database.

Tap a whole restaurant row, use Select all shown (up to 20), or Pick 5 for me. Filters preserve existing selections and show how many selected entries are hidden. Clear selection starts over.

After creating a vote, the organizer sees Invite family to this vote. Copy link or Send link next to a member includes that member’s personal link and the current poll. Send opens the device share sheet when supported, otherwise copies the link. Send each personal link only to its intended person.

## Practice voting, member photos, and text drafts

On **New vote**, choose a 🧪 preview beside the voting methods. Practice approval, consensus or ranked voting, submit the practice ballot, and see its results. These previews stay in your browser and never create polls or submit real ballots.

In **Members → Edit profile**, change a person's name, choose an emoji or upload a JPEG/PNG/WebP photo, and optionally save a phone number or iMessage email. Photos are cropped to 256×256 and compressed as clear JPEGs. Photos and names appear on that member's personal voting page. Phone numbers are returned only to the organizer, not to personal-link holders. Existing personal links stay the same.

Every open vote has individual invitations under **Invite family to this vote**. Expand a person to preview the message, **Text** them, **Share message** through the device share sheet, or copy the message/link. Personal invitations must go only to their intended person. After results arrive, the organizer can text/share a group-safe summary with the winner, stats and results link. **Make results image** creates a PNG announcement; save it, or share it directly when the browser supports file sharing. The image uses restaurant logos when cross-origin image loading is allowed and SVG food icons otherwise.

Text opens a message draft; the organizer reviews and sends it in their messaging app. No SMS service or automatic background texting is configured. SMS body handling varies by phone/app; **Copy message** is the fallback. Normal carrier SMS/MMS charges may apply. Rich images are shared as attachments rather than embedded in plain SMS. The website never marks a message as delivered.

`sql/member_profiles.sql` is the additive profiles upgrade applied to the live database. It preserves existing member tokens, RLS and token-checked RPCs. As with the other upgrades, do not rerun the historical database baseline on the live project.

## Reliable voting and member navigation

Organizers manage the family through Home, Restaurants, New vote, History and Members. Members see their own **My votes** dashboard and **Past results**, with their avatar, open polls and completed results. Finished polls are classified as results as soon as the expected number of votes arrives.

On an open poll, **Change my vote** restores only that member's saved choices. Edit and **Save vote changes**, or choose **Keep my saved vote** to cancel. Existing choices continue to count until the replacement is saved. Votes cannot be changed after voting finishes. `sql/member_ballot_read.sql` adds the token-checked own-ballot reader; it never returns another member's ballot.

Write actions show a pending label and disable controls until they finish. Repeated taps cannot start a second simultaneous write, and errors release the controls for retry without clearing the current form. This prevents duplicate taps within the current app session; it does not provide cross-tab or server-side request idempotency.

The organizer home now directs invitations to personal member links. The private organizer link is available only in **Members → Organizer access backup**, with its management permissions explicitly stated. Share personal links with voters; save the organizer link for an organizer.


## Guided planning, familiar faces and iMessage

New votes use **Places → People → Method → Review & invite**, with a bottom action bar that remains visible. Select people by photo/name; their number determines the expected vote count. Only selected members can cast ballots in a new poll. Existing polls keep their original voting rules. Runoffs retain the active participants from the prior vote.

Authenticated organizer/member links show the selected participants, larger avatars, and a compact **Waiting on…** row. Expand family status for details. Organizers can open individual reminder drafts for people who have not voted. Results show the family faces again, plus the winning restaurant's logo, address and **Open in Maps** action. Participant names/photos require a valid family credential; public result links do not expose the roster, contacts, personal invite tokens or individual ballots before voting finishes.

New photo uploads are **256×256 JPEGs**, usually smaller than the original and capped at 120,000 text characters. Previous 96×96 images remain valid; reupload the original photo to gain clarity. Routine status refreshes omit photos and reuse the images already loaded in the browser.

**Phone or iMessage email** accepts an existing phone number or an email such as `name@icloud.com`. The email must be enabled for iMessage on the recipient's Apple account. The app opens a Messages draft; availability and draft-body support vary by device. Use Share/Copy if the link cannot open your messaging app. Apple documents email recipients for Messages URLs in its [messaging app documentation](https://developer.apple.com/documentation/messages/preparing-your-app-to-be-the-default-messaging-app). Contacts remain organizer-only in the existing `phone` database field for compatibility.

**Automatic texting remains off**, as requested. Invitations, reminders and results are free draft/share actions; the organizer still reviews and sends them. No delivery service, paid account, background SMS or iMessage relay is configured.

Restaurants now opens with your saved favorites. **Add restaurant** reveals discovery and manual/Google Maps entry. Filtering or closing/reopening this area preserves unsaved details in the current session. Checkbox and ranking changes retain keyboard focus. Ballot actions stay visible while voting, with a count and an explanation when submission is disabled.

`sql/guided_poll_participants.sql` records the applied additive upgrade: the private `gw_poll_members` table, token-checked creation/status functions, selected-member enforcement for new polls, and improved avatar/contact validation. Do not rerun the original baseline on the live project.


### Starting a vote in the family group chat

Every new vote offers **Text group invite**, **Share group invite**, and **Copy group invite** above individual invitations. Choose the existing family thread in Messages/share sheet. The shared entry URL contains only the poll ID, never personal or organizer tokens, contacts or participant photos.

On a phone already connected to a personal member link, the group entry opens as that person. A new phone shows **Connect your personal link**: paste the private member link once. The app verifies the token and family before connecting the phone; organizer links and links for other sites are rejected. A valid family member who was not selected sees an explanation and cannot cast a ballot. Individual personal invitations remain available when onboarding someone for the first time.

Group invitations, reminders and results are still drafts for you to send. The app does not automatically send to a group or promise delivery.
