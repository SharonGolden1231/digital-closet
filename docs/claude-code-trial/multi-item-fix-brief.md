# Fix brief: photo with a main item plus small items

Date: 2026-11-22. Repo: `C:\dev\digital-closet`. Branch: `trial/closet-buckets`.
Why: a photo of a trench coat with accessories lying on it was rejected with "which piece do you want to add first?", and the app has no way to answer. Decision (Sharon): when one garment clearly dominates, classify it and ignore the small items; only when two or more pieces are equally prominent, ask the user to photograph one piece at a time.

## Rules
Same hard rules as taxonomy-v2-brief.md: only `trial/closet-buckets`; never push, main, reset, force, `git add .`; exact-path commits (`git add <paths>` then `git commit -m "..." -- <paths>`); never read `.env*`.
`api/classify-item.ts` was changed by the chat (uncommitted). Do NOT edit it yourself; review and commit it.

## Step 1 (one commit, then stop)
1. `git status`: expected uncommitted: `api/classify-item.ts`, `docs/go-live-checklist.md`, this brief (plus untracked CLAUDE.md/AGENTS.md). Anything else: STOP.
2. Show `git diff api/classify-item.ts`. It must only change Phase 1 rule 7 (new text "Please photograph one piece at a time.") and add one RULES line about the main garment. Anything else: STOP.
3. Check whether the app shows the AI's Phase 1 message as-is (and whether any code matches the old "which piece" text). Report it.
4. `npx tsc --noEmit -p .` and `npm run build`.
5. Commit `api/classify-item.ts`, `docs/go-live-checklist.md`, `docs/claude-code-trial/multi-item-fix-brief.md` with exact paths: `fix(classify): classify the main garment, ask for one piece only when items are equal`.
6. Report (hash, files, results, undo `git revert <hash>`) and STOP.

## Sharon's preview test (after pushing)
On the Vercel preview with dev Supabase, Camera channel, computer AND iPhone:
- [ ] Trench coat with accessories on it: classified as the coat (Coats folder), no error
- [ ] Two garments side by side, equally visible: message "I see a few items here. Please photograph one piece at a time."
- [ ] Single items still classify as before (quick regression: a T-shirt, jeans, a sweater)
- [ ] Two-account isolation: account B sees only its own items
Nothing goes to main before go-live day.
