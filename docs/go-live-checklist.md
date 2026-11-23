# Vestry: actions to close before going live (pilot wave 1)

Last updated: 2026-11-19. Source of truth: this file in the repo (docs/go-live-checklist.md); the Project copy claude/go-live-checklist.md is retired once this is committed. One list of everything that must be done before the first pilot user gets an invite. Details and history for many items are in claude/digital-closet-open-questions.md. Tick an item only when it is done in PRODUCTION (DEV does not count).

Merge gate: GitHub pull request #4 (phase3a-onboarding -> main, DRAFT, 26 commits, tested head 38f7fa4) is merged ON go-live day, after sections A-C below are done. Merging deploys to production at once; the current production database does not have the new tables. New work branches from phase3a-onboarding; when a branch passes its test, phase3a-onboarding is moved forward to it so PR #4 always carries everything tested.

## A. Name, domain and email (new 2026-11-18)
- [ ] Final app name. Decide before Apple setup: the App Store name can change later, but the iPhone app ID (bundle identifier, e.g. com.<company>.<app>) can NEVER change once the app is uploaded. Do a quick trademark and App Store name search first.
- [ ] Buy the domain for the final name (also used for the privacy policy, terms and support pages).
- [ ] Connect the domain to the Vercel project as the production address. Needed for users to reach the app at all: Vercel Authentication currently protects every address except custom domains, so pilot users on a vercel.app address would hit Vercel's login wall (seen on Sharon's iPhone and in a private window, 2026-11-18). Alternative if no domain yet: set Vercel Deployment Protection to "Preview deployments only".
- [ ] Email sending service on that domain (proposal: Resend, free up to 3,000 emails/month). Verify the domain with the 3 DNS records it gives.
- [ ] Supabase custom SMTP (Authentication > SMTP Settings): sender name = app name, sender address on the domain. Today reset emails come from "Supabase", which looks like phishing, and Supabase's built-in email only reaches the team's own addresses, a few per hour.
- [ ] Branded email templates (Authentication > Email Templates): reset password, confirm email. Claude drafts the text once the name is final.
- [ ] Request-access approval email sent automatically ("You're in" + code + link), code still shown to Sharon as a backup. Today no email is sent: Sharon copies the message and sends it herself. Build once the email service exists.
- [ ] Rename "Digital Closet" in the app once the name is final.

## B. Production setup (in order)
- [ ] New Supabase Pro project in a US region (the current production project "Digital Closet production" is in Tokyo, ap-northeast-1, and has no users).
- [ ] Apply ALL migration files in supabase/migrations/ to the new project, in filename order, starting from 20261013130000_phase1_foundation.sql (13 files as of 2026-11-18, the last being 20261118150000_access_requests.sql). main never received phases 1, 2a, 2b, 3a and 3b, so nothing can be assumed to exist.
- [ ] Run the preview test against production on an iPhone as well as a computer (invite sign-up, request access + approve + joined label, consent, intro questions, two-account check, delete + cancel, purge dry run) before any invite is sent.
- [ ] Production environment variables in Vercel: own CRON_SECRET (separate from preview), own CONSENT_HASH_KEY (new, kept in the password manager; losing it makes archived consent unmatchable), Supabase URL and keys of the NEW project, Anthropic key with a spend limit, PostHog key for production.
- [ ] Supabase Authentication > URL Configuration: Site URL and Redirect URLs for the production address (password reset links land there).
- [ ] Sign-ups OFF in Supabase (accounts only through invite codes). Stays off for good: no "first N users without a code".
- [ ] Sharon's production account (sharongol1231@gmail.com): admin flag on, email confirmed, 3 personal invite codes issued. The only account that gets codes by hand.
- [ ] Merge pull request #4 (Sharon, in GitHub), then confirm the production deploy is ready.
- [ ] First wave: Sharon creates founder codes with admin-cap or approves waiting-list requests, and sends the codes personally.
- [ ] Vercel Pro (the free plan is for non-commercial use).
- [ ] Purge dry run on production after deploy; confirm the nightly job runs.
- [ ] Rate limits on login and AI routes (request-access already limited to 5 per network per hour); backups on.
- [ ] Old Tokyo production project: pause or delete after the new one is live (it holds no users).

## C. Legal and store (with the lawyer)
- [ ] Privacy policy and terms published on the domain (AI use, analytics, measurements, consent archive retention, waiting-list emails of non-users, subprocessors: Supabase, Vercel, Anthropic, Firecrawl, PostHog EU, email provider).
- [ ] Waiting list: how long to keep emails of people who were declined or never joined (proposal: delete after 12 months; Sharon can delete any request at once today). The form says "we only use your email to send you an invite; ask us to remove it at any time": needs a support address once the domain exists.
- [ ] Review the AI consent wording and the body measurements consent wording in the app.
- [ ] Apple Developer enrollment (individual or company decided first).
- [ ] App Store privacy "nutrition label", demo login for Apple's reviewer, screenshots.
- [ ] Sign in with Apple alongside Google (store requirement once Google sign-in exists).

## D. Pilot operations
- [ ] First wave size (release cap) and the rule for raising it (Sharon approves).
- [ ] Monthly AI budget and measured cost per onboarded user.
- [ ] Support channel: where users report problems and who answers.
- [ ] Error monitoring and a daily cost report.
- [ ] Pilot dashboard in PostHog for the success criteria (30+ items in 7 days, recommendation + feedback in week 2, positive feedback share, week-3 return). Filter out Sharon's and any test accounts.
- [ ] "New version available — tap to refresh" notice, so fixes reach people who keep the app open (found 2026-11-18: an open tab keeps running the old version after a release). Small; before wave 1.
- [ ] Admin Invites view: every invite code (founder codes from admin-cap, approved requests, personal invites between users) with who created it, when, used or not, and by which account. Needed once codes start moving between users. Today only the Requests tab shows codes (approved requests only).
- Note for Sharon: in the Requests tab use Decline for a "no"; Delete removes the request and its email permanently (use it when someone asks to be removed).

## E. Product work still to ship before wave 1
- [ ] Batch upload (tag + camera), perfect-fit flag, seconds-per-item tracking. Next: design proposal for Sharon before code.
- [ ] Home screen looks from day one + always-on stylist chat.
- [ ] Tag-to-picture search (after the lawyer answers on web images).
- [ ] Recommendations from the real closet, "wear this", wear log, outfit feedback.
- [ ] iPhone app wrapper (Capacitor) and TestFlight build.

## In progress (not yet tested on preview)
- 2026-11-19: Closet "By category" view (Claude Code trial), branch trial/closet-buckets: 7 commits, type check + build pass, nothing under api/ or supabase/. Replaces the old Folders view. Puffer Jacket -> Coats, Blazer -> Jackets, unplaced items -> Needs review at the top. NOT browser-tested yet. Branch problem: it was created from phase3b-request-access (74df24e), which is 2 commits BEHIND phase3a-onboarding (missing bfb5d13 Joined label and 38f7fa4 country dropdown). Must take in phase3a-onboarding before the preview test, then the preview checklist in docs/claude-code-trial/bucket-view-brief.md incl. two-account check. Then fill the trial log.
- 2026-11-19: fix/require-category (1fe31d4): Camera/Tag Scan ask for a category when it is missing; no more silent "Top". Same branch problem (from phase3b-request-access). Not browser-tested.
- Taxonomy v2 decisions (Sharon 11-22): categories unchanged; new sub-categories Sweater, Cardigan, Knit Vest (Top) and Joggers (Bottom), also in the Manual Add list; folders Knitwear & Cardigans (sweater coat goes here) and Sweatshirts & Joggers (any hoodie, incl. zip hoodie labeled Outerwear). Brief: docs/claude-code-trial/taxonomy-v2-brief.md. Classifier prompts changed, so the preview test includes a regression check on old item types.
- 2026-11-22: taxonomy v2 + folder fixes on trial/closet-buckets passed Sharon's preview test (new folders, regression check, Manual Add, empty closet), except two findings:
  - Multi-item photo (trench coat with accessories on it) got "which piece do you want to add first?" with no way to answer. Decision: classify the main garment and ignore small items on it; only when 2+ pieces are equally prominent, ask to photograph one at a time. Prompt fix in api/classify-item.ts, brief docs/claude-code-trial/multi-item-fix-brief.md. A real "pick which item" choice belongs to batch upload.
  - Duplicates: scanning the same item twice saves it twice. Decision: don't block (people own identical items); detect and ask "You already have this, add another?". Needs the tag reference/barcode stored per item (database column), so it is designed inside the batch upload proposal.
- 2026-11-23 DONE on trial/closet-buckets (not yet in PR #4): re-classify an item. "Change type" in the item panel, same picker as Manual Add, item moves to its new folder, AI original answer kept for override-rate tracking, PostHog item_reclassified (categories only). Server: PATCH in api/items.ts with the user's own token; existing owner-only update policy, no migration. Sharon's tests passed: two-account (B cannot change A's item), signed-out refused, move + reload, change and back, emoji update, cancel, iPhone picker, PostHog event without names. api/ lock restored afterwards (.claude/settings.json).
- NEXT (recommended before batch upload): consolidate Release 1. Move phase3a-onboarding forward to include trial/closet-buckets (and fix/require-category after the Part C clash check), then one full test of the combined app on preview + DEV: two-account isolation, storage isolation, 250-item load test, iPhone. Then batch upload design proposal (incl. duplicate detection via stored tag reference/barcode, and picking an item from multi-item photos).
- After the trial: delete the dead Folders code in ClosetGrid; check taxonomy.ts rules still used by the stylist OutfitBoard.

## Done (tested on preview + DEV, waiting for go-live)
- 2026-11-18: Requests tab extras: "Joined" / "Approved · not joined yet" label, country dropdown on the request form (most common first), code box closes after copy, on filter change or when the person joins. Server tests and Sharon's preview test passed. Test data removed. Included in PR #4.
- 2026-11-18: Phase 3b request access (waiting list): DEV database and server tests passed; Sharon's preview test passed (request form, all answers visible to admin, approve shows the code, joining with the code works, Requests and Logs tabs hidden for a normal user). Included in PR #4.
- 2026-11-18: Phase 3a onboarding (invite sign-up, AI consent, intro questions, Settings, forgot/change password, invite bar, admin-only Logs, analytics). Sharon's preview test passed.
- 2026-11-17: Phase 2b accounts (invites, cap, deletion lock, purge with photo deletion, keyed-hash consent archive). Preview test passed.

## Testing notes
- Preview addresses are protected by Vercel: a private window or a phone must sign in to Vercel once (Sharon's usual method) before the app loads. This is not the app's login.
- Normal browser windows share one app login; use a private window or a second browser (Edge) for the second test person.
- After a new build, reload open windows with Ctrl+F5, or they keep running the old version.

## Decided
- 2026-11-18: No invite-code backfill; earlier accounts are test accounts. Production has no users today.
- 2026-11-18: Only Sharon's admin account gets 3 personal invite codes by hand. The first, net-new users come in through founder codes or approved waiting-list requests.
- 2026-11-18: No "first N users without a code" (would require public sign-ups and gives up control over who joins). Request access (waiting list with admin approval) instead.
- 2026-11-18: Pull request #4 stays a draft until go-live day; new work branches from the newest tested branch until then.
