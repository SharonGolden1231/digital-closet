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
  "id, name, category, subcategory, subcategory_confidence, brand, material, pattern, fit, color_names, ingestion_channel, display_image_source, emoji, is_complete, user_confirmed, created_at";

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length === 0 ? null : t.slice(0, max);
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

  const row: Record<string, unknown> = {
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
  if (!["GET", "POST", "DELETE"].includes(req.method)) {
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

    // ---------------------------------------------------------- list closet
    if (req.method === "GET") {
      const { data: rows, error } = await db
        .from("closet_items")
        .select(LIST_COLUMNS)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) {
        console.error("items list failed:", error.code, error.message);
        return res.status(500).json({ error: "Couldn't load your closet." });
      }

      const { data: images } = await db
        .from("item_images")
        .select("item_id, storage_path, image_type")
        .in("image_type", ["photo", "thumb"])
        .limit(5000);

      const byItem = new Map<string, { photo?: string; thumb?: string }>();
      for (const img of (images ?? []) as any[]) {
        const entry = byItem.get(img.item_id) ?? {};
        if (img.image_type === "photo") entry.photo = img.storage_path;
        if (img.image_type === "thumb") entry.thumb = img.storage_path;
        byItem.set(img.item_id, entry);
      }

      const wanted = new Set<string>();
      for (const r of (rows ?? []) as any[]) {
        const e = byItem.get(r.id);
        if (e?.thumb) wanted.add(e.thumb);
        if (e?.photo) wanted.add(e.photo);
      }

      const urlByPath = new Map<string, string>();
      if (wanted.size > 0) {
        const { data: signed, error: signError } = await db.storage
          .from(BUCKET)
          .createSignedUrls(Array.from(wanted), 3600);
        if (signError) {
          console.error("items sign failed:", signError.message);
        }
        for (const s of (signed ?? []) as any[]) {
          if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
        }
      }

      const items = ((rows ?? []) as any[]).map((r) => {
        const e = byItem.get(r.id);
        const photoUrl = e?.photo ? urlByPath.get(e.photo) : undefined;
        const thumbUrl = e?.thumb ? urlByPath.get(e.thumb) : photoUrl;
        return { ...r, thumbUrl: thumbUrl ?? null, photoUrl: photoUrl ?? null };
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

    // --------------------------------------------------------- remove item
    const id = String(req.query?.id ?? "");
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: "Invalid item id." });
    }
    const { error: deleteError } = await db
      .from("closet_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (deleteError) {
      console.error("items delete failed:", deleteError.code, deleteError.message);
      return res.status(500).json({ error: "Couldn't remove item." });
    }
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("items error:", error);
    return res.status(500).json({ error: "Service unavailable" });
  }
}
