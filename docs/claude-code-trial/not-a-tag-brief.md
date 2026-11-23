# Fix brief: Tag Scan accepts garment photos ("partial read")

Date: 2026-11-23. Repo: `C:\dev\digital-closet`. Branch: `trial/closet-buckets`.
Why: commit 1bce7a1 refuses a scan only when the AI returns no tag details. In Sharon's preview test, 3 garment photos (printed text, logo patch, writing underneath) all came back "partial read": the AI invented tag details, so the app-side check let them through. The fix has to be in the AI's instructions.

## What the chat already changed (uncommitted, do NOT edit)
`api/tag-scan.ts`:
- New STEP 0 in the prompt: decide first whether the image is a clothing label/care tag/hang tag. A garment photo is NOT a tag even with a slogan, logo, logo patch or text underneath. If not a tag, return only `{ "status": "not_a_tag", ... }`.
- New rule: never invent tag data; fill a field only from text actually printed on the tag.
- `not_a_tag` added to the allowed statuses; the server then returns ONLY status + a fixed message, never a classification.

## Hard rules
Same as before: only `trial/closet-buckets`; never push, main, rebase, reset, force, `git add .`; exact-path commits (`git add <paths>` then `git commit -m "..." -- <paths>`); never read `.env*`; no edits to `api/` (the chat's change is committed as-is), `supabase/`, `package*.json`, `vercel.json`, `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.handoff/`. STOP on anything unexpected.

## Step 1 (one commit, then stop)
1. `git status`: expected uncommitted: `api/tag-scan.ts` and this brief (plus untracked CLAUDE.md/AGENTS.md). Anything else: STOP.
2. Show `git diff api/tag-scan.ts`; it must match the list above and nothing else.
3. In `src/App.tsx` (smallest diff): when the Tag Scan response has `status === "not_a_tag"`, show the same yellow "This doesn't look like a clothing tag." box from 1bce7a1 (Use Camera instead / Scan a tag), with no Add to Closet, and log `NOT_A_TAG` as 1bce7a1 does. Keep 1bce7a1's existing check as a second safety net.
4. `npx tsc --noEmit -p .` and `npm run build`.
5. Commit `api/tag-scan.ts`, `src/App.tsx`, `docs/claude-code-trial/not-a-tag-brief.md` with exact paths: `fix(tag-scan): AI decides first whether the photo is a tag; never invents tag data`.
6. Report (hash, files, results, undo `git revert <hash>`) and STOP.

## Sharon's preview test (after pushing)
Vercel preview of trial/closet-buckets, dev Supabase, computer AND iPhone, Tag Scan:
- [ ] The same 3 garment photos (printed text, logo patch, writing underneath): "This doesn't look like a clothing tag", nothing saved
- [ ] 3 real tags (neck label with size, care label with fabric, hang tag): still decode and save
- [ ] A small brand-only neck label: note whether it's accepted or refused (input for the batch upload design)
- [ ] Camera with the same garment photos: still saves normally
- [ ] Log tab shows NOT_A_TAG entries for the refused scans
Nothing goes to main before go-live day.
