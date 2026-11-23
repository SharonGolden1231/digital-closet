# Brief: change the category on the confirm screen (Camera and Tag Scan) + mark guesses

Date: 2026-11-23. Repo: `C:\dev\digital-closet`. Branch: `trial/closet-buckets`.
Why: after a scan, the confirm screen shows "Add to Closet" but the category and type can only be changed when the scan was "partial". A wrong category (e.g. a trench coat decoded as Tailored Trousers) gets saved as is. Tag Scan today does no online lookup, so its category is a guess unless the label prints the garment type.

## What the chat already changed (uncommitted, do NOT edit)
`api/tag-scan.ts`: the AI must return `classification.category_source` = "label" only when text on the tag names the garment type, otherwise "guess". The server forces anything that isn't "label" to "guess".

## Decisions (Sharon, 2026-11-23)
| # | Decision |
|---|---|
| C1 | On the confirm screen of BOTH Camera and Tag Scan, the category and type are always shown with a "Change" control that opens the same picker as Add → Manual / Change type (MANUAL_CATEGORIES), preselected with the AI's answer. Not only on partial results |
| C2 | Tag Scan with `category_source: "guess"`: show a small note "Low confidence: please confirm the category" next to the category (never the word "guessed" on screen). Camera results show no note (the photo shows the garment) |
| C3 | Saving uses whatever the user confirmed. If the user changed it, it counts the same as a re-classify for analytics: PostHog `category_changed_before_save` with from/to category and type and the channel (camera/tag), no item names |
| C4 | Existing rules stay: a missing category still requires a pick before Add (fix/require-category); not-a-tag still blocks saving |

## Hard rules
Only `trial/closet-buckets`; never push, main, rebase, reset, force, `git add .`; exact-path commits (`git add <paths>` then `git commit -m "..." -- <paths>`); never read `.env*`; don't edit `api/` (the chat's change is committed as-is), `supabase/`, `package*.json`, `vercel.json`, `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.handoff/`. STOP on anything unexpected. After each step: `npx tsc --noEmit -p .` and `npm run build`, report (files, +/-, hash, undo `git revert <hash>`), wait for "go".

## Step 0 (read-only)
`git status` (expected uncommitted: `api/tag-scan.ts`, this brief). Show `git diff api/tag-scan.ts` (must only add category_source as above). Find the Camera and Tag Scan confirm screens and the existing category picker from fix/require-category; propose the smallest way to reuse it. STOP.

## Step 1
Implement C1–C4, reusing the existing picker component (new component in `src/components/` only if needed). Commit `api/tag-scan.ts`, the changed `src/` files and this brief (exact paths). STOP.

## Sharon's preview test (after pushing)
Vercel preview, dev Supabase, computer AND iPhone:
- [ ] Tag Scan, the trench coat tag: shows "Low confidence: please confirm the category"; change to Outerwear → Trench Coat; saved item is in Coats
- [ ] Camera, any item: "Change" is available; changing it before saving puts the item in the chosen folder
- [ ] Correct result: tapping Add without changes saves as before
- [ ] Missing category still forces a pick; a garment photo in Tag Scan is still refused
- [ ] PostHog: `category_changed_before_save` appears only when changed, no item names
- [ ] Two-account isolation: account B sees only its own items
Nothing goes to main before go-live day.
