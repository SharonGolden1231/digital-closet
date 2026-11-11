import { supabase } from "./supabase";
import { authFetch } from "./authFetch";
import type { ClosetItem } from "../types";

// Extra information a channel passes along when it adds an item.
export type AddMeta = {
  file?: File; // the user's own garment photo (camera channel)
  raw?: unknown; // the model's raw answer, kept for audit and re-checks
};

const BUCKET = "closet-private";
const PHOTO_MAX_SIDE = 1600;
const PHOTO_QUALITY = 0.85;
const THUMB_MAX_SIDE = 400;
const THUMB_QUALITY = 0.7;

// A client-side id so a retried save can never create a duplicate item.
export function newItemId(): string {
  const c: any = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Shrinks a photo and re-encodes it as JPEG. Browsers apply the photo's
// rotation when decoding, so the result is upright.
function resizeToJpeg(
  file: File,
  maxSide: number,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Couldn't prepare the photo."));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Couldn't prepare the photo.")),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read the photo."));
    };
    img.src = url;
  });
}

async function uploadJpeg(path: string, blob: Blob): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (!error) return;
  // A retry of an earlier upload finds the file already there; that is fine.
  const status = String((error as any).statusCode ?? "");
  if (status === "409" || /already exists|duplicate/i.test(error.message)) {
    return;
  }
  throw new Error("Photo upload failed: " + error.message);
}

function channelOf(item: ClosetItem): "camera" | "tag" | "manual" {
  const signals = item.source_signals || [];
  if (signals.includes("image")) return "camera";
  if (signals.includes("tag_scan")) return "tag";
  return "manual";
}

// Saves one confirmed item: photo and thumbnail go to the user's private
// folder first, then the item row. Throws on failure so the caller can offer
// a retry. Safe to call again for the same item.
export async function saveItem(item: ClosetItem, meta: AddMeta): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error("Please sign in again.");

  const images: { type: "photo" | "thumb"; path: string }[] = [];
  if (meta.file) {
    const photoPath = `${userId}/${item.id}/original.jpg`;
    const thumbPath = `${userId}/${item.id}/thumb.jpg`;
    let photo: Blob | null = null;
    let thumb: Blob | null = null;
    try {
      [photo, thumb] = await Promise.all([
        resizeToJpeg(meta.file, PHOTO_MAX_SIDE, PHOTO_QUALITY),
        resizeToJpeg(meta.file, THUMB_MAX_SIDE, THUMB_QUALITY),
      ]);
    } catch {
      // The browser could not decode this photo (for example some phone
      // formats). Save the item without a photo rather than lose it; it shows
      // an emoji and stays marked incomplete until a photo is added.
    }
    if (photo && thumb) {
      await uploadJpeg(photoPath, photo);
      await uploadJpeg(thumbPath, thumb);
      images.push({ type: "photo", path: photoPath });
      images.push({ type: "thumb", path: thumbPath });
    }
  }

  const res = await authFetch("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: item.id,
      name: item.name,
      category: item.category,
      sub_category: item.sub_category,
      sub_category_confidence: item.sub_category_confidence,
      colors: item.colors,
      pattern: item.pattern,
      fit: item.fit,
      brand: item.brand,
      material: item.material,
      channel: channelOf(item),
      images,
      raw: meta.raw ?? null,
    }),
  });
  if (!res.ok) {
    let message = "Couldn't save item.";
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep the generic message */
    }
    throw new Error(message);
  }
}

function badgeOf(channel: string, brand: string | null): string {
  if (channel === "camera") return "Camera Upload";
  if (channel === "tag") return "Digitized via Tag";
  if (channel === "brand_import") return `Imported from ${brand ?? "brand"}`;
  return "Manually Cataloged";
}

function signalsOf(channel: string): string[] {
  if (channel === "camera") return ["image"];
  if (channel === "tag") return ["tag_scan"];
  return ["manual"];
}

// Loads the signed-in user's closet. Thumbnails feed the grid; full photos
// are returned separately for the detail view.
export async function loadCloset(): Promise<{
  items: ClosetItem[];
  photoUrls: Record<string, string>;
}> {
  const res = await authFetch("/api/items", { method: "GET" });
  if (!res.ok) throw new Error("Couldn't load your closet.");
  const body = await res.json();
  const photoUrls: Record<string, string> = {};
  const items = ((body.items ?? []) as any[]).map((r) => {
    if (r.photoUrl) photoUrls[r.id] = r.photoUrl;
    return {
      id: r.id,
      name: r.name ?? "Item",
      category: r.category ?? "Top",
      sub_category: r.subcategory ?? "",
      sub_category_confidence: r.subcategory_confidence ?? "high",
      colors:
        Array.isArray(r.color_names) && r.color_names.length
          ? r.color_names
          : ["Black"],
      pattern: r.pattern ?? "Solid",
      fit: r.fit ?? null,
      brand: r.brand ?? "Unknown",
      material: r.material ?? "",
      source_signals: signalsOf(r.ingestion_channel),
      badge: badgeOf(r.ingestion_channel, r.brand),
      imageUrl: r.thumbUrl ?? undefined,
      addedAt: r.created_at,
    } as ClosetItem;
  });
  return { items, photoUrls };
}

// Soft-removes an item (kept for a purge job, hidden from the closet).
export async function deleteItem(id: string): Promise<void> {
  const res = await authFetch(`/api/items?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Couldn't remove item.");
}
