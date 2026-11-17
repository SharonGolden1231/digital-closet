import { createClient } from "@supabase/supabase-js";
import { BUCKET } from "./_lib/closet.js";
import {
  cronSecret,
  cronAuthorized,
  consentHashKey,
  consentUserRef,
  consentEmailRef,
} from "./_lib/secrets.js";

// Permanently deletes, once a day from a Vercel cron job:
//  1. items removed from a closet 7 days ago or more: photo files first (Storage
//     API), then the item rows (their image rows go with them);
//  2. accounts whose owner asked for deletion 14 days ago or more: every file
//     under the user's folder, then the login itself. The database removes all
//     of the user's rows with it (everything is tied to the login).
// The periods live in the database functions items_due_for_purge and
// accounts_due_for_purge.

const BATCH = 100; // items per run; the next daily run continues
const CHUNK = 50; // items per storage / database call
const ACCOUNT_BATCH = 10; // accounts per run
const FILE_CHUNK = 100; // files per storage delete call

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export type PurgeSummary = {
  dryRun: boolean;
  due: number;
  purgedItems: number;
  purgedFiles: number;
  failedItems: number;
};

// Safe to run twice: files that are already gone are not an error, and an item
// whose files could not be deleted is kept and retried on the next run.
export async function runPurge(admin: any, dryRun: boolean): Promise<PurgeSummary> {
  const { data: due, error } = await admin.rpc("items_due_for_purge");
  if (error) throw new Error("items_due_for_purge failed: " + error.message);
  const all = (due ?? []) as { item_id: string; user_id: string }[];
  const summary: PurgeSummary = {
    dryRun,
    due: all.length,
    purgedItems: 0,
    purgedFiles: 0,
    failedItems: 0,
  };
  if (dryRun) return summary;

  for (const group of chunks(all.slice(0, BATCH), CHUNK)) {
    const ids = group.map((g) => g.item_id);

    const { data: images, error: imageError } = await admin
      .from("item_images")
      .select("storage_path")
      .in("item_id", ids);
    if (imageError) {
      console.error("purge: image lookup failed:", imageError.message);
      summary.failedItems += ids.length;
      continue;
    }

    const paths = ((images ?? []) as { storage_path: string }[]).map((i) => i.storage_path);
    if (paths.length > 0) {
      const { data: removed, error: removeError } = await admin.storage.from(BUCKET).remove(paths);
      if (removeError) {
        // Keep the rows so the next run retries these files.
        console.error("purge: file removal failed:", removeError.message);
        summary.failedItems += ids.length;
        continue;
      }
      summary.purgedFiles += Array.isArray(removed) ? removed.length : 0;
    }

    const { error: deleteError } = await admin.from("closet_items").delete().in("id", ids);
    if (deleteError) {
      console.error("purge: item delete failed:", deleteError.message);
      summary.failedItems += ids.length;
      continue;
    }
    summary.purgedItems += ids.length;
  }
  return summary;
}

// Every file path under one user's folder, however deep (folders have no id).
async function listUserFiles(
  admin: any,
  prefix: string,
  depth = 0
): Promise<string[]> {
  const out: string[] = [];
  if (depth > 4) return out;
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage
      .from(BUCKET)
      .list(prefix, { limit: 1000, offset });
    if (error) throw new Error("storage list failed: " + error.message);
    const entries = (data ?? []) as { id: string | null; name: string }[];
    for (const e of entries) {
      const path = `${prefix}/${e.name}`;
      if (e.id) out.push(path);
      else out.push(...(await listUserFiles(admin, path, depth + 1)));
    }
    if (entries.length < 1000) break;
    offset += 1000;
  }
  return out;
}

export type AccountPurgeSummary = {
  due: number;
  purgedAccounts: number;
  purgedFiles: number;
  failedAccounts: number;
};

// Safe to run twice: an account whose files could not be removed keeps its
// login and is retried on the next run.
export async function runAccountPurge(
  admin: any,
  dryRun: boolean,
  hashKey: string
): Promise<AccountPurgeSummary> {
  const { data: due, error } = await admin.rpc("accounts_due_for_purge");
  if (error) throw new Error("accounts_due_for_purge failed: " + error.message);
  const all = (due ?? []) as { user_id: string }[];
  const summary: AccountPurgeSummary = {
    due: all.length,
    purgedAccounts: 0,
    purgedFiles: 0,
    failedAccounts: 0,
  };
  if (dryRun) return summary;

  for (const account of all.slice(0, ACCOUNT_BATCH)) {
    const userId = String(account.user_id);
    // The folder name is the user id. Never run with anything else: an empty
    // or odd prefix would point at other people's files.
    if (!UUID_RE.test(userId)) {
      summary.failedAccounts += 1;
      continue;
    }
    try {
      const paths = await listUserFiles(admin, userId);
      for (const group of chunks(paths, FILE_CHUNK)) {
        const { data: removed, error: removeError } = await admin.storage
          .from(BUCKET)
          .remove(group);
        if (removeError) throw new Error("file removal failed: " + removeError.message);
        summary.purgedFiles += Array.isArray(removed) ? removed.length : 0;
      }

      // Keep proof of consent (keyed hashes only, minimal) before the login
      // and its rows disappear. If this fails the account is kept and retried
      // tomorrow.
      const { data: found, error: lookupError } = await admin.auth.admin.getUserById(userId);
      if (lookupError) throw new Error("user lookup failed: " + lookupError.message);
      const email = found?.user?.email ? String(found.user.email) : "";
      const { error: archiveError } = await admin.rpc("archive_consent_for_user", {
        p_user_id: userId,
        p_user_ref: consentUserRef(hashKey, userId),
        p_email_ref: email ? consentEmailRef(hashKey, email) : null,
      });
      if (archiveError) throw new Error("consent archive failed: " + archiveError.message);

      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      if (deleteError) throw new Error("user delete failed: " + deleteError.message);
      summary.purgedAccounts += 1;
    } catch (e: any) {
      console.error("purge: account failed:", e?.message);
      summary.failedAccounts += 1;
    }
  }
  return summary;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = cronSecret();
  if (!secret) {
    console.error("purge: CRON_SECRET is missing or too short");
    return res.status(500).json({ error: "Not configured" });
  }
  if (!cronAuthorized(req.headers?.authorization, secret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Checked before any work (dry run included), so a missing key shows up in
  // a dry run instead of failing every account deletion later.
  const hashKey = consentHashKey();
  if (!hashKey) {
    console.error("purge: CONSENT_HASH_KEY is missing or too short");
    return res.status(500).json({ error: "Not configured" });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("purge: Supabase server settings are missing");
    return res.status(500).json({ error: "Not configured" });
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const dry = String(req.query?.dry ?? "") === "1";
    const summary = await runPurge(admin, dry);
    const accounts = await runAccountPurge(admin, dry, hashKey);
    // Counts only: no user ids, item names or file paths in the logs.
    console.log("purge summary:", JSON.stringify({ ...summary, accounts }));
    return res.status(200).json({ ...summary, accounts });
  } catch (error: any) {
    console.error("purge error:", error?.message);
    return res.status(500).json({ error: "Purge failed" });
  }
}
