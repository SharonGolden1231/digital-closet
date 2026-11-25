# Fix brief part 2: read the size on any brand's label (fix/tag-size)

Date: 2026-11-25. Branch: `fix/tag-size` (already has 3c5a32f: Size/Fits lines + cm/in switch).

## Decision (Sharon, 2026-11-25)
Users will scan dozens of brands. No brand-specific size rules in the app (so NOT the proposed Inditex "/S" rule). The AI must work out each label's structure and return the size wherever and however it is printed.

## What the chat already changed (uncommitted, do NOT edit)
`api/tag-scan.ts`: a brand-independent SIZE RULE. New fields in `extracted`:
- `size_printed` (main size exactly as printed, e.g. "S", "38", "W32 L34"), `size_system` (letter, EU, US, UK, IT, FR, MX, JP, waist_length, kids, shoe, other), `size_equivalents` (other printed sizes, [{system, value}]), `size_evidence` (the exact label text it came from)
- `body_fit` ({height_cm, chest_cm} or {height_cm, waist_cm}) from body codes like 165/84A; the code itself stays in `size_raw`
- a size suffix on a reference line (e.g. ".../S") counts as a printed size; a printed size always wins; nothing is guessed

## Hard rules
Same as tag-size-brief.md: only `fix/tag-size`; never main, push, rebase, reset, force, `git add .`; exact-path commits; never read `.env*`; don't edit `api/`, `supabase/`, `package*.json`, `vercel.json`, `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.handoff/`. STOP on anything unexpected.

## Step 1 (one commit, then stop)
1. Show `git diff api/tag-scan.ts`; it must only change the size wording/rule and add the new fields above.
2. `src/lib/sizeLabel.ts` / App.tsx: the Size line uses `size_printed` (with its system when not a letter size, e.g. "EU 38", "W32 L34"); other printed sizes may be listed small ("Also: US 6 · UK 10"). The Fits line uses `body_fit` (fall back to parsing `size_raw` only if `body_fit` is empty). No brand-specific rules. Keep the cm/in switch as built.
3. `npx tsc --noEmit -p .` and `npm run build`.
4. Commit `api/tag-scan.ts`, the changed `src/` files and this brief (exact paths). Report and STOP.

## Sharon's preview test (computer AND iPhone)
- [ ] Zara trench coat: "Size S" and "Fits height 165 cm · chest/bust 84 cm" (and in inches)
- [ ] At least 5 other brands with different label styles (e.g. H&M, Uniqlo, Levi's W/L, Nike, a shoe, a kids item if available): size shown as printed, nothing invented when no size is printed
- [ ] A label with a multi-country size table: main size plus "Also: ..."
- [ ] Two-account isolation: account B sees only its own items
Sizes are still display-only here; saving them on the item is the separate "sizes and fit" design (docs/design/sizes-and-fit.md).
Nothing goes to main before go-live day.
