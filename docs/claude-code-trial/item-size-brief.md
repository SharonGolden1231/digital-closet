# Brief: save item size and tag measurements (Phase 1, sizes-and-fit)

Date: 2026-11-25. Design: `docs/design/sizes-and-fit.md`.
Branch: NEW `feat/item-size`, created from `origin/phase3a-onboarding` AFTER `fix/tag-size` has passed its test and been merged into phase3a-onboarding (this brief uses its size_printed / body_fit fields).

## Decisions (Sharon, 2026-11-25)
| # | Decision |
|---|---|
| S1 | Every item saves its label size and the tag's measurements; the item card shows them, e.g. "Size S · Fits height 165 cm · chest/bust 84 cm" with the same cm/in switch |
| S2 | Saved and shown always; comparing an item with the user's own body only when the body-measurements consent is granted (not built in this brief) |
| S3 | The user can correct size and measurements on the item card; a correction sets the source to "user" |
| S4 | No brand-specific rules anywhere; values come from the tag scan (source "label") or the user |
| S5 | Measurement history and height are Phase 2, a separate brief right after this one, before wave 1 |

## Database (prepared by the chat; do NOT edit)
`supabase/migrations/20261125120000_item_sizes.sql` adds to `closet_items`: `size_system`, `size_equivalents`, `size_evidence`, `size_source`, `body_code_raw`, `fit_height_cm`, `fit_chest_cm`, `fit_waist_cm`, `fit_hip_cm`, `fit_source`, with range checks, and grants insert/update on them. The existing `size` column holds the size as printed. No policy changes: owner-only row access already covers new columns. Sharon applies it to DEV only (steps below); production gets it on go-live day with all other migrations.

## Hard rules
1. Only `feat/item-size`. Never main, push, rebase, reset, force, `git add .`. Exact-path commits.
2. Server: only `api/items.ts` (asks Sharon each time). Never other `api/` files, `supabase/` (the migration is committed as-is), `package*.json`, `vercel.json`, `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.handoff/`. Never read `.env*`. No Supabase or Vercel commands.
3. All reads/writes use the signed-in user's own token (never the service key). Server validates every value: size text ≤ 20 chars, size_system from the allowed list, equivalents ≤ 10 entries of short strings, evidence ≤ 200, cm values within the database ranges, sources from the allowed lists.
4. STOP after each step; report files, +/-, hash, `npx tsc --noEmit -p .` and `npm run build` results, undo `git revert <hash>`. Wait for "go".

## Step 0 (read-only)
Create the branch: `git fetch origin`, `git switch -c feat/item-size origin/phase3a-onboarding` (asks Sharon). Then ask Sharon to do step 0 of "put the migration in place" below. `git status`; confirm branch base contains the fix/tag-size merge; show the migration file; find where items are created (Camera, Tag Scan, Manual) and the item card; confirm Sharon has applied the migration to DEV (ask her). STOP.

## Step 1: server (`api/items.ts`)
POST saves the new fields (Tag Scan: from size_printed/size_system/size_equivalents/size_evidence/size_raw/body_fit with source "label"; Camera/Manual: empty unless the user enters a size). GET returns them. PATCH accepts size/measurement corrections (source "user") alongside the existing type change. Commit `api/items.ts`, the migration file and this brief.

## Step 2: screens
Send the fields when saving; item card shows Size + Fits with the cm/in switch; "Edit size" lets the user correct size and cm values (entered in cm or inches, stored in cm). Commit.

## Sharon: put the migration in place and apply it to DEV (after Claude Code creates the branch, before Step 1 is tested)
In PowerShell:
0. `Copy-Item "C:\dev\digital-closet\docs\claude-code-trial\20261125120000_item_sizes.sql.draft" "C:\dev\digital-closet\supabase\migrations\20261125120000_item_sizes.sql"`, then `cd C:\dev\digital-closet`
1. `npx supabase projects list`: the linked project (marked ●) must be "Digital Closet dev/staging" (ref bkjcipqkmohpjezkybvh). If it's production: STOP.
2. `npx supabase migration list`: only `20261125120000` should show as local-only.
3. `npx supabase db push`, answer Y only if it lists just that one migration.

## Sharon's preview test (computer AND iPhone)
- [ ] Tag Scan Zara trench coat → save → item card shows "Size S · Fits height 165 cm · chest/bust 84 cm"; cm/in switch works
- [ ] 3+ other brands: sizes saved as printed; no invented values
- [ ] Edit size on a card → saved after reload, marked as your correction
- [ ] Camera and Manual items: no size unless entered
- [ ] Two-account isolation: account B can't read or change A's sizes (browser console PATCH test as before → 404)
- [ ] Invalid values (e.g. height 999) are refused
Then PR `feat/item-size` → `phase3a-onboarding` (NOT main). Nothing goes to main before go-live day.
