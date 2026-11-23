# Trial task: closet "By category" view (bucket view)

Purpose: a bounded, front-end-only task, used to compare Claude Code with the previous chat → copy → GitHub Desktop workflow.
Branch: `trial/closet-buckets`, created from `origin/phase3b-request-access`.
Scope: the closet screen only. No database, API, auth or Supabase changes.
Repo on disk: `C:\dev\digital-closet`.

## Hard rules for this trial (in addition to CLAUDE.md)
1. Never commit on `main`. Before every commit, run `git branch --show-current` and confirm it is `trial/closet-buckets`.
2. Never push, merge, rebase or reset. Sharon publishes the branch herself in GitHub Desktop.
3. Never run Supabase or Vercel commands. Don't edit `supabase/`, `api/`, `package.json`, `package-lock.json`, `vercel.json`, `.claude/`, `CLAUDE.md`, `AGENTS.md` or `.handoff/`.
4. Never read or print `.env*` files or secrets.
5. Never add a dependency without asking.
6. If the code doesn't match what this brief assumes, STOP and ask Sharon. Don't guess.
7. Small files, one job each. No new feature code in `src/App.tsx`.
8. One step = one commit (`trial(step N): ...`). Run `npm run build` after each step. Then STOP and report: files changed (lines added/removed), commit hash, build result, anything uncertain, and the undo command (`git revert <hash>`). Wait for "go".

## What Sharon wants
- Closet items grouped into buckets. The grouped view is the default.
- A toggle to see all items on one page (the current view, unchanged).
- Jackets and coats are separate buckets.

## Decisions (approved by Sharon, Nov 19 2026)
| # | Decision |
|---|---|
| D1 | Buckets, in this order: Needs review, Tops, Bottoms, Dresses & Jumpsuits, Jackets, Coats, Activewear, Swimwear, Sleepwear, Footwear, Accessories |
| D2 | Jackets = Outerwear with sub-category Bomber, Blazer, Denim Jacket, Leather Jacket, or any sub-category containing "jacket", "blazer" or "bomber" |
| D3 | Coats = Outerwear with sub-category Trench Coat, Puffer, or any sub-category containing "coat", "puffer" or "parka" |
| D4 | Needs review = no category, a category not in the classifier taxonomy, or Outerwear that D2/D3 can't place. Shown at the TOP when not empty |
| D5 | Blazer goes in Jackets (Sharon had no preference, so this is the default) |
| D6 | Matching ignores letter case and extra spaces |

Classifier taxonomy (from `api/classify-item.ts`): Top, Bottom, Outerwear, Dress, Jumpsuit, Footwear, Accessory, Activewear, Swimwear, Sleepwear.
Mapping: Top → Tops; Bottom → Bottoms; Dress and Jumpsuit → Dresses & Jumpsuits; Outerwear → D2/D3/D4; Footwear → Footwear; Accessory → Accessories; Activewear, Swimwear and Sleepwear map to buckets of the same name.

## Defaults Claude chose (Sharon can change these before Step 1)
| # | Default |
|---|---|
| P1 | Empty buckets are hidden |
| P2 | Each bucket header shows a count, e.g. "Jackets (7)" |
| P3 | Items keep their existing order inside each bucket |
| P4 | The app always opens on "By category". The toggle choice is not remembered between visits |
| P5 | All buckets are open. No collapsing in this version |
| P6 | Tapping an item does exactly what it does today, in both views |

## Steps (one commit each; STOP after each and wait for "go")

**Step 0 — Preflight (no code changes)**
1. `git status`. If any TRACKED file is modified, STOP and report. Untracked files that were already there (such as `.handoff/`) are fine, but never commit them.
2. `git fetch origin`, then create the branch: `git switch -c trial/closet-buckets origin/phase3b-request-access` (asks Sharon).
3. `npm ci`, then `npm run build`. Record the baseline result. Do NOT fix existing errors; report them.
4. Commit only `docs/claude-code-trial/bucket-view-brief.md` and `.claude/settings.json` (use `git add` with those exact paths): `trial(step 0): add trial brief and permission rules`. Do NOT commit `CLAUDE.md`, `AGENTS.md` or `.handoff/`.
5. Report how App.tsx currently renders the closet grid: line numbers, the item tile markup, and where the item list comes from.

**Step 1 — Category inventory (read-only, no commit)**
Find every place an item's `category` / `sub_category` is set or loaded: the classifier, tag scan, brand import, manual entry, items loaded from Supabase, and demo/sample items. List the actual values each one can produce. If any value isn't covered by D1–D6, STOP and ask Sharon which bucket it goes in.

**Step 2 — Mapping logic: `src/lib/closetBuckets.ts` (new file only)**
Pure TypeScript, no React. Exports the bucket list (D1 order) and `bucketFor(item)`, plus `groupByBucket(items)`, which returns only non-empty buckets in order. Include a table in a comment at the top showing category/sub-category → bucket. Build. Commit.

**Step 3 — Extract the existing item tile: `src/components/closet/ItemTile.tsx`**
Move the existing per-item tile markup out of `App.tsx` into its own component, with zero visual or behavior change, and have `App.tsx` use it. This is the only step that moves existing code. Build. Commit. (Sharon can preview after this step: the app should look identical.)

**Step 4 — `src/components/closet/BucketSection.tsx` (new file only)**
A header (bucket name + count) and a grid of `ItemTile`s, using the same grid classes as the current closet grid. Build. Commit.

**Step 5 — `src/components/closet/ClosetByCategory.tsx` (new file only)**
Uses `groupByBucket` and renders one `BucketSection` per non-empty bucket, with Needs review first. Build. Commit.

**Step 6 — `src/components/closet/ClosetViewToggle.tsx` (new file only)**
A two-option control: "By category" | "All items". Styled like existing controls in the app. Build. Commit.

**Step 7 — Wire it in (App.tsx, minimal diff)**
Add the view state (default "By category"), render the toggle above the closet, and show `ClosetByCategory` or the existing grid. Change nothing else in `App.tsx`. Build. Commit.

**Step 8 — Wrap-up (no code)**
Report the full commit list (hash + message), files touched, total lines added/removed, and confirm `git diff origin/phase3b-request-access --stat` shows no changes under `api/`, `supabase/`, `package.json` or `vercel.json`.

## If something breaks
Each step is one commit, so `git log --oneline` shows which step introduced what. To undo one step: `git revert <hash>` (asks Sharon). Step 3 is the riskiest, because it moves existing code. If the preview looks different after Step 3, the problem is there.

## Sharon's preview test (after she publishes the branch in GitHub Desktop)
Run on the Vercel preview deployment of `trial/closet-buckets`, pointed at the dev Supabase project:
- [ ] Account A: opens on "By category"; bucket counts add up to the total item count
- [ ] Spot check 10 items, including at least one jacket, one coat and one blazer, and confirm each is in the right bucket
- [ ] Needs review appears only when something is unplaced, and appears at the top
- [ ] "All items" looks exactly like the old closet; switching back and forth works
- [ ] Add a new item, and confirm it lands in the right bucket after saving
- [ ] Open/edit/delete an item from both views
- [ ] Phone-width screen looks right
- [ ] 250-item closet: scrolling stays smooth
- [ ] Account B (two-account isolation): sees only its own items in both views
- [ ] GitHub compare view: no files changed under `api/` or `supabase/`
- [ ] Don't merge into main from here. The merge target is decided after the trial

## Trial log (fill in as you go — this is the comparison data)
| Step | Start | End | Prompts approved | Problems found | Notes |
|---|---|---|---|---|---|
| 0 | | | | | |
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |
| 7 | | | | | |
| 8 | | | | | |
| Preview test | | | | | |

Comparison question: total hours and number of preview-test problems, against a similar-sized task done in the old workflow.
