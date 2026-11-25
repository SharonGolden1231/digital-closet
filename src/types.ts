export interface ClosetItem {
  id: string;
  name: string;
  category: string;
  sub_category: string;
  sub_category_confidence: "high" | "low";
  colors: string[];
  pattern: string;
  fit: string | null;
  brand: string;
  material: string;
  source_signals: string[];
  badge: string;
  imageUrl?: string;
  addedAt: string;
}

export interface AdminLog {
  id: string;
  ts: string;
  method: string;
  exception: string;
  detail: string;
}

export interface ClassifyResponse {
  phase: string;
  status: "success" | "fail";
  message: string;
  name?: string;
  category?: string;
  sub_category?: string;
  sub_category_confidence?: "high" | "low";
  colors?: string[];
  pattern?: string;
  fit?: string | null;
  brand?: string;
  material?: string;
}

export interface TagScanResponse {
  status: "success" | "partial" | "unreadable";
  message: string;
  extracted: {
    brand: string;
    reference: string;
    rn_number: string;
    barcode: string;
    country: string;
    composition: string;
    size_raw: string;
    size_decoded: string;
    // Main size exactly as printed, its system, other printed sizes, the label text it came from.
    size_printed?: string;
    size_system?: string;
    size_equivalents?: { system?: string; value?: string }[];
    size_evidence?: string;
    // Body measurements from a body code like 165/84A (the code stays in size_raw).
    body_fit?: { height_cm?: number; chest_cm?: number; waist_cm?: number };
  };
  decoded: {
    color_from_ref: string;
    color_code: string;
    size_international: string;
    brand_group: string;
  };
  classification: {
    name: string;
    category: string;
    sub_category: string;
    sub_category_confidence: "high" | "low";
    // "label" only when the tag's printed text names the garment type.
    category_source?: "label" | "guess";
    colors: string[];
    pattern: string;
    fit: string;
    material: string;
  };
  search: {
    query: string;
    suggested_sites: string[];
  };
  discontinued_likely: boolean;
  source_signals: string[];
}

export type Tab = "closet" | "add" | "stylist" | "logs" | "requests" | "settings";
export type Channel = "A" | "B" | "C" | "D";
