import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { BUCKET } from "./_lib/closet.js";

// Permanently deletes items that were removed from a closet 7 days ago or
// more: first their photo files (through the Storage API), then the item rows
// (their image rows go with them). Runs once a day from a Vercel cron job.
// The 7-day period lives in the database function items_due_for_purge.

const BATCH = 100; // items per run; the next daily run continues
const CHUNK = 50; // items per storage / database call

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function authorized(sent: string, secret: string): boolean {
  const a = Buffer.from(sent);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
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

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    console.error("purge: CRON_SECRET is missing or too short");
    return res.status(500).json({ error: "Not configured" });
  }
  if (!authorized(String(req.headers?.authorization ?? ""), secret)) {
    return res.status(401).json({ error: "Unauthorized" });
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
    const summary = await runPurge(admin, String(req.query?.dry ?? "") === "1");
    // Counts only: no user ids, item names or file paths in the logs.
    console.log("purge summary:", JSON.stringify(summary));
    return res.status(200).json(summary);
  } catch (error: any) {
    console.error("purge error:", error?.message);
    return res.status(500).json({ error: "Purge failed" });
  }
}
