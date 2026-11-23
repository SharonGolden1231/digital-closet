# Brief: consolidate Release 1 (trial + category fix into phase3a-onboarding)

Date: 2026-11-23. Repo: `C:\dev\digital-closet`.
Goal: one tested branch, `phase3a-onboarding` (the head of draft PR #4), containing everything: Release 1 foundation + folders/covers + taxonomy v2 + multi-item fix + re-classify (`trial/closet-buckets`) + required category (`fix/require-category`). Then one full test of the combined app. `main` is not touched; PR #4 still merges only on go-live day.

## Hard rules
1. Never commit on, merge into, or push `main`. Never push anything (Sharon pushes from GitHub Desktop and merges the pull request on GitHub herself).
2. The only merge you may run: `fix/require-category` INTO `trial/closet-buckets`, with `--no-ff`. Never merge into `phase3a-onboarding` locally; that happens through a pull request on GitHub (Part D).
3. On ANY conflict: STOP. List each conflicted file and region, what each side changed, in plain words, and your proposed resolution. Do not resolve, do not abort, until Sharon decides.
4. No rebase, reset, force, `git add .`/`-A`. Commits: `git add <exact paths>` then `git commit -m "..." -- <same exact paths>`.
5. Don't edit `api/`, `supabase/`, `package.json`, `package-lock.json`, `vercel.json`, `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.handoff/`. Never read `.env*`.
6. STOP after each part and report. Wait for "go".

## Part A: Check (read-only, no commit)
1. `git status`. Expected: `.claude/settings.json` either committed already ("Restore full api/ lock") or modified; if modified, commit it alone first (exact path) and report the hash. `docs/go-live-checklist.md` may be modified (updated by the chat): commit it alone (exact path). Anything else modified: STOP.
2. `git fetch origin`. Report the tip commit of `trial/closet-buckets`, `fix/require-category` and `phase3a-onboarding`, local AND on origin, and whether local and origin match.
3. Confirm both branches already contain phase3a-onboarding: `git merge-base --is-ancestor origin/phase3a-onboarding trial/closet-buckets` and the same for `fix/require-category`. If either fails: STOP.
4. Clash check (the old Part C): `git diff trial/closet-buckets...fix/require-category --stat`, then test the merge WITHOUT touching files: `git merge-tree --write-tree trial/closet-buckets fix/require-category`. Report: clean or which files/regions conflict, and what each side changed there.
5. Also report: does the fix's category picker (Camera/Tag Scan) offer the same 10 categories the classifier uses, and does it fit with the new sub-categories and MANUAL_CATEGORIES? Any mismatch: describe it, don't fix it.
6. STOP.

## Part B: Merge the category fix into the trial branch
1. On `trial/closet-buckets` (check `git branch --show-current`), working tree clean for tracked files.
2. `git merge --no-ff fix/require-category -m "Merge fix/require-category into trial/closet-buckets"` (asks Sharon). Conflict: rule 3.
3. `npx tsc --noEmit -p .` and `npm run build`.
4. `git diff origin/phase3a-onboarding --stat`: list every changed path. Expected areas only: `src/`, `public/folder-covers/`, `docs/`, `.claude/settings.json`, and in `api/` ONLY `classify-item.ts`, `tag-scan.ts`, `items.ts`. Nothing under `supabase/`. Anything else: STOP.
5. Report and STOP. Undo before pushing: `git revert -m 1 <merge hash>`.

## Part C: Sharon pushes and tests the merged branch (no Claude Code work)
1. GitHub Desktop: Current branch `trial/closet-buckets` → Push origin (button must name that branch; nothing ticked under `.handoff`, `CLAUDE.md`, `AGENTS.md`).
2. Quick preview check (dev Supabase): Camera and Tag Scan ask for a category when it's missing; folders and re-classify still work.

## Part D: Pull request into phase3a-onboarding (Sharon, on github.com)
1. Open https://github.com/SharonGolden1231/digital-closet → **Pull requests** → **New pull request**.
2. **base:** `phase3a-onboarding` (NOT main) ← **compare:** `trial/closet-buckets`. Double-check the base before continuing.
3. Title: "Folders, taxonomy v2, multi-item fix, re-classify, required category into Release 1". Click **Create pull request**.
4. Open the **Files changed** tab: paths only under the areas listed in Part B step 4. Nothing under `supabase/`.
5. Click **Merge pull request** → **Create a merge commit** → **Confirm merge**. Do NOT delete phase3a-onboarding. PR #4 (phase3a-onboarding → main) now contains everything; it stays a draft.

## Part E: Full test of the combined app (Sharon)
Vercel preview of `phase3a-onboarding` (Vercel → Deployments → newest Preview for that branch), dev Supabase, computer AND iPhone:
- [ ] Sign-in, invite sign-up, onboarding questions, consent screen
- [ ] Requests tab (admin): Joined label, country dropdown, approve flow
- [ ] Closet: folders with covers (women/men), empty-closet message on top, Needs review
- [ ] Add: Camera (incl. a main item with accessories), Tag Scan, Manual (new types); category required when missing
- [ ] Re-classify moves items between folders
- [ ] Remove item, Settings, change password, account deletion + cancel
- [ ] Two-account isolation: account B (private window) sees none of A's items, photos, answers or measurements; B cannot change A's item
- [ ] Storage isolation: a photo link copied from account A does not open when signed in as B after it expires, and B's item list never contains A's photo links
- [ ] 250-item closet: folders load fast, scrolling smooth, opening a folder smooth
Then update docs/go-live-checklist.md: Release 1 consolidated and tested.
Nothing goes to main before go-live day.
