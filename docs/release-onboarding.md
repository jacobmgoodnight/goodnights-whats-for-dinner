# Invitation-first welcome

PR #20 is merged and its Pages deployment and main-branch checks passed. This follow-up changes the welcome screen only: invitation instructions and a labeled URL field lead to **Connect my invitation**. New-household setup remains available inside a secondary disclosure. Existing group/personal/organizer links, saved identities, voting rules, Home and the local demo retain their behavior.

No database or production permission changes are required. Quick Pick and meal history are on hold; their original implementation is retained on `codex/smarter-dinner-proposal-held-20261028` for later review. It is not part of this release. A one-time travel poll with name-only places and temporary guests is a separate feature requiring its own reviewed backend plan.

Validation: 133 Node tests; synthetic browser checks at 320/390px cover empty/foreign-link recovery, hidden setup, labeled native URL input, verified personal connection and same-phone return. The existing ballot/organizer/group/restaurant smoke suite runs in CI. Actual Safari/installed iPhone/Android acceptance remains manual. A frontend rollback is a normal reviewed revert; no database rollback is involved.
