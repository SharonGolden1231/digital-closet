# Fix brief: folder covers, empty closet, Needs review photo

Date: 2026-11-22. Repo: `C:\dev\digital-closet`. Branch: `trial/closet-buckets`.
Why: Sharon tested the preview (women and men). Three changes to the folder view; they replace decisions F2, F3 and Q1 of folder-view-brief.md.

## Hard rules (same as before)
1. Only `trial/closet-buckets`. Check `git branch --show-current` before every commit. Never `main`, `phase3a-onboarding`, `fix/require-category`.
2. Never push, rebase, reset or force. Sharon pushes from GitHub Desktop.
3. Don't edit `api/`, `supabase/`, `package.json`, `package-lock.json`, `vercel.json`, `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.handoff/`. Never read `.env*`. No new dependencies.
4. Commits: `git add <exact paths>` then `git commit -m "..." -- <same exact paths>`. Never `git add .` / `-A`. Allowed modified tracked file besides your own changes: `docs/go-live-checklist.md` (Sharon/Claude chat updates it); commit it only when a step says so.
5. If the code doesn't match this brief, STOP and ask.
6. One fix = one commit, `folders-fix(N): ...`. After each: `npx tsc --noEmit -p .` AND `npm run build`. STOP and report (files, lines +/-, hash, results, undo = `git revert <hash>`). Wait for "go".

## New decisions (Sharon, 2026-11-22)
| # | Decision |
|---|---|
| G1 | Folder covers are ALWAYS the generic photo picked for that category (`/folder-covers/<women|men>/<file>.jpg`). A user's item photo never becomes a folder cover. (Replaces F2/F3/Q1.) |
| G2 | A user with an empty closet still sees all the category folders (count 0) on "By category", not an empty page. Ways to add items stay visible as today. |
| G3 | Needs review gets one shared cover photo for both sets: `/folder-covers/needs-review.jpg`. It still only appears when it has items, first in the grid. |
| G4 | If a cover file fails to load: plain tile with name + count, no emoji (unchanged). |

## Fixes

**Fix 1: covers always generic (G1, G4)**
FolderTile uses only the generic cover for its bucket and the coverSetFor(shops_for) set. Remove the item-photo cover logic. `src/lib/folderCover.ts` becomes unused: delete it with `git rm src/lib/folderCover.ts` (asks Sharon) in the same commit. Since covers no longer use item photos, the folder grid loads no private item images at all. Commit.

**Fix 2: empty closet shows the folders (G2)**
Find why "By category" shows an empty page when the closet has 0 items (likely an empty-state branch before ClosetFolders renders). Make "By category" render the folder grid with all category folders at 0 (menswear: Dresses & Jumpsuits still hidden while empty, F9). Keep any "add your first item" prompt/buttons that exist today, placed above or below the grid. "All items" keeps its current empty state. Smallest diff possible; report exactly what you changed in App.tsx. Commit.

**Fix 3: Needs review cover (G3)**
FolderTile uses `/folder-covers/needs-review.jpg` for the Needs review bucket in both sets. If Sharon has added the file and its CREDITS.md row, commit them too (exact paths). If the file is missing, the tile falls back to the plain tile (G4). Also commit `docs/go-live-checklist.md` if it shows modified. Commit.

**Wrap-up (no code)**
Commit list; confirm `git diff origin/phase3a-onboarding --stat` shows nothing under `api/` or `supabase/`.

## Sharon's preview test (after pushing trial/closet-buckets)
On the Vercel preview with dev Supabase, computer AND iPhone:
- [ ] Every folder shows its picked category photo, even folders that contain items with photos
- [ ] New/empty account: all category folders visible at 0 (menswear: no Dresses & Jumpsuits), not an empty page; adding a first item still works
- [ ] Needs review shows its photo when it has items; it's absent when empty
- [ ] Opening a folder still shows that folder's items with their own photos; back arrow works
- [ ] Women's set for Womenswear/Both/no answer; men's set for Menswear; switching in Settings switches the covers
- [ ] Two-account isolation: account B (private window) sees only its own items inside folders and counts, never account A's
- [ ] Requests tab still shows "Joined" and the country dropdown

Next (separate brief, after this passes): new folders Knitwear & Cardigans and Sweatshirts & Joggers, including the classifier update in api/.
Nothing goes to main before go-live day.
