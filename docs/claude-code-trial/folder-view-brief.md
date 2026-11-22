# Fix brief: closet folders (folder tiles first, items only inside a folder)

Date: 2026-11-19. Repo: `C:\dev\digital-closet`. Branch: `trial/closet-buckets` (local head 5f13ff7 or later).
Why: the "By category" view shows every bucket with all its items on the main page. Sharon wants folders: the main page shows only folder tiles, and tapping a folder opens a screen with just that folder's items. The previous brief specified the wrong layout; this replaces it.

## Hard rules
1. Work only on `trial/closet-buckets`. Run `git branch --show-current` before every commit. Never commit on `main`, `phase3a-onboarding` or `fix/require-category`.
2. Never push, rebase, reset or force. Merges: none in this brief. Sharon pushes from GitHub Desktop.
3. Don't edit `api/`, `supabase/`, `package.json`, `package-lock.json`, `vercel.json`, `.claude/`, `CLAUDE.md`, `AGENTS.md` or `.handoff/`. Never read `.env*`. No new dependencies.
4. Photos: load cover photos exactly the way `ItemTile` loads item photos today (same private storage access, same thumbnails). Never make storage public, and never add a new way of fetching images.
5. If the code doesn't match this brief, STOP and ask Sharon.
6. One step = one commit, `folders(step N): ...`. After each step, run `npx tsc --noEmit -p .` AND `npm run build`. Then STOP and report: files changed (lines +/-), commit hash, results, anything uncertain, undo command. Wait for "go".

## Decisions (Sharon, 2026-11-19)
| # | Decision |
|---|---|
| F1 | Main closet page ("By category"): a grid of folder tiles only, with no items shown |
| F2 | Each tile: a cover photo, the folder name and the item count, e.g. "Jackets · 7" |
| F3 | The cover must be a REAL photo of an item (web product image or the user's own photo/thumbnail), never an emoji or placeholder icon |
| F4 | Tapping a tile opens the folder screen: back arrow + "Jackets · 7" header + grid of that folder's items (existing ItemTile) |
| F5 | Folder order and bucket rules stay as they are now (closetBuckets.ts). ALL category folders always show, even empty ones (count 0). Needs review shows only when it has items, and then it comes first |
| F7 | Generic cover: a folder with no item that has a real photo (including an empty folder) shows a generic category photo, e.g. a coat for Coats. These are licensed stock photos Sharon picks, stored INSIDE the app. Never load them from another website at runtime (no hotlinking) |
| F8 | Two sets of generic covers: `public/folder-covers/women/<bucket>.jpg` and `public/folder-covers/men/<bucket>.jpg`. The set follows the intro answer `shops_for` (options.ts SHOPS_FOR): `menswear` -> men; `womenswear`, `both`, or no answer -> women. If the answer changes in Settings, the covers follow it |
| F9 | For `menswear` users, Dresses & Jumpsuits is hidden while it has 0 items (it shows if they add one). Every other folder always shows |
| F6 | "All items" stays exactly as today |

## Defaults Claude chose (Sharon can change before Step 1)
| # | Default |
|---|---|
| Q1 | Cover = the most recently added item in that folder that has a real photo. Items without a real photo (emoji, incomplete, missing image) are skipped |
| Q2 | If the generic photo file for a bucket is missing: plain tile in the same size and shape, with a neutral background and the name + count, and no image or emoji |
| Q3 | Tapping an item inside a folder does exactly what tapping it does today |
| Q4 | Back arrow returns to the folder grid. Leaving the closet tab and coming back shows the folder grid. The iPhone swipe-back gesture is NOT wired in this version; Claude reports in Step 0 how hard it would be |

## Steps

**Step 0: Inspect (read-only, no commit)**
1. Confirm the branch is `trial/closet-buckets`, and that `git status` shows no modified tracked files other than `CLAUDE.md` and `AGENTS.md` (leave those untouched and uncommitted).
2. Describe the OLD Folders view still in `App.tsx` (groups, openGroup, openBucket, renderFolder): what it looked like, whether tapping opened a folder screen, and whether it had a cover image. Say whether reusing parts of it is safer than the new components below. Recommend one approach, with no code yet.
3. Check whether `public/folder-covers/women/` and `public/folder-covers/men/` exist and list their files. Report where the closet screen can get the user's `shops_for` answer (already loaded profile, or not). Then explain how an item's photo is stored and shown today: which fields hold the user photo, the thumbnail and the web image; how an emoji/incomplete item is marked; and how ItemTile picks what to show. Name the exact test that makes an item "has a real photo".
4. Say how much work iPhone swipe-back support (Q4) would be.
5. STOP and wait for Sharon's choice.

**Step 1: `src/lib/folderCover.ts` (new file only)**
A pure function that picks the cover item for a folder per Q1, plus a helper that says whether an item has a real photo (the test from Step 0). No React. Commit, and also commit this brief: `git add src/lib/folderCover.ts docs/claude-code-trial/folder-view-brief.md` (exact paths only).

**Step 2: `src/components/closet/FolderTile.tsx` (new file only)**
A tile with the cover photo (loaded like ItemTile), name and count. If the folder has no real item photo, use the F7/F8 generic file `/folder-covers/<women|men>/<bucket>.jpg` (file names: tops, bottoms, dresses-jumpsuits, jackets, coats, activewear, swimwear, sleepwear, footwear, accessories). If that file fails to load, use the Q2 fallback. The generic files are added by Sharon; don't create or download images. Read `shops_for` the way the app already reads the user's intro answers (no new database query or route; if none exists on the closet screen, STOP and ask). Also commit `public/folder-covers/CREDITS.md` and the image files Sharon added (exact paths only). Same grid and rounding style as the closet. Commit.

**Step 3: `src/components/closet/ClosetFolders.tsx` (new file only)**
Folder grid (F1, F5) and an open-folder screen (F4: back arrow, header, item grid reusing BucketSection/ItemTile). The open folder is kept in local state. Commit.

**Step 4: Wire it in (App.tsx, minimal diff)**
"By category" renders ClosetFolders instead of ClosetByCategory. Nothing else in App.tsx changes. If ClosetByCategory is then unused, leave the file for the cleanup step. Commit.

**Step 5: Wrap-up (no code)**
Commit list, files touched, and confirmation that `git diff origin/phase3a-onboarding --stat` shows nothing under `api/` or `supabase/`.

## Sharon's preview test (after pushing trial/closet-buckets from GitHub Desktop)
On the Vercel preview with dev Supabase, on a computer AND an iPhone:
- [ ] Closet opens on "By category" showing ONLY folder tiles
- [ ] Folders with items show a real item photo as cover, never an emoji
- [ ] Empty folders (and folders whose items have no photo) show the generic category photo, e.g. a coat for Coats
- [ ] All 10 category folders are visible even with 0 items; Needs review only appears when it has items
- [ ] Women's covers for a Womenswear/Both user; men's covers for a Menswear user; change the answer in Settings and the covers switch
- [ ] Menswear user: Dresses & Jumpsuits is hidden while empty
- [ ] Counts on the tiles add up to the total number of items
- [ ] Tap Jackets: only jackets appear; the back arrow returns to the folders
- [ ] Needs review is first (when not empty); Puffer Jacket is under Coats, Blazer under Jackets
- [ ] "All items" looks exactly like before
- [ ] Add an item: it appears in the right folder; the cover updates if it's the newest item with a photo
- [ ] 250-item closet: the folder grid loads fast; opening a folder is smooth
- [ ] Two-account isolation: account B (private window) sees only its own folders, counts and cover photos, never account A's photos
- [ ] Requests tab still shows "Joined" and the country dropdown

Nothing goes to main before go-live day.
