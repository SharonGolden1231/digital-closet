# Brief: empty-closet message position + taxonomy v2 (two new folders)

Date: 2026-11-22. Repo: `C:\dev\digital-closet`. Branch: `trial/closet-buckets`.

## Hard rules
1. Only `trial/closet-buckets`. Check `git branch --show-current` before every commit. Never `main`, `phase3a-onboarding`, `fix/require-category`.
2. Never push, rebase, reset or force. Sharon pushes from GitHub Desktop.
3. Don't edit `api/`, `supabase/`, `package.json`, `package-lock.json`, `vercel.json`, `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.handoff/`. Never read `.env*`. No new dependencies.
   EXCEPTION, prepared by the chat with Sharon's approval: `api/classify-item.ts` and `api/tag-scan.ts` already contain the small prompt change below (uncommitted). Do NOT edit them; review the diff and commit them in Step 3.
4. Commits: `git add <exact paths>` then `git commit -m "..." -- <same exact paths>`. Never `git add .` / `-A`.
5. If the code doesn't match this brief, STOP and ask.
6. One step = one commit, `taxonomy(N): ...`. After each: `npx tsc --noEmit -p .` AND `npm run build`. STOP and report (files, lines +/-, hash, results, undo = `git revert <hash>`). Wait for "go".

## Decisions (Sharon, 2026-11-22)
| # | Decision |
|---|---|
| H1 | Empty closet: the message "Your closet is empty so far. Use Add to bring in your first piece." sits ABOVE the category folders, not below |
| H2 | New folder "Knitwear & Cardigans": sweaters, cardigans, knit vests |
| H3 | New folder "Sweatshirts & Joggers": sweatshirts, hoodies, joggers |
| H4 | Classifier CATEGORIES stay the same (Top, Bottom, ...). Only sub-categories are added: Top gets Sweater, Cardigan, Knit Vest; Bottom gets Joggers. Folders are decided from the sub-category. So no change to stored category values, the category picker, emoji map, stylist rules or the database |
| H5 | Folder order: Needs review, Tops, Knitwear & Cardigans, Sweatshirts & Joggers, Bottoms, Dresses & Jumpsuits, Jackets, Coats, Activewear, Swimwear, Sleepwear, Footwear, Accessories (default; Sharon can reorder) |
| H6 | Cover files: `knitwear.jpg` and `sweatshirts-joggers.jpg` in both `women/` and `men/` (same photo in both sets), already in `public/folder-covers/` with CREDITS.md rows. Needs review: `needs-review.jpg` |

## Bucket rules to add to closetBuckets.ts (matching ignores case and extra spaces)
Checked in this order, before the existing category mapping:
- Category Top OR Outerwear, and sub-category contains "sweater", "jumper", "cardigan", "pullover", "knit vest" or "sweater vest" -> Knitwear & Cardigans
- Category Top OR Outerwear, and sub-category contains "sweatshirt", "hoodie" or "hooded" -> Sweatshirts & Joggers (Sharon 11-22: a zip hoodie labeled Outerwear goes here too)
- Category Bottom OR Activewear, and sub-category contains "jogger" or "sweatpant" -> Sweatshirts & Joggers
- Everything else: unchanged (existing rules incl. coat-word-wins).
- Sharon 11-22: a sweater coat labeled Outerwear goes to Knitwear & Cardigans (the knit rule is checked before the coat rule, as written).
Existing items with sub-category Hoodie/Sweatshirt move to Sweatshirts & Joggers automatically. Update the table comment at the top of the file.

## Steps

**Step 0: Inspect (read-only, no commit)**
- `git status`: expected uncommitted changes are `api/classify-item.ts`, `api/tag-scan.ts`, the 5 new cover files, and `public/folder-covers/CREDITS.md` (plus untracked CLAUDE.md/AGENTS.md/this brief). Anything else: STOP.
- Show `git diff api/classify-item.ts api/tag-scan.ts` and confirm it only adds Sweater, Cardigan, Knit Vest (Top), Joggers (Bottom) and the two classification rules.
- List every place in `src/` that lists sub-categories (manual entry, edit form, taxonomy.ts, stylist OutfitBoard rules). Say whether each needs the new sub-categories added and what would break if not.
- Find where the empty-closet message is rendered relative to the folder grid.
- STOP and report.

**Step 1: Empty-closet message above the folders (H1)**
Smallest diff. Commit.

**Step 2: Buckets + covers (H2, H3, H5, H6)**
Update `src/lib/closetBuckets.ts` (rules above, order H5, table comment) and FolderTile's file-name map for the two new buckets. Also add Sweater, Cardigan, Knit Vest (under Top) and Joggers (under Bottom) to MANUAL_CATEGORIES in App.tsx (Sharon approved 11-22). No other src/ list changes; taxonomy.ts already knows these words. Commit with the 5 cover files and CREDITS.md (exact paths).

**Step 3: Classifier prompts (H4)**
Commit `api/classify-item.ts` and `api/tag-scan.ts` exactly as prepared (exact paths). No other api/ file.

**Step 4: Wrap-up (no code)**
Commit list; `git diff origin/phase3a-onboarding --stat`: api/ shows only classify-item.ts and tag-scan.ts; nothing under supabase/.

## Not in this brief
Re-classify an item (change its category / type after it was saved) is a separate brief: it needs a new server route and an update permission check.

## Sharon's preview test (after pushing trial/closet-buckets)
On the Vercel preview with dev Supabase, computer AND iPhone:
- [ ] Empty account: message at the top, then all folders (13 for women, 12 for men without Dresses & Jumpsuits) with their photos
- [ ] Existing hoodie/sweatshirt items now sit in Sweatshirts & Joggers
- [ ] Add → Manual offers Sweater, Cardigan, Knit Vest and Joggers, and each lands in its new folder
- [ ] Classification check with real garments (Camera AND Tag Scan): a sweater, a cardigan, a knit vest, a hoodie, joggers -> each lands in its new folder
- [ ] Regression check (must not change): a T-shirt, jeans, a blazer, a puffer, leggings, a dress -> same folders as before
- [ ] Needs review shows its tags photo when it has items
- [ ] Women's/men's sets and Settings switch still work
- [ ] Two-account isolation: account B (private window) sees only its own items and counts
Nothing goes to main before go-live day.
