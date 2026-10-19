// Vestry / Digital Closet: database guard test (Phase 1)
// Run from the repo root:  node scripts/db-guards-test.mjs
//
// Proves the rules that live INSIDE the database hold even for server code:
// consent trigger, image/emoji/path rules, no auto-accepted matches,
// the 14-day account-deletion grace period (lock + purge lists),
// and that deleting a user removes all of their rows.
//
// SAFETY: refuses to run unless the URL in .env.local is the DEV project.
// Creates two temporary users and test rows in dev, then removes them.
// Never prints key values.

import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const DEV_REF = 'bkjcipqkmohpjezkybvh';

function die(msg) {
  console.error('\nSTOPPED: ' + msg + '\n');
  process.exit(2);
}

if (!existsSync('.env.local')) die('.env.local not found. Run this from the repo root (C:\\dev\\digital-closet).');
const env = {};
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}
function pickOne(label, re) {
  const names = Object.keys(env).filter((k) => re.test(k) && env[k]);
  const values = [...new Set(names.map((k) => env[k]))];
  if (values.length === 0) die(`No variable for the Supabase ${label} found in .env.local.`);
  if (values.length > 1) die(`More than one different value for the Supabase ${label}: ${names.join(', ')}.`);
  console.log(`Using ${label} from variable: ${names[0]}`);
  return values[0];
}
const url = pickOne('URL', /SUPABASE.*URL/i);
const service = pickOne('service-role/secret key', /(SERVICE_ROLE|SECRET_KEY)/i);
const anon = pickOne('anon/public key', /(ANON|PUBLISHABLE)/i);
if (!url.includes(DEV_REF)) die('The Supabase URL in .env.local is NOT the dev project. Refusing to run.');
console.log('Dev-project guard passed.\n');

const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
let pass = 0;
let fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (detail ? '   -> ' + detail : '')); }
}
const rejects = async (name, q, re) => {
  const r = await q;
  check(name, !!r.error && (!re || re.test(r.error.message)),
        r.error ? `rejected for the wrong reason: ${r.error.message}` : 'was accepted but should have been rejected');
};
const accepts = async (name, q) => {
  const r = await q;
  check(name, !r.error, r.error?.message);
  return r.data;
};

const stamp = Date.now();
const users = [];
const catalogIds = [];
let aId = null;

const password = randomUUID() + 'Aa1!';
const emails = {};
const mkClient = (key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function newUser(tag) {
  const email = `guard-test-${tag}-${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error('createUser failed: ' + error.message);
  users.push(data.user.id);
  emails[data.user.id] = email;
  return data.user.id;
}

async function login(id) {
  const c = mkClient(anon);
  const s = await c.auth.signInWithPassword({ email: emails[id], password });
  if (s.error) throw new Error('sign-in failed: ' + s.error.message);
  return c;
}

try {
  const A = await newUser('a');
  const B = await newUser('b');
  aId = A;

  console.log('--- 1. Selfie consent guard ---');
  const c1 = await admin.from('consent_records').insert({ user_id: A, consent_type: 'selfie_analysis', policy_version: 'test', granted: false }).select().single();
  await rejects('color profile refused when consent was never granted',
    admin.from('color_profiles').insert({ user_id: A, skin_tone: 'x', consent_record_id: c1.data.id }), /consent/i);
  const c2 = await admin.from('consent_records').insert({ user_id: A, consent_type: 'selfie_analysis', policy_version: 'test', granted: true }).select().single();
  await accepts('color profile accepted once consent is granted',
    admin.from('color_profiles').insert({ user_id: A, skin_tone: 'x', consent_record_id: c2.data.id }));
  await admin.from('consent_records').insert({ user_id: A, consent_type: 'selfie_analysis', policy_version: 'test', granted: false });
  await rejects('color profile cannot be changed after consent is withdrawn',
    admin.from('color_profiles').update({ skin_tone: 'y' }).eq('user_id', A), /consent/i);
  await rejects("another user's consent cannot back a color profile",
    admin.from('color_profiles').insert({ user_id: B, skin_tone: 'x', consent_record_id: c2.data.id }));
  await rejects('unknown consent type refused',
    admin.from('consent_records').insert({ user_id: A, consent_type: 'marketing', policy_version: 'test', granted: true }));

  console.log('\n--- 2. Item rules (web image, emoji, archetype) ---');
  const cat = await admin.from('product_catalog').insert({ brand: 'GUARD-TEST', style_code: String(stamp) }).select().single();
  catalogIds.push(cat.data.id);
  const base = { user_id: A, ingestion_channel: 'manual' };
  await rejects('web image refused without a catalog match',
    admin.from('closet_items').insert({ ...base, display_image_source: 'web_catalog' }));
  await rejects('web image refused when the match is not user-confirmed',
    admin.from('closet_items').insert({ ...base, display_image_source: 'web_catalog', catalog_id: cat.data.id, match_status: 'no_match' }));
  const goodItem = await accepts('web image accepted with a user-confirmed match',
    admin.from('closet_items').insert({ ...base, display_image_source: 'web_catalog', catalog_id: cat.data.id, match_status: 'confirmed' }).select().single());
  await rejects('emoji refused when marked complete',
    admin.from('closet_items').insert({ ...base, display_image_source: 'emoji', emoji: 'x', category: 'tops', color_hex: '#112233', is_complete: true }));
  await rejects('emoji refused without a color swatch',
    admin.from('closet_items').insert({ ...base, display_image_source: 'emoji', emoji: 'x', category: 'tops' }));
  await rejects('emoji refused without a category',
    admin.from('closet_items').insert({ ...base, display_image_source: 'emoji', emoji: 'x', color_hex: '#112233' }));
  await accepts('emoji accepted with category, color and incomplete flag',
    admin.from('closet_items').insert({ ...base, display_image_source: 'emoji', emoji: 'x', category: 'tops', color_hex: '#112233', is_complete: false }));
  await rejects('archetype image refused without an archetype',
    admin.from('closet_items').insert({ ...base, display_image_source: 'archetype' }));
  await rejects('invalid color value refused',
    admin.from('closet_items').insert({ ...base, display_image_source: 'user_original', color_hex: 'red' }));

  console.log('\n--- 3. Catalog images need provenance ---');
  await rejects('catalog image refused without source and retrieval time',
    admin.from('product_catalog').insert({ brand: 'GUARD-TEST', style_code: stamp + 'b', image_url: 'https://example.com/a.jpg' }));
  const c = await accepts('catalog image accepted with provenance',
    admin.from('product_catalog').insert({ brand: 'GUARD-TEST', style_code: stamp + 'c', image_url: 'https://example.com/a.jpg', source_url: 'https://example.com/p', retrieved_at: new Date().toISOString() }).select().single());
  if (c) catalogIds.push(c.id);

  console.log('\n--- 4. Image records ---');
  const itemId = goodItem?.id;
  await rejects('image path must start with USER_ID/ITEM_ID/',
    admin.from('item_images').insert({ item_id: itemId, user_id: A, storage_path: `${A}/wrong/a.jpg`, image_type: 'photo' }));
  await rejects("an image cannot be attached to someone else's item",
    admin.from('item_images').insert({ item_id: itemId, user_id: B, storage_path: `${B}/${itemId}/a.jpg`, image_type: 'photo' }));
  await accepts('valid image record accepted',
    admin.from('item_images').insert({ item_id: itemId, user_id: A, storage_path: `${A}/${itemId}/a.jpg`, image_type: 'photo' }));

  console.log('\n--- 5. Matches are never auto-accepted; events need a type ---');
  await rejects('"auto_accepted" is not a valid match decision',
    admin.from('match_attempts').insert({ user_id: A, decode_ok: true, user_decision: 'auto_accepted' }));
  await accepts('user "accepted" decision is valid',
    admin.from('match_attempts').insert({ user_id: A, decode_ok: true, user_decision: 'accepted' }));
  await rejects('event with empty type refused',
    admin.from('events').insert({ user_id: A, event_type: '' }));
  await accepts('valid event accepted',
    admin.from('events').insert({ user_id: A, event_type: 'guard_test', payload: { before: 1, after: 2 } }));

  console.log('\n--- 6. Account deletion grace period (14 days) ---');
  const aItem = goodItem?.id;
  const flag = (ts) => admin.from('profiles').update({ deletion_requested_at: ts }).eq('id', A);
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
  await accepts('deletion request can be recorded (server side)', flag(new Date().toISOString()));
  await rejects('locked account: no new closet items',
    admin.from('closet_items').insert({ ...base, display_image_source: 'user_original' }), /account_pending_deletion/);
  await rejects('locked account: no new image records',
    admin.from('item_images').insert({ item_id: aItem, user_id: A, storage_path: `${A}/${aItem}/b.jpg`, image_type: 'photo' }), /account_pending_deletion/);
  await rejects('locked account: no new match attempts',
    admin.from('match_attempts').insert({ user_id: A, decode_ok: true }), /account_pending_deletion/);
  await rejects('locked account: color profile cannot change',
    admin.from('color_profiles').update({ skin_tone: 'z' }).eq('user_id', A), /account_pending_deletion/);
  await accepts('locked account: consent withdrawal is still recorded',
    admin.from('consent_records').insert({ user_id: A, consent_type: 'storage', policy_version: 'test', granted: false }));
  await accepts('locked account: deletion events are still recorded',
    admin.from('events').insert({ user_id: A, event_type: 'account_deletion_requested' }));
  await accepts('color profile can be deleted immediately while locked',
    admin.from('color_profiles').delete().eq('user_id', A));

  const dueZero = await admin.rpc('accounts_due_for_purge', { grace: '0 seconds' });
  check('purge list includes the account when the grace period is 0',
    !dueZero.error && dueZero.data.some((r) => r.user_id === A), dueZero.error?.message);
  const dueFresh = await admin.rpc('accounts_due_for_purge');
  check('purge list does NOT include a request made just now (14-day default)',
    !dueFresh.error && !dueFresh.data.some((r) => r.user_id === A), dueFresh.error?.message);
  await flag(daysAgo(15));
  const dueOld = await admin.rpc('accounts_due_for_purge');
  check('purge list includes a request older than 14 days',
    !dueOld.error && dueOld.data.some((r) => r.user_id === A), dueOld.error?.message);
  await flag(daysAgo(13));
  const dueNot = await admin.rpc('accounts_due_for_purge');
  check('purge list does NOT include a request 13 days old',
    !dueNot.error && !dueNot.data.some((r) => r.user_id === A), dueNot.error?.message);

  await accepts('restore clears the deletion flag', flag(null));
  await accepts('after restore, new items are accepted again',
    admin.from('closet_items').insert({ ...base, display_image_source: 'user_original' }));

  await admin.from('closet_items').update({ deleted_at: daysAgo(15) }).eq('id', aItem);
  const itemsOld = await admin.rpc('items_due_for_purge');
  check('trash purge list includes an item deleted over 14 days ago',
    !itemsOld.error && itemsOld.data.some((r) => r.item_id === aItem), itemsOld.error?.message);
  await admin.from('closet_items').update({ deleted_at: daysAgo(13) }).eq('id', aItem);
  const itemsNew = await admin.rpc('items_due_for_purge');
  check('trash purge list does NOT include an item deleted 13 days ago',
    !itemsNew.error && !itemsNew.data.some((r) => r.item_id === aItem), itemsNew.error?.message);
  await admin.from('closet_items').update({ deleted_at: null }).eq('id', aItem);

  const aClient = await login(A);
  await aClient.from('profiles').update({ deletion_requested_at: new Date().toISOString() }).eq('id', A);
  const flagNow = await admin.from('profiles').select('deletion_requested_at').eq('id', A).single();
  check('a browser cannot set the deletion flag itself', flagNow.data?.deletion_requested_at === null);
  const rpcUser = await aClient.rpc('accounts_due_for_purge');
  check('a signed-in browser cannot call the purge list', !!rpcUser.error);
  const rpcAnon = await mkClient(anon).rpc('accounts_due_for_purge');
  check('a logged-out visitor cannot call the purge list', !!rpcAnon.error);
  const rpcItems = await aClient.rpc('items_due_for_purge');
  check('a signed-in browser cannot call the trash purge list', !!rpcItems.error);
} catch (e) {
  fail++;
  console.log('\nFAIL  Test could not complete: ' + e.message);
} finally {
  console.log('\n--- 7. Deleting a user removes all of their data, then cleanup ---');
  for (const id of users) {
    const r = await admin.auth.admin.deleteUser(id);
    console.log(r.error ? `Could not delete test user ${id}: ${r.error.message}` : `Deleted test user ${id}`);
  }
  if (aId) {
    for (const t of ['closet_items', 'item_images', 'match_attempts', 'events', 'consent_records', 'color_profiles', 'profiles']) {
      const col = t === 'profiles' ? 'id' : 'user_id';
      const r = await admin.from(t).select('*', { count: 'exact', head: true }).eq(col, aId);
      check(`no ${t} rows left for the deleted user`, !r.error && r.count === 0, r.error?.message ?? `rows=${r.count}`);
    }
  }
  try { if (catalogIds.length) await admin.from('product_catalog').delete().in('id', catalogIds); } catch {}
  console.log(`\nRESULT: ${pass} passed, ${fail} failed.`);
  console.log(fail === 0 ? 'ALL PASSED. The database rules hold on dev.' : 'FAILURES FOUND. Send the output to Claude.');
  process.exit(fail === 0 ? 0 : 1);
}
