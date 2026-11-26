import { verifyUser } from "./_lib/gate.js";
import {
  userClient,
  BUCKET,
  CATEGORY_EMOJI,
  COLOR_HEX,
  DEFAULT_HEX,
} from "./_lib/closet.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHANNELS = ["camera", "tag", "manual"];
const MAX_RAW_CHARS = 20000;
const FALLBACK_EMOJI = "👚";

const LIST_COLUMNS =
  "id, name, category, subcategory, subcategory_confidence, brand, material, pattern, fit, color_names, ingestion_channel, display_image_source, emoji, is_complete, user_confirmed, created_at, " +
  "size, size_system, size_equivalents, size_evidence, size_source, body_code_raw, fit_height_cm, fit_chest_cm, fit_waist_cm, fit_hip_cm, fit_source";

// Same lists and ranges as the database checks (20261125120000_item_sizes.sql).
const SIZE_SYSTEMS = ["letter", "EU", "US", "UK", "IT", "FR", "MX", "JP", "waist_length", "kids", "shoe", "other"];
const FIT_RANGES: Record<string, [number, number]> = {
  height_cm: [50, 230],
  chest_cm: [40, 200],
  waist_cm: [30, 200],
  hip_cm: [40, 220],
};
const MAX_EQUIVALENTS = 10;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length === 0 ? null : t.slice(0, max);
}

function sizeSystem(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" && SIZE_SYSTEMS.includes(value) ? value : undefined;
}

// Size as printed + its system. Returns undefined fields on invalid input.
function parseSizeText(input: any): { size: string | null; system: string | null } | { error: string } {
  if (input.printed !== undefined && input.printed !== null && typeof input.printed !== "string") {
    return { error: "Invalid size." };
  }
  const printed = typeof input.printed === "string" ? input.printed.trim() : "";
  if (printed.length > 20) return { error: "Invalid size." };
  const system = sizeSystem(input.system);
  if (system === undefined) return { error: "Invalid size system." };
  return { size: printed || null, system: printed ? system : null };
}

// Garment-fit numbers in cm; every one must be within the database range.
function parseFit(input: any): Record<string, number | null> | { error: string } {
  const out: Record<string, number | null> = {};
  for (const key of Object.keys(FIT_RANGES)) {
    const v = input?.[key];
    if (v === null || v === undefined || v === "") {
      out["fit_" + key] = null;
      continue;
    }
    const n = typeof v === "number" ? v : Number(v);
    const [min, max] = FIT_RANGES[key];
    if (!Number.isFinite(n) || n < min || n > max) {
      return { error: "Invalid measurement: " + key.replace("_cm", "") + "." };
    }
    out["fit_" + key] = Math.round(n * 10) / 10;
  }
  return out;
}

// Size and fit columns for a new item. "label" is accepted only on a tag
// scan; anything else the person entered counts as "user".
function parseSizeColumns(body: any, channel: string): Record<string, unknown> | { error: string } {
  const cols: Record<string, unknown> = {};
  const fromLabel = (s: unknown) => (s === "label" && channel === "tag" ? "label" : "user");

  if (body.size && typeof body.size === "object") {
    const s = body.size;
    const parsed = parseSizeText(s);
    if ("error" in parsed) return parsed;

    let equivalents: { system: string; value: string }[] | null = null;
    if (s.equivalents !== undefined && s.equivalents !== null) {
      if (!Array.isArray(s.equivalents) || s.equivalents.length > MAX_EQUIVALENTS) {
        return { error: "Invalid size list." };
      }
      equivalents = [];
      for (const e of s.equivalents) {
        const value = text(e?.value, 20);
        if (!value) continue;
        const system = sizeSystem(e?.system);
        equivalents.push({ system: system || "other", value });
      }
      if (equivalents.length === 0) equivalents = null;
    }

    const evidence = s.evidence === undefined || s.evidence === null ? null : text(s.evidence, 1000);
    if (evidence && evidence.length > 200) return { error: "Invalid size evidence." };
    const code = s.body_code_raw === undefined || s.body_code_raw === null ? null : text(s.body_code_raw, 1000);
    if (code && code.length > 40) return { error: "Invalid body code." };

    cols.size = parsed.size;
    cols.size_system = parsed.system;
    cols.size_equivalents = equivalents;
    cols.size_evidence = evidence;
    cols.body_code_raw = code;
    cols.size_source = parsed.size || equivalents ? fromLabel(s.source) : null;
  }

  if (body.fit && typeof body.fit === "object") {
    const fit = parseFit(body.fit);
    if ("error" in fit) return fit;
    Object.assign(cols, fit);
    const any = Object.values(fit).some((v) => v !== null);
    cols.fit_source = any ? fromLabel(body.fit.source) : null;
  }
  return cols;
}

type ParsedItem = {
  row: Record<string, unknown>;
  images: Record<string, unknown>[];
};

// Validates the request and builds the database rows. The user id always
// comes from the verified login token, never from the request body.
function parseItem(body: any, userId: string): ParsedItem | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request." };

  const id = String(body.id ?? "");
  if (!UUID_RE.test(id)) return { error: "Invalid item id." };

  const name = text(body.name, 120);
  const category = text(body.category, 40);
  if (!name || !category) return { error: "Name and category are required." };

  const channel = String(body.channel ?? "");
  if (!CHANNELS.includes(channel)) return { error: "Invalid channel." };

  const colors = Array.isArray(body.colors)
    ? body.colors
        .map((c: unknown) => text(c, 30))
        .filter((c: string | null): c is string => c !== null)
        .slice(0, 6)
    : [];

  const confidence =
    body.sub_category_confidence === "high" ||
    body.sub_category_confidence === "low"
      ? body.sub_category_confidence
      : null;

  // Only a photo this user owns, at exactly the expected path, is accepted.
  const images: Record<string, unknown>[] = [];
  const incoming = Array.isArray(body.images) ? body.images.slice(0, 2) : [];
  for (const img of incoming) {
    const type = img?.type;
    const expected =
      type === "photo"
        ? `${userId}/${id}/original.jpg`
        : type === "thumb"
          ? `${userId}/${id}/thumb.jpg`
          : null;
    if (!expected || img?.path !== expected) {
      return { error: "Invalid image reference." };
    }
    images.push({
      item_id: id,
      user_id: userId,
      storage_path: expected,
      image_type: type,
      processing_status: "done",
    });
  }
  const hasPhoto = images.some((i) => i.image_type === "photo");

  let raw: unknown = null;
  if (body.raw && typeof body.raw === "object") {
    const serialized = JSON.stringify(body.raw);
    if (serialized.length > MAX_RAW_CHARS) {
      return { error: "Item data too large." };
    }
    raw = body.raw;
  }

  const sizeCols = parseSizeColumns(body, channel);
  if ("error" in sizeCols) return { error: sizeCols.error as string };

  const row: Record<string, unknown> = {
    ...sizeCols,
    id,
    user_id: userId,
    name,
    category,
    subcategory: text(body.sub_category, 60),
    subcategory_confidence: confidence,
    brand: text(body.brand, 80),
    material: text(body.material, 120),
    pattern: text(body.pattern, 40),
    fit: text(body.fit, 30),
    color_names: colors,
    color_hex: COLOR_HEX[colors[0]] ?? DEFAULT_HEX,
    ingestion_channel: channel,
    raw_model_output: raw,
    user_confirmed: true,
    // An item without its own photo shows an emoji and stays "incomplete"
    // until the user adds a photo.
    is_complete: hasPhoto,
    display_image_source: hasPhoto ? "user_original" : "emoji",
    emoji: hasPhoto ? null : (CATEGORY_EMOJI[category] ?? FALLBACK_EMOJI),
  };

  return { row, images };
}

export default async function handler(req: any, res: any) {
  if (!["GET", "POST", "PATCH", "DELETE"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await verifyUser(req, res);
    if (!auth) return;

    const db = userClient(auth.token);
    if (!db) {
      console.error("items: Supabase server settings are missing");
      return res.status(500).json({ error: "Service unavailable" });
    }

    // ----------------------------------------------- full photo for one item
    if (req.method === "GET" && req.query?.photo) {
      const itemId = String(req.query.photo);
      if (!UUID_RE.test(itemId)) {
        return res.status(400).json({ error: "Invalid item id." });
      }
      const { data: photoRow } = await db
        .from("item_images")
        .select("storage_path")
        .eq("item_id", itemId)
        .eq("image_type", "photo")
        .maybeSingle();
      if (!photoRow) return res.status(404).json({ error: "No photo." });
      const { data: signed } = await db.storage
        .from(BUCKET)
        .createSignedUrl((photoRow as any).storage_path, 3600);
      if (!signed?.signedUrl) return res.status(404).json({ error: "No photo." });
      return res.status(200).json({ url: signed.signedUrl });
    }

    // ---------------------------------------------------------- list closet
    if (req.method === "GET") {
      // The two reads are independent, so they run at the same time.
      const [itemsResult, imagesResult] = await Promise.all([
        db
          .from("closet_items")
          .select(LIST_COLUMNS)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1000),
        db
          .from("item_images")
          .select("item_id, storage_path, image_type")
          .in("image_type", ["photo", "thumb"])
          .limit(5000),
      ]);
      if (itemsResult.error) {
        console.error("items list failed:", itemsResult.error.code, itemsResult.error.message);
        return res.status(500).json({ error: "Couldn't load your closet." });
      }
      const rows = (itemsResult.data ?? []) as any[];

      const byItem = new Map<string, { photo?: string; thumb?: string }>();
      for (const img of (imagesResult.data ?? []) as any[]) {
        const entry = byItem.get(img.item_id) ?? {};
        if (img.image_type === "photo") entry.photo = img.storage_path;
        if (img.image_type === "thumb") entry.thumb = img.storage_path;
        byItem.set(img.item_id, entry);
      }

      // Only the small thumbnail is signed for the grid (or the photo when an
      // item has no thumbnail). The full photo is fetched when an item opens.
      const pathFor = (id: string): string | undefined => {
        const e = byItem.get(id);
        return e?.thumb ?? e?.photo;
      };
      const wanted = new Set<string>();
      for (const r of rows) {
        const path = pathFor(r.id);
        if (path) wanted.add(path);
      }

      const urlByPath = new Map<string, string>();
      if (wanted.size > 0) {
        const { data: signed, error: signError } = await db.storage
          .from(BUCKET)
          .createSignedUrls(Array.from(wanted), 21600);
        if (signError) {
          console.error("items sign failed:", signError.message);
        }
        for (const s of (signed ?? []) as any[]) {
          if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
        }
      }

      const items = rows.map((r) => {
        const path = pathFor(r.id);
        const thumbUrl = path ? urlByPath.get(path) : undefined;
        return { ...r, thumbUrl: thumbUrl ?? null, hasPhoto: Boolean(byItem.get(r.id)?.photo) };
      });
      return res.status(200).json({ items });
    }

    // ----------------------------------------------------------- save item
    if (req.method === "POST") {
      const parsed = parseItem(req.body, auth.userId);
      if ("error" in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { error: insertError } = await db
        .from("closet_items")
        .insert(parsed.row);
      if (insertError) {
        if (insertError.code === "23505") {
          // Duplicate id: fine for a retry of an earlier save, but only if
          // the existing row is this user's (row-level security hides others).
          const { data: existing } = await db
            .from("closet_items")
            .select("id")
            .eq("id", parsed.row.id as string)
            .maybeSingle();
          if (!existing) {
            return res.status(409).json({ error: "Item id already in use." });
          }
        } else {
          console.error(
            "items insert failed:",
            insertError.code,
            insertError.message
          );
          return res.status(500).json({ error: "Couldn't save item." });
        }
      }

      for (const image of parsed.images) {
        const { error: imageError } = await db
          .from("item_images")
          .insert(image);
        if (imageError && imageError.code !== "23505") {
          console.error(
            "items image insert failed:",
            imageError.code,
            imageError.message
          );
          return res.status(500).json({ error: "Couldn't save item photo." });
        }
      }
      return res.status(200).json({ ok: true, id: parsed.row.id });
    }

    // ------------------------------- change an item's type and/or size
    // Only category/type and the person's size corrections change. What the
    // AI and the label said (raw_model_output, size_evidence,
    // size_equivalents, body_code_raw) is never touched, so wrong reads stay
    // measurable.
    if (req.method === "PATCH") {
      const body = req.body;
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Invalid request." });
      }
      const itemId = String(body.id ?? "");
      if (!UUID_RE.test(itemId)) {
        return res.status(400).json({ error: "Invalid item id." });
      }
      const changesType = body.category !== undefined || body.sub_category !== undefined;
      const changesSize = body.size !== undefined;
      const changesFit = body.fit !== undefined;
      if (!changesType && !changesSize && !changesFit) {
        return res.status(400).json({ error: "Nothing to change." });
      }

      const category = typeof body.category === "string" ? body.category : "";
      const subRaw =
        typeof body.sub_category === "string" ? body.sub_category.trim() : "";
      if (changesType) {
        if (!Object.prototype.hasOwnProperty.call(CATEGORY_EMOJI, category)) {
          return res.status(400).json({ error: "Invalid category." });
        }
        if (subRaw.length === 0 || subRaw.length > 60) {
          return res.status(400).json({ error: "Invalid type." });
        }
      }

      // A correction always counts as the person's own ("user").
      const sizeChanges: Record<string, unknown> = {};
      if (changesSize) {
        if (!body.size || typeof body.size !== "object") {
          return res.status(400).json({ error: "Invalid size." });
        }
        const parsed = parseSizeText(body.size);
        if ("error" in parsed) return res.status(400).json({ error: parsed.error });
        sizeChanges.size = parsed.size;
        sizeChanges.size_system = parsed.system;
        sizeChanges.size_source = parsed.size ? "user" : null;
      }
      if (changesFit) {
        if (!body.fit || typeof body.fit !== "object") {
          return res.status(400).json({ error: "Invalid measurements." });
        }
        const fit = parseFit(body.fit);
        if ("error" in fit) return res.status(400).json({ error: fit.error });
        Object.assign(sizeChanges, fit);
        sizeChanges.fit_source = Object.values(fit).some((v) => v !== null) ? "user" : null;
      }

      // Row-level security hides other users' items, so a missing row and
      // someone else's row look the same: 404 either way.
      const { data: current, error: readError } = await db
        .from("closet_items")
        .select("display_image_source")
        .eq("id", itemId)
        .is("deleted_at", null)
        .maybeSingle();
      if (readError) {
        console.error("items reclassify read failed:", readError.code, readError.message);
        return res.status(500).json({ error: "Couldn't change item." });
      }
      if (!current) return res.status(404).json({ error: "Item not found." });

      const changes: Record<string, unknown> = { ...sizeChanges, user_confirmed: true };
      if (changesType) {
        changes.category = category;
        changes.subcategory = subRaw;
        // An item without a photo shows its category's emoji.
        if ((current as any).display_image_source === "emoji") {
          changes.emoji = CATEGORY_EMOJI[category] ?? FALLBACK_EMOJI;
        }
      }

      const { data: updated, error: updateError } = await db
        .from("closet_items")
        .update(changes)
        .eq("id", itemId)
        .is("deleted_at", null)
        .select(LIST_COLUMNS);
      if (updateError) {
        console.error("items reclassify failed:", updateError.code, updateError.message);
        return res.status(500).json({ error: "Couldn't change item." });
      }
      const row = (updated as any[] | null)?.[0];
      // Zero rows: removed in the meantime, or not this user's.
      if (!row) return res.status(404).json({ error: "Item not found." });

      // Same shape as one entry of the closet list (GET).
      const { data: imgs } = await db
        .from("item_images")
        .select("storage_path, image_type")
        .eq("item_id", itemId)
        .in("image_type", ["photo", "thumb"]);
      const photo = (imgs ?? []).find((i: any) => i.image_type === "photo") as any;
      const thumb = (imgs ?? []).find((i: any) => i.image_type === "thumb") as any;
      const path: string | undefined = thumb?.storage_path ?? photo?.storage_path;
      let thumbUrl: string | null = null;
      if (path) {
        const { data: signed } = await db.storage
          .from(BUCKET)
          .createSignedUrl(path, 21600);
        thumbUrl = signed?.signedUrl ?? null;
      }
      return res
        .status(200)
        .json({ item: { ...row, thumbUrl, hasPhoto: Boolean(photo) } });
    }

    // --------------------------------------------------------- remove item
    const id = String(req.query?.id ?? "");
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: "Invalid item id." });
    }
    const { data: removed, error: deleteError } = await db
      .from("closet_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null)
      .select("id");
    if (deleteError) {
      console.error("items delete failed:", deleteError.code, deleteError.message);
      return res.status(500).json({ error: "Couldn't remove item." });
    }
    // Zero rows means the item is not this user's, or is already removed.
    if (!removed || removed.length === 0) {
      return res.status(404).json({ error: "Item not found." });
    }
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("items error:", error);
    return res.status(500).json({ error: "Service unavailable" });
  }
}
