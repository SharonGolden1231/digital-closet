# Fix brief: printed size wins; steadier AI answers

Date: 2026-11-23. Repo: `C:\dev\digital-closet`.
Branch: NEW branch `fix/tag-size` from `origin/phase3a-onboarding` (the consolidated Release 1, PR #5 merged). Never from trial/closet-buckets, never main.

## Why (Sharon's Part E test)
- The Zara trench coat tag prints size S, but the app saved M. Cause: the Tag Scan instructions contained a fixed conversion "CH 165/84A = M" that overrode the printed size. Published size charts don't agree on these height/bust codes, so the table can't be trusted.
- The same tag gave different results on iPhone (Trench Coat) and computer (Chinos). The label doesn't state the garment type, so both were guesses; the AI also runs with default randomness, so even similar photos can produce different guesses.

## What the chat already changed (uncommitted, do NOT edit)
- `api/tag-scan.ts`: the "Chinese sizing used by Zara/Mango" line is replaced by a SIZE RULE: a printed letter or European size always wins; never convert Chinese height/bust codes to a letter size (keep them in size_raw only). Adds `temperature: 0`.
- `api/classify-item.ts`: adds `temperature: 0` (Camera), for the same consistency reason. No prompt change.

## Hard rules
Never main, push, rebase, reset, force, `git add .`. Exact-path commits (`git add <paths>` then `git commit -m "..." -- <paths>`). Never read `.env*`. Don't edit `api/` (commit the chat's changes as-is), `supabase/`, `package*.json`, `vercel.json`, `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.handoff/`. STOP on anything unexpected.

## Step 1 (then stop)
1. `git status`: expected uncommitted: `api/tag-scan.ts`, `api/classify-item.ts`, this brief (plus untracked CLAUDE.md/AGENTS.md). Anything else: STOP.
2. Show `git diff api/` and confirm it matches the list above exactly.
3. `git fetch origin`, then `git switch -c fix/tag-size origin/phase3a-onboarding` (asks Sharon; the uncommitted changes come along). Confirm with `git branch --show-current`.
4. Check that the app does not compute its own size conversion from codes like 165/84A anywhere in `src/` (report; don't change).
5. `npx tsc --noEmit -p .` and `npm run build`.
6. Commit `api/tag-scan.ts`, `api/classify-item.ts`, `docs/claude-code-trial/tag-size-brief.md`: `fix(scan): printed size wins over code tables; temperature 0 for steadier results`.
7. Report (hash, files, results, undo `git revert <hash>`) and STOP. Sharon publishes the branch from GitHub Desktop.

## Sharon's preview test (Vercel preview of fix/tag-size, dev Supabase)
- [ ] Trench coat tag on iPhone AND computer, twice each: size S every time
- [ ] Same tag: note the category each time. Expect "Low confidence: please confirm the category" unless the label names the type. Results should now agree far more often; exact agreement is not guaranteed until the reference lookup exists
- [ ] A tag that prints only a number size (e.g. EU 38): saved as printed
- [ ] Camera: a few items classify as before
- [ ] Two-account isolation: account B sees only its own items
After it passes: pull request `fix/tag-size` → `phase3a-onboarding` (NOT main), same checks as PR #5. Nothing goes to main before go-live day.
