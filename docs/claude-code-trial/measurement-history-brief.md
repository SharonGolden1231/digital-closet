# Brief: body measurement history + height and shoulders (Phase 2, sizes-and-fit)

Date: 2026-11-26. Design: `docs/design/sizes-and-fit.md`.
Branch: NEW `feat/measurement-history` from `origin/phase3a-onboarding` (now includes item sizes, PR #7).

## Decisions (Sharon, 2026-11-26)
| # | Decision |
|---|---|
| M1 | Every save of measurements adds a dated entry; entries are kept unchanged (never edited). The current values stay in `body_measurements` as today |
| M2 | New fields: height and shoulders (current values and history) |
| M3 | Nothing of the history is shown to the user in this version (stored for size tracking and styling) |
| M4 | Same rules as today: saving needs the body-measurements consent; withdrawing it deletes the current values AND all history entries; account deletion removes everything |

## Database (prepared by the chat; do NOT edit)
`docs/claude-code-trial/20261126120000_body_measurement_history.sql.draft` → Sharon copies it to `supabase/migrations/20261126120000_body_measurement_history.sql` after the branch exists. It adds `height_cm` (100–230) and `shoulder_cm` (30–70) to `body_measurements`, creates `body_measurement_entries` (owner-only, consent trigger reused, insert/select/delete only, no update), and copies each user's current values as their first entry.
Apply to DEV by hand in the SQL Editor (not `db push`: DEV's migration history is out of step, see checklist).

## Hard rules
1. Only `feat/measurement-history`. Never main, push, rebase, reset, force, `git add .`. Exact-path commits (`git add <paths>` then `git commit -m "..." -- <paths>`).
2. Server: only `api/profile.ts` (asks Sharon each time). Never other `api/` files, `supabase/` (commit the migration as-is), `package*.json`, `vercel.json`, `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.handoff/`. Never read `.env*`. No Supabase or Vercel commands.
3. User's own token only (never the service key). Server validates height 100–230 cm and shoulders 30–70 cm like the existing fields.
4. STOP after each step; report files, +/-, hash, `npx tsc --noEmit -p .` and `npm run build`, undo `git revert <hash>`. Wait for "go".

## Step 0 (read-only)
Create the branch: `git fetch origin`, `git switch -c feat/measurement-history origin/phase3a-onboarding` (asks Sharon). Ask Sharon to copy the migration into place and run it on DEV. Then report: how `api/profile.ts` saves, reads and deletes measurements today; where the onboarding and Settings measurement forms are; and confirm with Sharon that the DEV check below passed. STOP.

## Step 1: server (`api/profile.ts`)
- Add `height_cm` and `shoulder_cm` to the accepted fields with their ranges.
- On save (consent given): keep updating `body_measurements` as today AND insert one row into `body_measurement_entries` with the same values (measured_at = now).
- On withdrawal: delete all `body_measurement_entries` for the user as well as the `body_measurements` row; if either delete fails, return the existing error.
- GET: unchanged apart from returning height and shoulders in the current values. History is not returned to the app (M3).
Commit `api/profile.ts`, the migration file and this brief.

## Step 2: screens
Onboarding and Settings measurement forms get Height and Shoulders, in cm or inches like the other fields (stored in cm). No history display. Commit.

## Sharon: put the migration in place and check DEV
1. PowerShell: `Copy-Item "C:\dev\digital-closet\docs\claude-code-trial\20261126120000_body_measurement_history.sql.draft" "C:\dev\digital-closet\supabase\migrations\20261126120000_body_measurement_history.sql"`
2. supabase.com → the project whose address contains `bkjcipqkmohpjezkybvh` (Digital Closet dev/staging) → SQL Editor → New query → paste the file → Run → "Success. No rows returned".
3. New query, run: `select count(*) from public.body_measurement_entries;` It should equal the number of users who had measurements saved (often 1-3 test accounts).

## Sharon's preview test (computer AND iPhone)
- [ ] Settings: Height and Shoulders appear, in cm and in inches; saved values survive a reload
- [ ] Save measurements twice with different values; then (chat checks on DEV) two dated entries exist for that account
- [ ] Height 300 or shoulders 5 refused
- [ ] Withdraw the measurements consent: current values gone; (chat checks) no history entries left for that account
- [ ] Without consent, saving measurements is refused
- [ ] Two-account isolation: account B can't read A's measurements or entries
Then PR `feat/measurement-history` → `phase3a-onboarding` with Create a merge commit, then restore `settings-locked.json`. Nothing goes to main before go-live day.
