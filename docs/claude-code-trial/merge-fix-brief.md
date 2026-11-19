# Fix brief: bring trial and fix branches up to phase3a-onboarding

Date: 2026-11-19. Repo: `C:\dev\digital-closet`.
Why: `trial/closet-buckets` and `fix/require-category` were created from `phase3b-request-access` (74df24e). The newest tested branch is `phase3a-onboarding` (38f7fa4), which adds two commits: bfb5d13 (Joined label) and 38f7fa4 (country dropdown, code box closes). The go-live rule is: new work branches from phase3a-onboarding. Both branches must take in those two commits before any preview test.

## Hard rules
1. Never commit, merge into or switch to work on `main`. Never touch `phase3a-onboarding` or `phase3b-request-access`. We merge INTO the trial/fix branches only.
2. Never push. Sharon pushes from GitHub Desktop.
3. Merge only with `--no-ff`, only from `origin/phase3a-onboarding`. No rebase, no reset, no force.
4. If a merge reports ANY conflict: STOP. List the conflicted files and what each side changed, in plain words. Don't resolve, don't abort, until Sharon decides.
5. Don't edit `api/`, `supabase/`, `package.json`, `package-lock.json`, `vercel.json`, `.claude/`, `CLAUDE.md`, `AGENTS.md` or `.handoff/`. Never read `.env*`.
6. STOP after each part and report: the branch, new commit hashes, the type check and build results, and the undo command. Wait for "go".

## Part A: trial/closet-buckets
1. `git status`. The ONLY tracked file allowed to show as modified is `.claude/settings.json` (Sharon updated it so merges ask her instead of being blocked). Anything else modified: STOP. Untracked files like `docs/go-live-checklist.md`, `.claude/settings.local.json` and `.handoff/` are expected.
2. `git fetch origin`.
3. Switch to `trial/closet-buckets` if not already on it. Confirm with `git branch --show-current`.
4. `git merge --no-ff origin/phase3a-onboarding -m "Merge phase3a-onboarding into trial/closet-buckets (take in bfb5d13, 38f7fa4)"`.
5. Check: `git merge-base --is-ancestor 38f7fa4 HEAD` must succeed. Also confirm `git diff origin/phase3a-onboarding --stat` shows ONLY the trial files (closetBuckets.ts, itemStyle.ts, the closet components, App.tsx, the trial brief, .claude/settings.json) and nothing under `api/` or `supabase/`.
6. `npx tsc --noEmit -p .` and `npm run build`. Both must pass.
7. Commit the checklist and the updated rules: `git add docs/go-live-checklist.md docs/claude-code-trial/merge-fix-brief.md .claude/settings.json` (never `git add .`, never `.claude/settings.local.json`), then commit with message `docs: go-live checklist now kept in the repo; merge-fix brief`.
8. Point the branch at its own remote, so GitHub Desktop pushes to the right place: `git branch --set-upstream-to=origin/trial/closet-buckets` (asks Sharon).
9. Report and STOP. Undo, if needed before pushing: `git revert -m 1 <merge hash>`.

## Part B: fix/require-category (only after Sharon says "go")
1. `git status` must be clean for tracked files. Switch to `fix/require-category` and confirm. Note: this branch doesn't have `.claude/settings.json`, so the file disappears from disk after the switch. That's expected; the same rules stay active from `.claude/settings.local.json`. Before merging, confirm that `.claude/settings.local.json` still exists.
2. `git merge --no-ff origin/phase3a-onboarding -m "Merge phase3a-onboarding into fix/require-category (take in bfb5d13, 38f7fa4)"`.
3. Same checks as A5–A6. The diff against `origin/phase3a-onboarding` should show only the Add-screen and category changes from 1fe31d4.
4. This branch has never been published, so there's no upstream to set. Sharon publishes it in GitHub Desktop.
5. Report and STOP.

## Part C: does the trial clash with the fix? (read-only, no commits)
Both branches change `src/App.tsx`. Without merging anything, report whether they touch the same lines: `git diff trial/closet-buckets fix/require-category --stat` plus a look at the App.tsx regions. Tell Sharon whether they will merge cleanly later, and in which order.

## After Claude Code finishes (Sharon)
- In GitHub Desktop, push `trial/closet-buckets` (the button must name that branch, never main) and publish `fix/require-category`.
- Preview tests on the Vercel preview with dev Supabase, on a computer AND an iPhone: the checklist in `bucket-view-brief.md`, plus a quick check that the Requests tab still shows "Joined" and the country dropdown (proves the merge took). Run the two-account isolation test with a second account in a private window.
- Only after both pass: move `phase3a-onboarding` forward to the tested branch (a separate decision). Nothing goes to main before go-live day.
