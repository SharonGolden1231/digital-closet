import { useState, useRef, useCallback } from "react";
import {
  Camera,
  Tag,
  ShoppingBag,
  PenLine,
  Grid3X3,
  Plus,
  MessageCircle,
  Terminal,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Shirt,
  Layers,
  Send,
  X,
  ExternalLink,
  Upload,
  Scan,
} from "lucide-react";
import type {
  ClosetItem,
  AdminLog,
  ClassifyResponse,
  TagScanResponse,
  Tab,
  Channel,
} from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

const SEED_ITEMS: ClosetItem[] = [
  {
    id: "s1",
    name: "Tailored Wool Blazer",
    category: "Outerwear",
    sub_category: "Blazer",
    sub_category_confidence: "high",
    colors: ["Charcoal", "Grey"],
    pattern: "Solid",
    fit: "Tailored",
    brand: "Zara",
    material: "Wool blend",
    source_signals: ["brand_import"],
    badge: "Imported from Zara",
    addedAt: "2024-11-12T09:23:00Z",
  },
  {
    id: "s2",
    name: "Slim Black Denim",
    category: "Bottom",
    sub_category: "Jeans",
    sub_category_confidence: "high",
    colors: ["Black"],
    pattern: "Solid",
    fit: "Slim",
    brand: "Uniqlo",
    material: "98% Cotton 2% Elastane",
    source_signals: ["tag_scan"],
    badge: "Digitized via Tag",
    addedAt: "2024-11-18T14:05:00Z",
  },
  {
    id: "s3",
    name: "Ivory Linen Blouse",
    category: "Top",
    sub_category: "Blouse",
    sub_category_confidence: "high",
    colors: ["Cream", "Beige"],
    pattern: "Solid",
    fit: "Relaxed",
    brand: "Mango",
    material: "100% Linen",
    source_signals: ["image"],
    badge: "Background Cleaned",
    addedAt: "2024-12-02T11:40:00Z",
  },
  {
    id: "s4",
    name: "Camel Trench Coat",
    category: "Outerwear",
    sub_category: "Trench Coat",
    sub_category_confidence: "high",
    colors: ["Camel"],
    pattern: "Solid",
    fit: "Regular",
    brand: "Zara",
    material: "Polyester blend",
    source_signals: ["tag_scan", "visual_search"],
    badge: "Digitized via Tag",
    addedAt: "2024-12-15T16:22:00Z",
  },
  {
    id: "s5",
    name: "Olive Cargo Trousers",
    category: "Bottom",
    sub_category: "Tailored Trousers",
    sub_category_confidence: "low",
    colors: ["Olive"],
    pattern: "Solid",
    fit: "Regular",
    brand: "Nike",
    material: "Cotton twill",
    source_signals: ["image"],
    badge: "Camera Upload",
    addedAt: "2025-01-08T08:15:00Z",
  },
];

const COLOR_HEX: Record<string, string> = {
  Black: "#2B2927",
  White: "#F7F4EE",
  Navy: "#1e3a5f",
  Grey: "#9CA3AF",
  Charcoal: "#36454F",
  Beige: "#D4B896",
  Brown: "#8B6914",
  Red: "#B91C1C",
  Pink: "#F4A7B9",
  Orange: "#EA580C",
  Yellow: "#CA8A04",
  Green: "#15803D",
  Blue: "#2563EB",
  Purple: "#7C3AED",
  Cream: "#F5F1EB",
  Olive: "#6B7C3E",
  Burgundy: "#800020",
  Camel: "#C19A6B",
  Tan: "#D2B48C",
};

const CATEGORY_ICONS: Record<string, string> = {
  Top: "👕",
  Bottom: "👖",
  Outerwear: "🧥",
  Dress: "👗",
  Jumpsuit: "🦱",
  Footwear: "👟",
  Accessory: "👜",
  Activewear: "🏃",
  Swimwear: "🩱",
  Sleepwear: "🌙",
};

const MANUAL_CATEGORIES = [
  {
    category: "Top",
    subCategories: [
      "T-Shirt",
      "Tank Top",
      "Button-Down",
      "Blouse",
      "Polo",
      "Hoodie",
      "Sweatshirt",
      "Crop Top",
    ],
  },
  {
    category: "Bottom",
    subCategories: [
      "Jeans",
      "Chinos",
      "Tailored Trousers",
      "Shorts",
      "Skirt",
      "Leggings",
    ],
  },
  {
    category: "Outerwear",
    subCategories: [
      "Bomber",
      "Trench Coat",
      "Puffer",
      "Blazer",
      "Denim Jacket",
      "Leather Jacket",
    ],
  },
  {
    category: "Dress",
    subCategories: [
      "Mini Dress",
      "Midi Dress",
      "Maxi Dress",
      "Wrap Dress",
      "Slip Dress",
    ],
  },
  {
    category: "Jumpsuit",
    subCategories: ["Jumpsuit", "Playsuit", "Romper"],
  },
  {
    category: "Footwear",
    subCategories: ["Sneakers", "Boots", "Loafers", "Heels", "Sandals", "Slides"],
  },
  {
    category: "Accessory",
    subCategories: ["Belt", "Bag", "Hat", "Scarf", "Sunglasses", "Watch", "Jewelry"],
  },
  {
    category: "Activewear",
    subCategories: [
      "Sports Bra",
      "Leggings",
      "Track Pants",
      "Athletic Top",
      "Gym Shorts",
    ],
  },
  {
    category: "Swimwear",
    subCategories: ["Bikini Top", "Bikini Bottom", "One-Piece", "Swim Shorts"],
  },
  {
    category: "Sleepwear",
    subCategories: ["Pyjama Top", "Pyjama Bottom", "Nightgown", "Robe"],
  },
];

const COLORS_LIST = [
  "Black", "White", "Navy", "Grey", "Beige", "Brown", "Red", "Pink",
  "Orange", "Yellow", "Green", "Blue", "Purple", "Cream", "Olive",
  "Burgundy", "Camel", "Tan",
];

const PATTERNS = [
  "Solid", "Striped", "Plaid", "Check", "Floral", "Graphic", "Abstract",
  "Animal Print", "Camo", "Tie-Dye", "Houndstooth", "Polka Dot", "Color Block",
];

const FITS = ["Slim", "Regular", "Relaxed", "Oversized", "Cropped", "Tailored"];

const BRANDS = [
  { name: "Zara", abbr: "ZR", bg: "#1a1a1a", url: "https://www.zara.com" },
  { name: "H&M", abbr: "H&M", bg: "#e50010", url: "https://www.hm.com" },
  { name: "Nike", abbr: "NK", bg: "#111111", url: "https://www.nike.com" },
  { name: "Mango", abbr: "MNG", bg: "#4a3728", url: "https://www.mango.com" },
  { name: "Uniqlo", abbr: "UQ", bg: "#cc0000", url: "https://www.uniqlo.com" },
  { name: "ASOS", abbr: "ASOS", bg: "#2d2d2d", url: "https://www.asos.com" },
  { name: "Adidas", abbr: "ADI", bg: "#000000", url: "https://www.adidas.com" },
  { name: "Massimo Dutti", abbr: "MD", bg: "#5c4a3a", url: "https://www.massimodutti.com" },
];

// ─── Utility ──────────────────────────────────────────────────────────────────

function genId() {
  return `i_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getBadgeStyle(badge: string) {
  if (badge.startsWith("Imported"))
    return { background: "#F0F0F5", color: "#2D2D5A", border: "1px solid #C0C0D4" };
  if (badge === "Digitized via Tag")
    return { background: "#EDF5F0", color: "#1A3028", border: "1px solid #C0D4CC" };
  if (badge === "Camera Upload" || badge === "Background Cleaned")
    return { background: "#F5EEF0", color: "#5A2D4A", border: "1px solid #D4B8C4" };
  return { background: "#F0ECE4", color: "#5A4A3A", border: "1px solid #D4C8B8" };
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

function OnboardScreen({ onEnter }: { onEnter: (name: string) => void }) {
  const [name, setName] = useState("");

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "#1A3028" }}
    >
      <div className="w-full max-w-xs space-y-10 fade-up">
        <div className="space-y-4 text-center">
          <div
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center float-anim"
            style={{
              background: "rgba(61,122,95,0.3)",
              border: "1px solid rgba(61,122,95,0.5)",
            }}
          >
            <Shirt size={28} color="#B8956A" />
          </div>
          <div>
            <h1 className="serif text-4xl" style={{ color: "#F7F4EE", lineHeight: 1.1 }}>
              Digital<br />
              <em>Closet</em>
            </h1>
            <p className="text-sm mt-2" style={{ color: "rgba(181,175,164,0.8)" }}>
              AI-powered wardrobe intelligence
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <label
            className="text-xs uppercase tracking-widest font-medium block"
            style={{ color: "#B8956A" }}
          >
            Your Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && name.trim() && onEnter(name.trim())
            }
            placeholder="Enter to begin"
            autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(61,122,95,0.4)",
              color: "#F7F4EE",
            }}
          />
          <button
            onClick={() => name.trim() && onEnter(name.trim())}
            disabled={!name.trim()}
            className="w-full py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
            style={{ background: "#B8956A", color: "#1A3028" }}
          >
            Enter Closet →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Channel A: Camera Upload ─────────────────────────────────────────────────

function ChannelA({
  onAddItem,
  onLog,
}: {
  onAddItem: (item: Partial<ClosetItem>, imageUrl?: string) => void;
  onLog: (method: string, exc: string, detail: string) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "loading" | "fail" | "success" | "done">("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ClassifyResponse | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setMessage("Please upload an image file.");
        setPhase("fail");
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      setPhase("loading");
      setMessage("Evaluating image quality…");

      try {
        const base64 = await fileToBase64(file);
        const res = await fetch("/api/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64,
            mediaType: file.type,
          }),
        });

        const data: ClassifyResponse = await res.json();
        setResult(data);

        if (data.status === "fail") {
          setMessage(data.message);
          setPhase("fail");
          onLog("camera_upload", "QUALITY_CHECK_FAIL", data.message);
        } else {
          setMessage(data.message);
          setPhase("success");
        }
      } catch (err: any) {
        setMessage("Something went wrong — try again.");
        setPhase("fail");
        onLog("camera_upload", "API_ERROR", err.message);
      }
    },
    [onLog]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const confirmAdd = () => {
    if (!result) return;
    onAddItem(
      {
        name: result.name || `${result.sub_category} (${result.colors?.[0] || ""})`,
        category: result.category,
        sub_category: result.sub_category,
        sub_category_confidence: result.sub_category_confidence,
        colors: result.colors,
        pattern: result.pattern,
        fit: result.fit,
        brand: result.brand || "Unknown",
        material: result.material || "",
        source_signals: ["image"],
        badge: "Camera Upload",
      },
      preview || undefined
    );
    setPhase("done");
    setTimeout(() => {
      setPhase("idle");
      setPreview(null);
      setResult(null);
      setMessage("");
    }, 2000);
  };

  const reset = () => {
    setPhase("idle");
    setPreview(null);
    setResult(null);
    setMessage("");
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {phase === "idle" && (
        <div
          className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all hover:border-emerald-600"
          style={{ borderColor: "var(--warm-grey)" }}
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <Upload size={28} color="var(--mid-grey)" className="mx-auto mb-3" />
          <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
            Tap to take a photo or upload from gallery
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--mid-grey)" }}>
            Camera · Gallery · Drag & Drop
          </p>
          <div className="flex justify-center gap-4 mt-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (fileRef.current) {
                  fileRef.current.removeAttribute("capture");
                  fileRef.current.click();
                  fileRef.current.setAttribute("capture", "environment");
                }
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg"
              style={{ background: "var(--emerald)", color: "#F7F4EE" }}
            >
              <Camera size={12} /> Camera
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileRef.current?.click();
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg"
              style={{
                background: "var(--faint)",
                border: "1px solid var(--warm-grey)",
                color: "var(--mid-grey)",
              }}
            >
              <Upload size={12} /> Gallery
            </button>
          </div>
        </div>
      )}

      {preview && phase !== "idle" && (
        <div className="relative rounded-2xl overflow-hidden" style={{ maxHeight: 300 }}>
          <img
            src={preview}
            alt="Uploaded garment"
            className="w-full object-cover"
            style={{ maxHeight: 300 }}
          />
          {phase === "loading" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3"
              style={{ background: "rgba(26,48,40,0.8)" }}
            >
              <div
                className="w-8 h-8 rounded-full border-2 spin-anim"
                style={{ borderColor: "#B8956A", borderTopColor: "transparent" }}
              />
              <p className="text-sm" style={{ color: "#F7F4EE" }}>
                {message}
              </p>
              <div
                className="scan-line"
                style={{ position: "absolute", top: 0, left: 0, right: 0 }}
              />
            </div>
          )}
          {phase !== "loading" && (
            <button
              onClick={reset}
              className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.5)" }}
            >
              <X size={12} color="white" />
            </button>
          )}
        </div>
      )}

      {phase === "fail" && (
        <div
          className="rounded-2xl p-4 flex items-start gap-3 fade-in"
          style={{ background: "var(--error-bg)", border: "1px solid #F5C0C0" }}
        >
          <AlertTriangle size={16} color="var(--error-ink)" className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm" style={{ color: "var(--error-ink)" }}>
              {message}
            </p>
            <button
              onClick={reset}
              className="flex items-center gap-1 text-xs mt-2"
              style={{ color: "var(--mid-grey)" }}
            >
              <RotateCcw size={10} /> Try again
            </button>
          </div>
        </div>
      )}

      {phase === "success" && result && (
        <div className="space-y-3 fade-in">
          <div
            className="rounded-2xl p-4"
            style={{ background: "var(--success-bg)", border: "1px solid #C0D4CC" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={15} color="var(--emerald-bright)" />
              <p className="text-sm font-medium" style={{ color: "var(--emerald)" }}>
                Item classified
              </p>
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              {[
                ["Name", result.name],
                ["Category", `${result.category} → ${result.sub_category}`],
                ["Colors", result.colors?.join(", ")],
                ["Pattern", result.pattern],
                ["Fit", result.fit || "—"],
                ["Brand", result.brand || "Unknown"],
                ["Material", result.material || "—"],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <p className="text-xs uppercase tracking-wider" style={{ color: "var(--mid-grey)" }}>
                    {k}
                  </p>
                  <p className="text-xs font-medium" style={{ color: "var(--ink)" }}>
                    {v}
                  </p>
                </div>
              ))}
            </div>
            {result.sub_category_confidence === "low" && (
              <p className="text-xs mt-2" style={{ color: "#92400E" }}>
                ⚠ Sub-category confidence is low — you can edit after adding
              </p>
            )}
          </div>
          <button
            onClick={confirmAdd}
            className="w-full py-3 rounded-xl text-sm font-medium"
            style={{ background: "var(--emerald)", color: "#F7F4EE" }}
          >
            Add to Closet ✓
          </button>
        </div>
      )}

      {phase === "done" && (
        <div className="text-center py-8 fade-in">
          <CheckCircle size={28} color="var(--emerald-bright)" className="mx-auto mb-2" />
          <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
            Added to your closet. ✓
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Channel B: Tag Scanner ───────────────────────────────────────────────────

function ChannelB({
  onAddItem,
  onLog,
}: {
  onAddItem: (item: Partial<ClosetItem>) => void;
  onLog: (method: string, exc: string, detail: string) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "loading" | "result" | "done">("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<TagScanResponse | null>(null);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      setPhase("loading");
      setMessage("Reading tag…");

      try {
        const base64 = await fileToBase64(file);
        const res = await fetch("/api/tag-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64,
            mediaType: file.type,
          }),
        });

        const data: TagScanResponse = await res.json();
        setResult(data);
        setMessage(data.message);
        setPhase("result");

        if (data.status === "unreadable") {
          onLog("tag_scan", "OCR_LOW_CONFIDENCE", data.message);
        }
      } catch (err: any) {
        setMessage("Scan failed — try better lighting or a closer shot.");
        setPhase("result");
        onLog("tag_scan", "API_ERROR", err.message);
      }
    },
    [onLog]
  );

  const confirmAdd = () => {
    if (!result?.classification) return;
    const c = result.classification;
    onAddItem({
      name: c.name || `${c.sub_category} (Tag Scan)`,
      category: c.category,
      sub_category: c.sub_category,
      sub_category_confidence: c.sub_category_confidence,
      colors: c.colors,
      pattern: c.pattern,
      fit: c.fit,
      brand: result.extracted?.brand || "Unknown",
      material: c.material || result.extracted?.composition || "",
      source_signals: ["tag_scan"],
      badge: "Digitized via Tag",
    });
    setPhase("done");
    setTimeout(() => {
      setPhase("idle");
      setPreview(null);
      setResult(null);
      setMessage("");
    }, 2000);
  };

  const reset = () => {
    setPhase("idle");
    setPreview(null);
    setResult(null);
    setMessage("");
  };

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl p-3"
        style={{ background: "var(--emerald)" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Scan size={13} color="#B8956A" />
          <p className="text-xs font-medium" style={{ color: "#F7F4EE" }}>
            Tag Intelligence Engine
          </p>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "rgba(181,175,164,0.8)" }}>
          Take a close-up photo of the inner clothing label. Works with Inditex barcodes (Zara, Mango, Pull&Bear), RN/RUC numbers, SKU codes, and care labels.
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {phase === "idle" && (
        <div
          className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer"
          style={{ borderColor: "var(--warm-grey)" }}
          onClick={() => fileRef.current?.click()}
        >
          <Tag size={28} color="var(--mid-grey)" className="mx-auto mb-3" />
          <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
            Photograph the inner label
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--mid-grey)" }}>
            Get close, ensure good lighting
          </p>
          <div className="flex justify-center gap-3 mt-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (fileRef.current) {
                  fileRef.current.setAttribute("capture", "environment");
                  fileRef.current.click();
                }
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg"
              style={{ background: "var(--emerald)", color: "#F7F4EE" }}
            >
              <Camera size={12} /> Scan Tag
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (fileRef.current) {
                  fileRef.current.removeAttribute("capture");
                  fileRef.current.click();
                }
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg"
              style={{
                background: "var(--faint)",
                border: "1px solid var(--warm-grey)",
                color: "var(--mid-grey)",
              }}
            >
              <Upload size={12} /> Upload Photo
            </button>
          </div>
        </div>
      )}

      {preview && phase !== "idle" && (
        <div className="relative rounded-2xl overflow-hidden" style={{ maxHeight: 250 }}>
          <img src={preview} alt="Tag" className="w-full object-cover" style={{ maxHeight: 250 }} />
          {phase === "loading" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3"
              style={{ background: "rgba(26,48,40,0.85)" }}
            >
              <div
                className="w-8 h-8 rounded-full border-2 spin-anim"
                style={{ borderColor: "#B8956A", borderTopColor: "transparent" }}
              />
              <p className="text-sm" style={{ color: "#F7F4EE" }}>
                {message}
              </p>
            </div>
          )}
          <button
            onClick={reset}
            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.5)" }}
          >
            <X size={12} color="white" />
          </button>
        </div>
      )}

      {phase === "result" && result && (
        <div className="space-y-3 fade-in">
          {result.status === "unreadable" ? (
            <div
              className="rounded-2xl p-4"
              style={{ background: "var(--error-bg)", border: "1px solid #F5C0C0" }}
            >
              <p className="text-sm" style={{ color: "var(--error-ink)" }}>
                {result.message}
              </p>
              <button
                onClick={reset}
                className="flex items-center gap-1 text-xs mt-2"
                style={{ color: "var(--mid-grey)" }}
              >
                <RotateCcw size={10} /> Try again
              </button>
            </div>
          ) : (
            <>
              <div
                className="rounded-2xl p-4"
                style={{
                  background: result.status === "partial" ? "#FFFBEB" : "var(--success-bg)",
                  border: `1px solid ${result.status === "partial" ? "#FDE68A" : "#C0D4CC"}`,
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={15} color={result.status === "partial" ? "#D97706" : "var(--emerald-bright)"} />
                  <p className="text-sm font-medium" style={{ color: "var(--emerald)" }}>
                    {result.status === "partial" ? "Partial read" : "Tag decoded"} ✓
                  </p>
                  {result.discontinued_likely && (
                    <span
                      className="ml-auto text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "#FEF3C7", color: "#92400E" }}
                    >
                      Likely discontinued
                    </span>
                  )}
                </div>

                {result.extracted && (
                  <div className="space-y-1.5 mb-3">
                    <p className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--mid-grey)" }}>
                      Extracted
                    </p>
                    {[
                      ["Brand", result.extracted.brand],
                      ["Reference", result.extracted.reference],
                      ["Composition", result.extracted.composition],
                      ["Country", result.extracted.country],
                      ["Size", `${result.extracted.size_raw} → ${result.extracted.size_decoded}`],
                    ]
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k as string} className="flex justify-between text-xs">
                          <span style={{ color: "var(--mid-grey)" }}>{k}</span>
                          <span className="font-medium" style={{ color: "var(--ink)" }}>
                            {v}
                          </span>
                        </div>
                      ))}
                    {result.decoded?.color_from_ref && (
                      <div className="flex justify-between text-xs">
                        <span style={{ color: "var(--mid-grey)" }}>Color (from ref)</span>
                        <span className="font-medium" style={{ color: "var(--emerald-bright)" }}>
                          {result.decoded.color_from_ref} ({result.decoded.color_code})
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {result.classification && (
                  <div className="space-y-1.5 pt-3" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                    <p className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--mid-grey)" }}>
                      Classification
                    </p>
                    {[
                      ["Category", `${result.classification.category} → ${result.classification.sub_category}`],
                      ["Colors", result.classification.colors?.join(", ")],
                      ["Pattern", result.classification.pattern],
                      ["Fit", result.classification.fit || "—"],
                    ].map(([k, v]) => (
                      <div key={k as string} className="flex justify-between text-xs">
                        <span style={{ color: "var(--mid-grey)" }}>{k}</span>
                        <span className="font-medium" style={{ color: "var(--ink)" }}>
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {result.search?.query && (
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                    <p className="text-xs uppercase tracking-wider font-medium mb-1.5" style={{ color: "var(--mid-grey)" }}>
                      Find this item online
                    </p>
                    {result.search.suggested_sites?.map((site) => (
                      
                        key={site}
                        href={`https://www.google.com/search?q=${encodeURIComponent(result.search.query)}&tbm=shop`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs"
                        style={{ color: "var(--emerald-bright)" }}
                      >
                        <ExternalLink size={10} /> Search: {result.search.query}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={confirmAdd}
                className="w-full py-3 rounded-xl text-sm font-medium"
                style={{ background: "var(--emerald)", color: "#F7F4EE" }}
              >
                Add to Closet ✓
              </button>
            </>
          )}
        </div>
      )}

      {phase === "done" && (
        <div className="text-center py-8 fade-in">
          <CheckCircle size={28} color="var(--emerald-bright)" className="mx-auto mb-2" />
          <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
            Added to your closet. ✓
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Channel C: Brand Import ──────────────────────────────────────────────────

function ChannelC({
  onLog,
}: {
  onLog: (method: string, exc: string, detail: string) => void;
}) {
  const [selected, setSelected] = useState<(typeof BRANDS)[0] | null>(null);
  const [step, setStep] = useState<"brands" | "instructions" | "redirected">("brands");

  const handleBrand = (brand: (typeof BRANDS)[0]) => {
    setSelected(brand);
    setStep("instructions");
  };

  const goToBrand = () => {
    if (!selected) return;
    window.open(selected.url, "_blank");
    setStep("redirected");
  };

  if (step === "brands") {
    return (
      <div className="space-y-4">
        <div
          className="rounded-xl p-3"
          style={{ background: "var(--faint)", border: "1px solid var(--warm-grey)" }}
        >
          <p className="text-xs leading-relaxed" style={{ color: "var(--mid-grey)" }}>
            Select a brand to get guided instructions for exporting your purchase history. You'll be directed to the brand's website to find your order history.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BRANDS.map((b) => (
            <button
              key={b.name}
              onClick={() => handleBrand(b)}
              className="p-4 rounded-2xl flex flex-col items-center gap-2 transition-all hover:scale-105"
              style={{ background: "white", border: "1px solid var(--warm-grey)" }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{ background: b.bg, color: "white" }}
              >
                {b.abbr}
              </div>
              <span className="text-xs font-medium" style={{ color: "var(--ink)" }}>
                {b.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "instructions" && selected) {
    return (
      <div className="space-y-4 fade-up">
        <button
          onClick={() => setStep("brands")}
          className="text-xs flex items-center gap-1"
          style={{ color: "var(--mid-grey)" }}
        >
          ← Back
        </button>
        <div
          className="rounded-2xl p-4 space-y-4"
          style={{ background: "white", border: "1px solid var(--warm-grey)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ background: selected.bg, color: "white" }}
            >
              {selected.abbr}
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                Import from {selected.name}
              </p>
              <p className="text-xs" style={{ color: "var(--mid-grey)" }}>
                Follow these steps on their website
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {[
              `Go to ${selected.name}'s website and sign in to your account`,
              "Navigate to My Account → Orders or Purchase History",
              "Find the items you want to add to your Digital Closet",
              "Note the item name, reference number, and any details shown",
              "Come back here and use Tag Scan or Manual entry to add them",
            ].map((step, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span
                  className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium mt-0.5"
                  style={{ background: "var(--emerald)", color: "#F7F4EE" }}
                >
                  {i + 1}
                </span>
                <p style={{ color: "var(--ink)" }}>{step}</p>
              </div>
            ))}
          </div>
          <button
            onClick={goToBrand}
            className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
            style={{ background: "var(--emerald)", color: "#F7F4EE" }}
          >
            <ExternalLink size={14} /> Open {selected.name} Website
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-up">
      <div
        className="rounded-2xl p-4"
        style={{ background: "var(--success-bg)", border: "1px solid #C0D4CC" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <ExternalLink size={14} color="var(--emerald-bright)" />
          <p className="text-sm font-medium" style={{ color: "var(--emerald)" }}>
            {selected?.name} opened in new tab
          </p>
        </div>
        <p className="text-xs" style={{ color: "var(--mid-grey)" }}>
          Once you've found your items on {selected?.name}'s website, come back and use{" "}
          <strong>Tag Scan</strong> or <strong>Manual Entry</strong> to add them to your closet.
        </p>
      </div>
      <button
        onClick={() => {
          setStep("brands");
          setSelected(null);
        }}
        className="w-full py-2.5 rounded-xl text-sm"
        style={{
          background: "var(--faint)",
          border: "1px solid var(--warm-grey)",
          color: "var(--mid-grey)",
        }}
      >
        Import from another brand
      </button>
    </div>
  );
}

// ─── Channel D: Manual Entry ──────────────────────────────────────────────────

function ChannelD({
  onAddItem,
}: {
  onAddItem: (item: Partial<ClosetItem>) => void;
}) {
  const [step, setStep] = useState<"category" | "subcat" | "details" | "done">("category");
  const [selectedCat, setSelectedCat] = useState<(typeof MANUAL_CATEGORIES)[0] | null>(null);
  const [selectedSub, setSelectedSub] = useState("");
  const [form, setForm] = useState({
    name: "",
    brand: "",
    colors: [] as string[],
    pattern: "Solid",
    fit: "",
    material: "",
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const toggleColor = (c: string) => {
    const cur = form.colors;
    set(
      "colors",
      cur.includes(c) ? cur.filter((x) => x !== c) : cur.length < 2 ? [...cur, c] : cur
    );
  };

  const submit = () => {
    onAddItem({
      name:
        form.name ||
        `${selectedSub} (${form.colors[0] || selectedCat?.category || "Item"})`,
      category: selectedCat?.category || "Top",
      sub_category: selectedSub,
      sub_category_confidence: "high",
      colors: form.colors.length > 0 ? form.colors : ["Black"],
      pattern: form.pattern,
      fit: form.fit || null,
      brand: form.brand || "Unknown",
      material: form.material || "",
      source_signals: ["manual"],
      badge: "Manually Cataloged",
    });
    setStep("done");
    setTimeout(() => {
      setStep("category");
      setSelectedCat(null);
      setSelectedSub("");
      setForm({ name: "", brand: "", colors: [], pattern: "Solid", fit: "", material: "" });
    }, 2000);
  };

  if (step === "category") {
    return (
      <div className="space-y-3">
        <p
          className="text-xs uppercase tracking-widest font-medium"
          style={{ color: "var(--mid-grey)" }}
        >
          What type of item?
        </p>
        <div className="grid grid-cols-2 gap-2">
          {MANUAL_CATEGORIES.map((cat) => (
            <button
              key={cat.category}
              onClick={() => {
                setSelectedCat(cat);
                setStep("subcat");
              }}
              className="flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:scale-105"
              style={{ background: "white", border: "1px solid var(--warm-grey)" }}
            >
              <span className="text-2xl">{CATEGORY_ICONS[cat.category] || "👗"}</span>
              <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                {cat.category}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "subcat" && selectedCat) {
    return (
      <div className="space-y-3 fade-up">
        <button
          onClick={() => setStep("category")}
          className="text-xs flex items-center gap-1"
          style={{ color: "var(--mid-grey)" }}
        >
          ← Back
        </button>
        <p
          className="text-xs uppercase tracking-widest font-medium"
          style={{ color: "var(--mid-grey)" }}
        >
          {selectedCat.category} — What style?
        </p>
        <div className="grid grid-cols-2 gap-2">
          {selectedCat.subCategories.map((sub) => (
            <button
              key={sub}
              onClick={() => {
                setSelectedSub(sub);
                setStep("details");
              }}
              className="p-3 rounded-xl text-sm text-left transition-all"
              style={{ background: "white", border: "1px solid var(--warm-grey)", color: "var(--ink)" }}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "details") {
    return (
      <div className="space-y-4 fade-up">
        <button
          onClick={() => setStep("subcat")}
          className="text-xs flex items-center gap-1"
          style={{ color: "var(--mid-grey)" }}
        >
          ← Back
        </button>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: "var(--success-bg)" }}
        >
          <span className="text-lg">{CATEGORY_ICONS[selectedCat?.category || ""] || "👗"}</span>
          <p className="text-sm font-medium" style={{ color: "var(--emerald)" }}>
            {selectedSub}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { k: "name", label: "Item Name", ph: `e.g. Black ${selectedSub}` },
            { k: "brand", label: "Brand", ph: "e.g. Zara" },
            { k: "material", label: "Material", ph: "e.g. 100% Cotton" },
          ].map((f) => (
            <div key={f.k} className={f.k === "name" ? "col-span-2" : ""}>
              <label
                className="text-xs uppercase tracking-widest font-medium block mb-1"
                style={{ color: "var(--mid-grey)" }}
              >
                {f.label}
              </label>
              <input
                value={form[f.k as keyof typeof form] as string}
                onChange={(e) => set(f.k, e.target.value)}
                placeholder={f.ph}
                className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
                style={{
                  background: "white",
                  border: "1px solid var(--warm-grey)",
                  color: "var(--ink)",
                }}
              />
            </div>
          ))}
        </div>

        <div>
          <label
            className="text-xs uppercase tracking-widest font-medium block mb-2"
            style={{ color: "var(--mid-grey)" }}
          >
            Colors (max 2)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {COLORS_LIST.map((c) => (
              <button
                key={c}
                onClick={() => toggleColor(c)}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-all"
                style={
                  form.colors.includes(c)
                    ? { background: "var(--emerald)", color: "#F7F4EE" }
                    : {
                        background: "white",
                        border: "1px solid var(--warm-grey)",
                        color: "var(--mid-grey)",
                      }
                }
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: COLOR_HEX[c] || "#ccc" }}
                />
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              className="text-xs uppercase tracking-widest font-medium block mb-1"
              style={{ color: "var(--mid-grey)" }}
            >
              Pattern
            </label>
            <select
              value={form.pattern}
              onChange={(e) => set("pattern", e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
              style={{
                background: "white",
                border: "1px solid var(--warm-grey)",
                color: "var(--ink)",
              }}
            >
              {PATTERNS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="text-xs uppercase tracking-widest font-medium block mb-1"
              style={{ color: "var(--mid-grey)" }}
            >
              Fit
            </label>
            <select
              value={form.fit}
              onChange={(e) => set("fit", e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
              style={{
                background: "white",
                border: "1px solid var(--warm-grey)",
                color: "var(--ink)",
              }}
            >
              <option value="">—</option>
              {FITS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={submit}
          className="w-full py-3 rounded-xl text-sm font-medium"
          style={{ background: "var(--emerald)", color: "#F7F4EE" }}
        >
          Add to Closet ✓
        </button>
      </div>
    );
  }

  return (
    <div className="text-center py-8 fade-in">
      <CheckCircle size={28} color="var(--emerald-bright)" className="mx-auto mb-2" />
      <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
        Added to your closet. ✓
      </p>
    </div>
  );
}

// ─── Closet Grid ──────────────────────────────────────────────────────────────

function ClosetGrid({ items }: { items: ClosetItem[] }) {
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<ClosetItem | null>(null);

  const allCats = ["All", ...Array.from(new Set(items.map((i) => i.category)))];
  const shown = filter === "All" ? items : items.filter((i) => i.category === filter);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {allCats.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full transition-all"
            style={
              filter === c
                ? { background: "var(--emerald)", color: "#F7F4EE" }
                : {
                    background: "white",
                    border: "1px solid var(--warm-grey)",
                    color: "var(--mid-grey)",
                  }
            }
          >
            {c} ({c === "All" ? items.length : items.filter((i) => i.category === c).length})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((item) => {
          const color = item.colors[0] ? COLOR_HEX[item.colors[0]] || "#9CA3AF" : "#9CA3AF";
          const badgeStyle = getBadgeStyle(item.badge);
          return (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className="text-left rounded-2xl overflow-hidden transition-all hover:scale-105"
              style={{ background: "white", border: "1px solid var(--warm-grey)" }}
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-full object-cover"
                  style={{ height: 140 }}
                />
              ) : (
                <div
                  className="w-full flex items-center justify-center"
                  style={{
                    height: 140,
                    background: `${color}15`,
                    fontSize: 48,
                  }}
                >
                  {CATEGORY_ICONS[item.category] || "👗"}
                </div>
              )}
              <div className="p-3">
                <p
                  className="text-xs font-medium truncate"
                  style={{ color: "var(--ink)" }}
                >
                  {item.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--mid-grey)" }}>
                  {item.brand}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {item.colors.map((c) => (
                    <span
                      key={c}
                      className="w-3 h-3 rounded-full border"
                      style={{
                        background: COLOR_HEX[c] || "#ccc",
                        borderColor: "var(--warm-grey)",
                      }}
                      title={c}
                    />
                  ))}
                </div>
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full mt-1.5 inline-block"
                  style={badgeStyle as any}
                >
                  {item.badge}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {shown.length === 0 && (
        <div className="text-center py-12" style={{ color: "var(--mid-grey)" }}>
          <Layers size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No items in this category yet</p>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          onClick={() => setSelected(null)}
        >
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.3)" }} />
          <div
            className="relative w-80 h-full overflow-y-auto p-5 shadow-xl fade-in"
            style={{ background: "var(--parchment)", borderLeft: "1px solid var(--warm-grey)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "var(--faint)" }}
            >
              <X size={14} color="var(--mid-grey)" />
            </button>
            {selected.imageUrl ? (
              <img
                src={selected.imageUrl}
                alt={selected.name}
                className="w-full rounded-2xl object-cover mb-4"
                style={{ height: 200 }}
              />
            ) : (
              <div
                className="w-full rounded-2xl flex items-center justify-center mb-4"
                style={{ height: 160, background: "var(--faint)", fontSize: 64 }}
              >
                {CATEGORY_ICONS[selected.category] || "👗"}
              </div>
            )}
            <h3 className="serif text-xl" style={{ color: "var(--emerald)" }}>
              {selected.name}
            </h3>
            <p className="text-xs mt-0.5 mb-4" style={{ color: "var(--mid-grey)" }}>
              {selected.brand}
            </p>
            <div className="space-y-2.5">
              {[
                ["Category", selected.category],
                ["Sub-Category", `${selected.sub_category}${selected.sub_category_confidence === "low" ? " ⚠" : ""}`],
                ["Colors", selected.colors.join(", ")],
                ["Pattern", selected.pattern],
                ["Fit", selected.fit || "—"],
                ["Material", selected.material || "—"],
              ].map(([k, v]) => (
                <div
                  key={k as string}
                  className="flex justify-between pb-2"
                  style={{ borderBottom: "1px solid var(--warm-grey)" }}
                >
                  <span
                    className="text-xs uppercase tracking-wider font-medium"
                    style={{ color: "var(--mid-grey)" }}
                  >
                    {k}
                  </span>
                  <span className="text-xs" style={{ color: "var(--ink)" }}>
                    {v}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {selected.source_signals.map((s) => (
                <span
                  key={s}
                  className="mono text-xs px-2 py-0.5 rounded"
                  style={{ background: "var(--emerald)", color: "rgba(181,175,164,0.9)" }}
                >
                  {s}
                </span>
              ))}
            </div>
            <p className="text-xs mt-3" style={{ color: "var(--mid-grey)" }}>
              Added {new Date(selected.addedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stylist Chat ─────────────────────────────────────────────────────────────

function StylistChat({ items }: { items: ClosetItem[] }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    {
      role: "assistant",
      content: `Good to meet you. I've looked through your ${items.length} pieces — you've got a strong neutral foundation to work with. What are you dressing for?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const closetContext = items
    .map((i) => `- ${i.name} (${i.category}, ${i.colors.join("/")}, ${i.brand})`)
    .join("\n");

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const newMessages = [...messages, { role: "user" as const, content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          closetContext,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I'm having trouble connecting — try again in a moment." },
      ]);
    }
    setLoading(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 200px)", minHeight: 400 }}>
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "gap-2.5"} fade-in`}>
            {m.role === "assistant" && (
              <div
                className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ background: "var(--emerald)" }}
              >
                <span className="text-xs">✦</span>
              </div>
            )}
            <div
              className="max-w-xs px-4 py-3 rounded-2xl text-sm leading-relaxed"
              style={
                m.role === "user"
                  ? { background: "var(--emerald)", color: "#F7F4EE", borderRadius: "18px 18px 4px 18px" }
                  : {
                      background: "white",
                      border: "1px solid var(--warm-grey)",
                      color: "var(--ink)",
                      borderRadius: "18px 18px 18px 4px",
                    }
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5 fade-in">
            <div
              className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center gap-0.5"
              style={{ background: "var(--emerald)" }}
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="wave-bar"
                  style={{ animationDelay: `${i * 0.1}s`, height: 12 }}
                />
              ))}
            </div>
            <div
              className="px-4 py-3 rounded-2xl flex items-center gap-1"
              style={{ background: "white", border: "1px solid var(--warm-grey)" }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full pulse-anim"
                  style={{ background: "var(--warm-grey)", animationDelay: `${i * 0.3}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div
        className="flex gap-2 pt-3"
        style={{ borderTop: "1px solid var(--warm-grey)" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about your wardrobe…"
          className="flex-1 px-4 py-2.5 rounded-full text-sm focus:outline-none"
          style={{
            background: "white",
            border: "1px solid var(--warm-grey)",
            color: "var(--ink)",
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40"
          style={{ background: "var(--emerald)" }}
        >
          <Send size={14} color="#F7F4EE" />
        </button>
      </div>
    </div>
  );
}

// ─── Admin Logs ───────────────────────────────────────────────────────────────

function AdminLogs({ logs }: { logs: AdminLog[] }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid var(--warm-grey)" }}
    >
      <div
        className="px-5 py-3 flex items-center gap-2"
        style={{ background: "#0F0E0D" }}
      >
        <div className="w-2 h-2 rounded-full bg-red-500 pulse-anim" />
        <div className="w-2 h-2 rounded-full" style={{ background: "#F59E0B" }} />
        <div className="w-2 h-2 rounded-full" style={{ background: "#10B981" }} />
        <span className="mono text-xs ml-2" style={{ color: "#3D7A5F" }}>
          admin.engine.log
        </span>
      </div>
      <div
        className="p-5 space-y-4 min-h-32"
        style={{ background: "#111" }}
      >
        {logs.length === 0 ? (
          <p className="mono text-xs" style={{ color: "#2A4F3E" }}>
            // No exceptions logged. Start adding items.
          </p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="mono text-xs space-y-1 fade-in">
              <p style={{ color: "#4A7A6A" }}>
                [{new Date(log.ts).toLocaleString()}]
              </p>
              <p style={{ color: "#B8956A" }}>METHOD: {log.method.toUpperCase()}</p>
              <p className="text-red-400">EXCEPTION: {log.exception}</p>
              <p style={{ color: "#9CA3AF" }}>DETAIL: {log.detail}</p>
              <div
                style={{ borderTop: "1px solid #222" }}
                className="pt-2 mt-2"
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function Analytics({ items, logs }: { items: ClosetItem[]; logs: AdminLog[] }) {
  const total = items.length + logs.length;
  const rate = total > 0 ? Math.round((items.length / total) * 100) : 100;
  const src: Record<string, number> = {};
  items.forEach((i) => {
    const s = i.source_signals[0] || "manual";
    src[s] = (src[s] || 0) + 1;
  });
  const SRC_LABEL: Record<string, string> = {
    image: "Camera",
    tag_scan: "Tag",
    brand_import: "Brand",
    manual: "Manual",
    visual_search: "Visual",
  };
  const BAR_COLORS = [
    "var(--emerald)", "var(--emerald-bright)", "var(--gold)", "var(--gold-light)", "var(--mid-grey)",
  ];

  return (
    <div className="space-y-3 mb-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Items", val: items.length },
          { label: "Success", val: `${rate}%` },
          { label: "Failures", val: logs.length },
          { label: "Channels", val: Object.keys(src).length },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl p-3"
            style={{ border: "1px solid var(--warm-grey)" }}
          >
            <p
              className="text-xs uppercase tracking-widest font-medium"
              style={{ color: "var(--mid-grey)" }}
            >
              {s.label}
            </p>
            <p className="serif text-2xl mt-0.5" style={{ color: "var(--emerald)" }}>
              {s.val}
            </p>
          </div>
        ))}
      </div>
      {Object.keys(src).length > 0 && (
        <div
          className="bg-white rounded-2xl p-3"
          style={{ border: "1px solid var(--warm-grey)" }}
        >
          <p
            className="text-xs uppercase tracking-widest font-medium mb-2"
            style={{ color: "var(--mid-grey)" }}
          >
            Source Mix
          </p>
          <div
            className="flex gap-0.5 h-1.5 rounded-full overflow-hidden mb-2"
            style={{ background: "var(--faint)" }}
          >
            {Object.entries(src).map(([k, v], i) => (
              <div
                key={k}
                style={{
                  width: `${(v / items.length) * 100}%`,
                  background: BAR_COLORS[i % BAR_COLORS.length],
                }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(src).map(([k, v], i) => (
              <div key={k} className="flex items-center gap-1.5 text-xs">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: BAR_COLORS[i % BAR_COLORS.length] }}
                />
                <span style={{ color: "var(--ink)" }}>{SRC_LABEL[k] || k}</span>
                <span style={{ color: "var(--mid-grey)" }}>({v})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<string | null>(null);
  const [items, setItems] = useState<ClosetItem[]>(SEED_ITEMS);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [tab, setTab] = useState<Tab>("closet");
  const [channel, setChannel] = useState<Channel>("A");

  const addItem = (partial: Partial<ClosetItem>, imageUrl?: string) => {
    setItems((prev) => [
      {
        id: genId(),
        name: partial.name || "Item",
        category: partial.category || "Top",
        sub_category: partial.sub_category || "",
        sub_category_confidence: partial.sub_category_confidence || "high",
        colors: partial.colors || ["Black"],
        pattern: partial.pattern || "Solid",
        fit: partial.fit ?? null,
        brand: partial.brand || "Unknown",
        material: partial.material || "",
        source_signals: partial.source_signals || ["manual"],
        badge: partial.badge || "Manually Cataloged",
        imageUrl: imageUrl,
        addedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const addLog = (method: string, exception: string, detail: string) => {
    setLogs((prev) => [
      {
        id: `l_${Date.now()}`,
        ts: new Date().toISOString(),
        method,
        exception,
        detail,
      },
      ...prev,
    ]);
  };

  if (!user) return <OnboardScreen onEnter={setUser} />;

  const CHANNELS_CONFIG = [
    { id: "A" as Channel, label: "Camera", sub: "AI Vision QC", Icon: Camera },
    { id: "B" as Channel, label: "Tag Scan", sub: "Label intelligence", Icon: Tag },
    { id: "C" as Channel, label: "Brand Import", sub: "Guided redirect", Icon: ShoppingBag },
    { id: "D" as Channel, label: "Manual", sub: "Category picker", Icon: PenLine },
  ];

  const NAV = [
    { id: "closet" as Tab, label: "Closet", Icon: Grid3X3 },
    { id: "add" as Tab, label: "Add Item", Icon: Plus },
    { id: "stylist" as Tab, label: "Stylist", Icon: MessageCircle },
    { id: "logs" as Tab, label: "Logs", Icon: Terminal },
  ];

  const PAGE = {
    closet: { h: "Your Wardrobe", sub: `${items.length} pieces cataloged` },
    add: { h: "Add an Item", sub: "Choose ingestion channel" },
    stylist: { h: "AI Stylist", sub: "Wardrobe intelligence" },
    logs: { h: "Admin Logs", sub: `${logs.length} exception${logs.length !== 1 ? "s" : ""}` },
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--parchment)" }}>
      <header
        className="sticky top-0 z-40"
        style={{
          background: "rgba(247,244,238,0.96)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--warm-grey)",
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "var(--emerald)" }}
            >
              <Shirt size={15} color="#B8956A" />
            </div>
            <div>
              <span className="serif text-base" style={{ color: "var(--ink)" }}>
                Digital Closet
              </span>
              <span className="text-xs ml-2" style={{ color: "var(--mid-grey)" }}>
                — {user}
              </span>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all"
                style={
                  tab === n.id
                    ? { background: "var(--emerald)", color: "#F7F4EE" }
                    : { color: "var(--mid-grey)" }
                }
              >
                <n.Icon size={12} />
                <span className="hidden sm:inline">{n.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 pb-8">
        <div className="mb-5">
          <h2 className="serif text-2xl" style={{ color: "var(--emerald)" }}>
            {PAGE[tab].h}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--mid-grey)" }}>
            {PAGE[tab].sub}
          </p>
        </div>

        {tab === "closet" && (
          <>
            <Analytics items={items} logs={logs} />
            <ClosetGrid items={items} />
          </>
        )}

        {tab === "add" && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {CHANNELS_CONFIG.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setChannel(c.id)}
                  className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl border transition-all"
                  style={
                    channel === c.id
                      ? {
                          background: "var(--emerald)",
                          borderColor: "var(--emerald)",
                          color: "#F7F4EE",
                        }
                      : {
                          background: "white",
                          borderColor: "var(--warm-grey)",
                          color: "var(--mid-grey)",
                        }
                  }
                >
                  <c.Icon size={15} />
                  <span className="text-xs font-medium leading-none">{c.label}</span>
                  <span className="text-xs leading-none opacity-60">{c.sub}</span>
                </button>
              ))}
            </div>
            <div
              className="bg-white rounded-2xl p-4"
              style={{ border: "1px solid var(--warm-grey)" }}
            >
              {channel === "A" && <ChannelA onAddItem={addItem} onLog={addLog} />}
              {channel === "B" && <ChannelB onAddItem={addItem} onLog={addLog} />}
              {channel === "C" && <ChannelC onLog={addLog} />}
              {channel === "D" && <ChannelD onAddItem={addItem} />}
            </div>
          </div>
        )}

        {tab === "stylist" && <StylistChat items={items} />}
        {tab === "logs" && <AdminLogs logs={logs} />}
      </main>

      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 px-2 py-2"
        style={{
          background: "rgba(247,244,238,0.97)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid var(--warm-grey)",
        }}
      >
        <div className="grid grid-cols-4 gap-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className="flex flex-col items-center gap-1 py-2 rounded-xl transition-all"
              style={
                tab === n.id
                  ? { background: "var(--emerald)", color: "#F7F4EE" }
                  : { color: "var(--mid-grey)" }
              }
            >
              <n.Icon size={16} />
              <span className="text-xs leading-none font-medium">{n.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
