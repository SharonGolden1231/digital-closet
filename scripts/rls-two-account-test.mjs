// Vestry / Digital Closet: two-account isolation test (Phase 1)
// Run from the repo root:  node scripts/rls-two-account-test.mjs
//
// SAFETY: refuses to run unless every Supabase URL / key in .env.local
// belongs to the DEV project. Creates two temporary test users in dev and
// deletes them (and all test data) at the end. Never prints key values.

import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const DEV_REF = 'bkjcipqkmohpjezkybvh';
const BUCKET = 'closet-private';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function die(msg) {
  console.error('\nSTOPPED: ' + msg + '\n');
  process.exit(2);
}

// ---------- load .env.local (no extra packages needed) ----------
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
  if (values.length > 1) die(`More than one different value for the Supabase ${label}: ${names.join(', ')}. Tell Claude these variable names.`);
  console.log(`Using ${label} from variable: ${names[0]}`);
  return { value: values[0], names };
}

const url = pickOne('URL', /SUPABASE.*URL/i);
const anon = pickOne('anon/public key', /(ANON|PUBLISHABLE)/i);
const service = pickOne('service-role/secret key', /(SERVICE_ROLE|SECRET_KEY)/i);

// ---------- dev-only guard ----------
if (!url.value.includes(DEV_REF)) die('The Supabase URL in .env.local is NOT the dev project. Refusing to run.');
for (const key of [anon.value, service.value]) {
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const ref = JSON.parse(Buffer.from(parts[1], 'base64url').toString()).ref;
      if (ref && ref !== DEV_REF) die('A key in .env.local belongs to a different project than dev. Refusing to run.');
    } catch { /* not a decodable JWT: fine for newer key formats */ }
  }
}
console.log('Dev-project guard passed.\n');

// ---------- helpers ----------
const mk = (key) => createClient(url.value, key, { auth: { persistSession: false, autoRefreshToken: false } });
let pass = 0;
let fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (detail ? '   -> ' + detail : '')); }
}
const emptyOrError = (r) => !!r.error || (Array.isArray(r.data) && r.data.length === 0);

const admin = mk(service.value);
const stamp = Date.now();
const password = randomUUID() + 'Aa1!';
const createdUsers = [];
const seededCatalog = [];
const seededArchetypes = [];
const storagePaths = [];

async function newUser(tag) {
  const email = `rls-test-${tag}-${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error('createUser failed: ' + error.message);
  createdUsers.push(data.user.id);
  const client = mk(anon.value);
  const s = await client.auth.signInWithPassword({ email, password });
  if (s.error) throw new Error('sign-in failed: ' + s.error.message);
  return { id: data.user.id, client };
}

async function seed(table, row) {
  const r = await admin.from(table).insert(row).select().single();
  if (r.error) throw new Error(`seed ${table} failed: ${r.error.message}`);
  return r.data;
}

try {
  const A = await newUser('a');
  const B = await newUser('b');
  const anonClient = mk(anon.value);

  // ---------- seed user A's data (server side) ----------
  const catalog = await seed('product_catalog', { brand: 'RLS-TEST', style_code: String(stamp), name: 'rls test' });
  seededCatalog.push(catalog.id);
  const archetype = await seed('archetypes', { category: 'test', subcategory: 'test', variant: 'rls-' + stamp, base_image_path: 'test/test.png' });
  seededArchetypes.push(archetype.id);
  const consent = await seed('consent_records', { user_id: A.id, consent_type: 'selfie_analysis', policy_version: 'test', granted: true });
  const item = await seed('closet_items', { user_id: A.id, name: 'A item', ingestion_channel: 'manual', display_image_source: 'user_original' });
  const path = `${A.id}/${item.id}/test.png`;
  await seed('item_images', { item_id: item.id, user_id: A.id, storage_path: path, image_type: 'photo' });
  await seed('match_attempts', { user_id: A.id, brand: 'RLS-TEST', decode_ok: true });
  await seed('events', { user_id: A.id, event_type: 'rls_test' });
  await seed('color_profiles', { user_id: A.id, skin_tone: 'test', consent_record_id: consent.id });
  const up = await A.client.storage.from(BUCKET).upload(path, PNG, { contentType: 'image/png' });
  if (up.error) throw new Error('A upload to own folder failed: ' + up.error.message);
  storagePaths.push(path);

  const ownTables = ['closet_items', 'item_images', 'match_attempts', 'events', 'consent_records', 'color_profiles'];

  console.log('--- 1. Sanity: A can see own data (proves the test itself works) ---');
  for (const t of ownTables) {
    const r = await A.client.from(t).select('*');
    check(`A reads own ${t}`, !r.error && r.data.length === 1, r.error?.message ?? `rows=${r.data?.length}`);
  }
  const ap = await A.client.from('profiles').select('*');
  check('A reads own profile (created automatically at sign-up)', !ap.error && ap.data.length === 1 && ap.data[0].id === A.id);
  const ar = await A.client.from('archetypes').select('*').eq('id', archetype.id);
  check('Signed-in user can read shared archetypes', !ar.error && ar.data.length === 1);
  const ad = await A.client.storage.from(BUCKET).download(path);
  check('A downloads own file', !ad.error, ad.error?.message);

  console.log('\n--- 2. B cannot read A ---');
  for (const t of ownTables) {
    const r = await B.client.from(t).select('*');
    check(`B sees none of A's ${t}`, !r.error && r.data.length === 0, r.error?.message ?? `rows=${r.data?.length}`);
  }
  const bp = await B.client.from('profiles').select('*');
  check("B sees only own profile, not A's", !bp.error && bp.data.length === 1 && bp.data[0].id === B.id);
  check('B cannot read product_catalog', emptyOrError(await B.client.from('product_catalog').select('*')));

  console.log('\n--- 3. Not logged in (anon) sees nothing ---');
  for (const t of [...ownTables, 'profiles', 'product_catalog', 'archetypes']) {
    check(`anon sees nothing in ${t}`, emptyOrError(await anonClient.from(t).select('*')));
  }

  console.log('\n--- 4. Writes: B cannot touch A, and browsers cannot write server-only tables ---');
  const insB = await B.client.from('closet_items').insert({ user_id: B.id, name: 'B item', ingestion_channel: 'manual', display_image_source: 'user_original' });
  check('B cannot insert own closet item from the browser (server-only by design)', !!insB.error);
  const insAsA = await B.client.from('closet_items').insert({ user_id: A.id, name: 'forged', ingestion_channel: 'manual', display_image_source: 'user_original' });
  check("B cannot insert an item into A's closet", !!insAsA.error);

  await B.client.from('closet_items').update({ name: 'HACKED' }).eq('id', item.id);
  let cur = await admin.from('closet_items').select('name').eq('id', item.id).single();
  check("B cannot rename A's item", cur.data?.name === 'A item', `name=${cur.data?.name}`);

  await B.client.from('closet_items').delete().eq('id', item.id);
  cur = await admin.from('closet_items').select('id').eq('id', item.id);
  check("B cannot delete A's item", cur.data?.length === 1);

  await A.client.from('closet_items').update({ name: 'SELF-EDIT' }).eq('id', item.id);
  cur = await admin.from('closet_items').select('name').eq('id', item.id).single();
  check('A cannot edit own item from the browser (server-only by design)', cur.data?.name === 'A item');

  await A.client.from('closet_items').delete().eq('id', item.id);
  cur = await admin.from('closet_items').select('id').eq('id', item.id);
  check('A cannot delete own item from the browser (server-only by design)', cur.data?.length === 1);

  const bWrites = [
    ['events', { user_id: B.id, event_type: 'forged' }],
    ['consent_records', { user_id: B.id, consent_type: 'storage', policy_version: 'x', granted: true }],
    ['match_attempts', { user_id: B.id, decode_ok: true }],
    ['archetypes', { category: 'x', subcategory: 'x', variant: 'x', base_image_path: 'x' }],
    ['product_catalog', { brand: 'forged' }],
  ];
  for (const [t, row] of bWrites) {
    const r = await B.client.from(t).insert(row);
    check(`browser cannot insert into ${t}`, !!r.error);
  }

  const pilot = await B.client.from('profiles').update({ web_image_pilot: true }).eq('id', B.id);
  const pilotNow = await admin.from('profiles').select('web_image_pilot').eq('id', B.id).single();
  check('user cannot switch on own web_image_pilot flag', !!pilot.error || pilotNow.data?.web_image_pilot === false);
  const dn = await B.client.from('profiles').update({ display_name: 'Bee' }).eq('id', B.id);
  const dnNow = await admin.from('profiles').select('display_name').eq('id', B.id).single();
  check('user can edit own display_name', !dn.error && dnNow.data?.display_name === 'Bee', dn.error?.message);
  await B.client.from('profiles').update({ display_name: 'HACKED' }).eq('id', A.id);
  const aName = await admin.from('profiles').select('display_name').eq('id', A.id).single();
  check("B cannot change A's display_name", aName.data?.display_name !== 'HACKED');

  console.log('\n--- 5. Storage isolation ---');
  const bd = await B.client.storage.from(BUCKET).download(path);
  check("B cannot download A's file", !!bd.error);
  const bl = await B.client.storage.from(BUCKET).list(`${A.id}/${item.id}`);
  check("B cannot list A's folder", !!bl.error || bl.data.length === 0);
  const bu = await B.client.storage.from(BUCKET).upload(`${A.id}/${item.id}/evil.png`, PNG, { contentType: 'image/png' });
  check("B cannot upload into A's folder", !!bu.error);
  await B.client.storage.from(BUCKET).remove([path]);
  const still = await admin.storage.from(BUCKET).download(path);
  check("B cannot delete A's file", !still.error);
  const an = await anonClient.storage.from(BUCKET).download(path);
  check('anon cannot download A\'s file', !!an.error);
  const pub = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const resp = await fetch(pub);
  check('bucket is private (public URL does not serve the file)', resp.status !== 200, `status=${resp.status}`);
  const ownPath = `${B.id}/${randomUUID()}/ok.png`;
  const bOk = await B.client.storage.from(BUCKET).upload(ownPath, PNG, { contentType: 'image/png' });
  if (!bOk.error) storagePaths.push(ownPath);
  check('B can upload into own folder (positive control)', !bOk.error, bOk.error?.message);
  const bBad = await B.client.storage.from(BUCKET).upload(`${B.id}/${randomUUID()}/x.txt`, Buffer.from('hello'), { contentType: 'text/plain' });
  check('non-image file types are rejected', !!bBad.error);
  const bClient = await B.client.storage.from(BUCKET).remove([ownPath]);
  const ownStill = await admin.storage.from(BUCKET).download(ownPath);
  check('browser cannot delete even own files (deletion is server-side)', !ownStill.error);
} catch (e) {
  fail++;
  console.log('\nFAIL  Test could not complete: ' + e.message);
} finally {
  console.log('\n--- Cleanup ---');
  try { if (storagePaths.length) await admin.storage.from(BUCKET).remove(storagePaths); } catch {}
  try { if (seededCatalog.length) await admin.from('product_catalog').delete().in('id', seededCatalog); } catch {}
  try { if (seededArchetypes.length) await admin.from('archetypes').delete().in('id', seededArchetypes); } catch {}
  for (const id of createdUsers) {
    const r = await admin.auth.admin.deleteUser(id);
    console.log(r.error ? `Could not delete test user ${id}: ${r.error.message}` : `Deleted test user ${id}`);
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed.`);
  console.log(fail === 0 ? 'ALL PASSED. Safe to treat Test 2 as passed.' : 'FAILURES FOUND. Do NOT merge. Send the output to Claude.');
  process.exit(fail === 0 ? 0 : 1);
}
