# Brief: re-classify an item (change its type after saving)

Date: 2026-11-23. Repo: `C:\dev\digital-closet`. Branch: `trial/closet-buckets`.
Why: there is no way to change an item after saving. A wrong classification is permanent and the Needs review folder is a dead end. Must ship before wave 1.

## What already exists (checked by the chat)
- `closet_items` already has an owner-only UPDATE policy (`closet_items_update_own`, migration 20261110120000) and the `authenticated` role may update `category` and `subcategory`. So NO database migration is needed. If Step 0 finds otherwise, STOP.
- `api/items.ts` handles GET, POST and DELETE. DELETE already updates a row with the user's own token (soft delete via `deleted_at`). The new update follows the same pattern.

## Hard rules
1. Only `trial/closet-buckets`. Check `git branch --show-current` before every commit. Never `main`, `phase3a-onboarding`, `fix/require-category`.
2. Never push, rebase, reset or force. Sharon pushes from GitHub Desktop.
3. The ONLY server file you may edit is `api/items.ts` (permission rules ask Sharon each time). Never edit other `api/` files, `supabase/`, `package.json`, `package-lock.json`, `vercel.json`, `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.handoff/`. Never read `.env*`. No new dependencies. No database migration.
4. The update MUST run with the signed-in user's own token (like DELETE), never with the service/admin key, so the database's owner-only policy is what protects other users' items.
5. Commits: `git add <exact paths>` then `git commit -m "..." -- <same exact paths>`. Never `git add .` / `-A`.
6. If the code doesn't match this brief, STOP and ask.
7. One step = one commit, `reclassify(N): ...`. After each: `npx tsc --noEmit -p .` AND `npm run build`. STOP and report (files, lines +/-, hash, results, undo = `git revert <hash>`). Wait for "go".

## Decisions (defaults; Sharon can change before Step 1)
| # | Decision |
|---|---|
| R1 | Entry point: a "Change type" button in the item's detail panel (the panel that opens when you tap an item), in every folder and in All items |
| R2 | Picker: the same category + type list as Add → Manual (MANUAL_CATEGORIES), current values preselected |
| R3 | After saving: the item moves to its new folder at once; short confirmation "Moved to <folder>" |
| R4 | Saved fields: `category`, `subcategory`; set `user_confirmed = true`. If the item has no photo, also update its `emoji` to the new category's emoji. The AI's original answer (`raw_model_output`) is NEVER changed, so we can measure how often the AI was wrong |
| R5 | Server checks: user signed in (existing gate); item id must belong to the user (enforced by the owner-only policy; a non-owned or missing id returns 404, never a different user's data); category must be one of the 10 classifier categories; type max 60 characters; deleted items can't be changed |
| R6 | Analytics: event `item_reclassified` with from/to category and type only (no item name, no photo), user id only, like the existing PostHog setup |
| R7 | Only the type changes in this version. Editing name, colors or brand is out of scope |

## Steps

**Step 0: Inspect (read-only, no commit)**
- `git status` (expected: clean apart from untracked CLAUDE.md/AGENTS.md/this brief and a modified `.claude/settings.json` that Sharon updated).
- Confirm the UPDATE policy and column grants above exist in `supabase/migrations/` (also check `subcategory_confidence` and whether it is updatable; we don't need to change it).
- Show how DELETE in `api/items.ts` gets the user's token and checks ownership; propose the update route in the same style (method PATCH, body: id, category, sub_category). Say how the deletion lock (account pending deletion) is handled for DELETE and apply the same.
- Find the item detail panel in `src/` and where the closet list is held in state, so a changed item re-groups without a reload.
- STOP and report, with the plan.

**Step 1: Server route (`api/items.ts` only)**
PATCH per R4/R5, user's own token, returns the updated item in the same shape GET returns. Commit `api/items.ts` and this brief.

**Step 2: "Change type" UI (new component + minimal App.tsx wiring)**
New file `src/components/closet/ChangeTypeSheet.tsx` (picker from MANUAL_CATEGORIES), button in the detail panel, call PATCH, update the item in the closet list (R3), PostHog event (R6). Commit.

**Step 3: Wrap-up (no code)**
Commit list; `git diff origin/phase3a-onboarding --stat` shows under api/ only items.ts, classify-item.ts, tag-scan.ts; nothing under supabase/. Also commit `.claude/settings.json` (exact path).

## Sharon's preview test (after pushing)
On the Vercel preview with dev Supabase, computer AND iPhone:
- [ ] Open an item in Needs review, Change type to e.g. Top / Sweater: it moves to Knitwear & Cardigans immediately and stays there after reload
- [ ] Change a correctly filed item to another type and back: it moves both times
- [ ] An item without a photo shows the new category's emoji inside the folder
- [ ] Cancel the picker: nothing changes
- [ ] Two-account test (critical): Claude Code gives Sharon a way to send a PATCH for an item id belonging to account A while signed in as account B (e.g. browser console snippet using B's session). It must fail with 404, and A's item must be unchanged
- [ ] Signed out: PATCH is refused
- [ ] PostHog shows `item_reclassified` with categories only, no item names
Nothing goes to main before go-live day.
