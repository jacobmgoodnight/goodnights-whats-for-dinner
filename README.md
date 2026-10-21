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
- **Ranked:** Each person ranks up to three choices. The app counts first choices and eliminates equally lowest-scoring candidates together per round, transferring preferences when possible. For an unresolved tie, the organizer can start a runoff or pick once at random between the tied leaders.
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

## A calmer ballot and optional family group entry

**Pick 5 for me** now sits beside the restaurant filters. In **New vote → Review → Voting experience**, the organizer can hide **My votes** navigation while a person is on this vote or its results. This is a convenience setting; personal links still work normally. Existing open polls can change the same preferences under **Family organizer controls → Voting options**.

The **group invitation avatar/name picker**, checked by default for new votes, lets everyone use the same invitation from the family chat: open it, tap your own avatar/name, and vote. The phone remembers that selection for this poll. Anyone with that invitation can see the invited names/photos and submit once as an invited person, so enable it only for a trusted family group. It does not prove identity. Existing personal links remain private, and are still required to edit a saved ballot. No reusable member credentials, contacts, saved individual ballots, or other family history are exposed through group access. Turning the picker off revokes its invitation; turning it on again creates a new one. Share the updated group invitation after changing this setting. Turning the picker off uses the original personal-link connection behavior.

The **Waiting on…** panel appears below the ballot. Small dots beside its title indicate waiting; voted avatars appear with green checks. The page refreshes automatically and offers a retry if the connection pauses. Saved votes are acknowledged before checking whether the person is on the current guest list. Brief food-emoji animations celebrate a successful submission; reduced-motion devices get a static experience. Ranked-choice selections update in place to avoid reopening the iOS native picker, with a subtle restaurant logo beside each selected rank.

Results show at most one notable highlight: a genuine ranked-choice comeback, a shared first choice, unanimous approval, or a close one-vote contest. Tiny polls, ordinary counting rounds and turnout do not get extra cards. Shared messages include the winner’s saved address and a public results link. Only the organizer can make or share a results picture; family members retain a small text-share action. **Include the dinner crew’s avatars and names** is optional and off by default. Share only pictures with details your family is comfortable sharing.

In **History**, organizers can **Delete** an individual test poll or **Clear finished history**, with a permanent-deletion confirmation. Clearing history includes older finished polls beyond those currently displayed and leaves open polls, members and saved restaurants intact. Deleting a poll removes its ballots and stops its poll links from working.

`sql/voting_experience.sql` adds these settings and scoped group/deletion RPCs without changing existing votes, member IDs or personal links. It has been applied to the live database. The original database baseline must not be rerun. Rollback-only integration checks cover all three modes, scoped group access, revocation, personal edits, deletion permissions/cascades and finished-only cleanup.

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

Authenticated organizer/member links show the selected participants, larger avatars, and a compact **Waiting on…** row. An always-visible compact Already voted row shows green checks; the waiting dots sit beside Waiting on… without technical polling text. Organizers can open individual reminder drafts for people who have not voted. Results show the family faces again, plus the winning restaurant's logo, address and **Open in Maps** action. Participant names/photos require a valid family credential; public result links do not expose the roster, contacts, personal invite tokens or individual ballots before voting finishes.

New photo uploads are **256×256 JPEGs**, usually smaller than the original and capped at 120,000 text characters. Previous 96×96 images remain valid; reupload the original photo to gain clarity. Routine status refreshes omit photos and reuse the images already loaded in the browser.

**Phone or iMessage email** accepts an existing phone number or an email such as `name@icloud.com`. The email must be enabled for iMessage on the recipient's Apple account. The app opens a Messages draft; availability and draft-body support vary by device. Use Share/Copy if the link cannot open your messaging app. Apple documents email recipients for Messages URLs in its [messaging app documentation](https://developer.apple.com/documentation/messages/preparing-your-app-to-be-the-default-messaging-app). Contacts remain organizer-only in the existing `phone` database field for compatibility.

**Automatic texting remains off**, as requested. Invitations, reminders and results are free draft/share actions; the organizer still reviews and sends them. No delivery service, paid account, background SMS or iMessage relay is configured.

Restaurants now opens with your saved favorites. **Add restaurant** reveals discovery and manual/Google Maps entry. Filtering or closing/reopening this area preserves unsaved details in the current session. Checkbox and ranking changes retain keyboard focus. Ballot actions stay visible while voting, with a count and an explanation when submission is disabled.

`sql/guided_poll_participants.sql` records the applied additive upgrade: the private `gw_poll_members` table, token-checked creation/status functions, selected-member enforcement for new polls, and improved avatar/contact validation. Do not rerun the original baseline on the live project.


### Starting a vote in the family group chat

Every new vote offers **Text group invite**, **Share group invite**, and **Copy group invite** above individual invitations. Choose the existing family thread in Messages/share sheet. By default, the shared entry URL contains only the poll ID, never personal or organizer tokens, contacts or participant photos. With the optional avatar/name picker enabled, it also contains a revocable credential for this poll only; that invitation reveals invited names/photos as described above.

With the default personal-link mode, a phone already connected to a personal member link opens the group entry as that person. A new phone shows **Connect your personal link**: paste the private member link once. The app verifies the token and family before connecting the phone; organizer links and links for other sites are rejected. A valid family member who was not selected sees an explanation and cannot cast a ballot. Individual personal invitations remain available when onboarding someone for the first time.

Group invitations, reminders and results are still drafts for you to send. The app does not automatically send to a group or promise delivery.

## Dinner-focused planning and the phone app

The same plate, heart and cutlery mark now appears in the header, favicon, results announcement and Home Screen icons. New setup defaults to **My votes navigation off** and **group avatar/name selection on**; review or change both before creating a poll. Existing polls retain their settings.

For a food-specific vote, choose **Pizza night**, **Mexican night**, or another cuisine under the Places filters. That replaces the shortlist with matching saved places (up to 20), so unrelated earlier selections do not sneak into the vote. Name/town and distance filters still apply. Adjust the shortlist and use any of the three voting methods as usual. Matching uses saved restaurant categories and recognizable food words in names, never the address. Edit a restaurant’s category if it is missing from the expected cuisine.

On the organizer or member home page, expand **Add Goodnights to your phone** for installation instructions (and a native install button where supported). The manifest includes 192px/512px PNGs plus an Apple Home Screen icon. If the installed app starts without a saved identity, paste the private personal or organizer link into the welcome screen; group invitations can also reconnect a specific vote. These links are validated against this site and verified before credentials are saved. The public manifest contains no credentials.

Installation currently provides an app icon and standalone window, with online voting. It does **not** enable offline voting or background notifications. A future opt-in Web Push feature can alert the organizer when results finish, followed by organizer-controlled sharing (and later optional notifications to subscribed members). That needs subscription storage, secure server-side delivery, retries and revocation; checking a web page every few seconds cannot notify a closed page. On iPhone/iPad, push requires a Home Screen web app and user permission: [WebKit guidance](https://webkit.org/blog/13878/). Separate native organizer/member apps are unnecessary for this approach.

## Cuisine personality, remembered names and celebrations

New cuisine-specific polls save the organizer’s explicit choice. Pizza/Mexican and the other cuisine shortlists carry their matching emoji and title into group/personal invitation drafts, reminders, the ballot, results and organizer results pictures. Lunch keeps its lunch wording. Older polls without a saved cuisine keep their original presentation; no historical restaurants or votes are reclassified. `sql/themed_family_votes.sql` is the applied additive metadata upgrade.

After choosing an avatar in a group invitation, that browser remembers the chosen member for the same family’s later group votes. The new invitation still must be valid, and the remembered member must still be invited and active. The hint does not grant access and contains no reusable personal token. **Not you? Choose your name** returns to the picker and pauses automatic selection until the next choice. Older per-poll memories can migrate when they agree on one invited member; a shared phone with conflicting memories gets the picker. Another browser, private browsing or cleared storage may require choosing again.

Already-voted names in the group picker are visibly disabled. The app rechecks vote status before accepting a newly chosen identity, and the database still prevents overwriting a submitted group ballot. A remembered voter can return directly to their own saved-vote acknowledgement/results; personal links remain the way to edit an open saved ballot. This remains a family honor-system invitation, not identity authentication.

**Members** now shows **Copy invitation**, **Edit profile** and expandable **Access & membership** controls with separate confirmed **Reset personal link** and **Remove member** actions. There are no typed RESET/REMOVE commands or repeated contact-saved labels. Removing voting access preserves historical ballots; an organizer can close an open poll early if it is waiting on a removed member.

Waiting on uses only the animated dots, without a second static ellipsis. Results celebrate once per poll in that browser tab’s session, using the cuisine’s emoji when present. A results celebration replaces the submission animation when the last ballot completes the vote. A short winner-card reveal, check arrival and avatar-button press feedback add small touches, all respecting reduced motion. Refreshing or rebuilding the results screen does not replay the celebration in the same session.

The organizer statistics page is deliberately deferred until there is more family data.

## Optional random tiebreaker

On tied results, organizers can choose **🎲 Pick a tied winner** or **Start a runoff**. The random draw runs once on the server, only after voting ends, among the leaders calculated from the saved ballots (including ranked transfers). The saved pick survives refreshes and repeated requests; it cannot be rerolled. Results, shared messages and images disclose the random choice and retain the real vote counts. Members cannot initiate a draw. `sql/random_tiebreaker.sql` is the additive database upgrade; existing votes and invitations remain valid.

Ballot actions now occupy their own space at the bottom of the ballot and stay visible while scrolling, without a blank spacer below the name-switch button. Background refresh pauses while the page is hidden and skips overlapping requests; unresolved ties keep refreshing so a saved organizer pick arrives on open family results pages.

## Readable ballots and swipe feedback

Approval and consensus ballots show each restaurant's saved cuisine and address; missing addresses say **Location not saved**. Ranked-choice menus include addresses to distinguish locations, show the selected place's details beside each native control, and offer **See all places and locations**. This uses saved information without a new lookup or provider.

The existing Goodnights brand, button and text colors are preserved. Swipe cards give small left/right feedback with explicit **Not tonight / Sounds good** text. Vertical scrolling, yes/no buttons, answer progress, backtracking and explicit submission remain available. Returning to an answered card shows the saved yes/no answer. Reduced-motion users get the directional text without movement. Ranking details update without replacing or refocusing the iOS native select.

No voting rules, backend, data or credentials change. [Before/after screenshots and QA evidence](docs/qa/q1-h3/README.md) document synthetic mobile/keyboard/gesture/failed-save checks and physical-device limitations. Run the normal Node suite with `node --test tests/*.test.js`; the optional real-browser runner is documented there.
