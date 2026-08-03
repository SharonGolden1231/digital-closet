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
  extracted?: {
    brand: string;
    reference: string;
    rn_number: string;
    barcode: string;
    country: string;
    composition: string;
    size_raw: string;
    size_decoded: string;
  };
  decoded?: {
    color_from_ref: string;
    color_code: string;
    size_international: string;
    brand_group: string;
  };
  classification?: {
    name: string;
    category: string;
    sub_category: string;
    sub_category_confidence: "high" | "low";
    colors: string[];
    pattern: string;
    fit: string;
    material: string;
  };
  // "web_retrieval" = grounded in an actual product listing found via search.
  // "tag_inference" = guessed from ref/decode text alone, no listing found —
  // client should treat category/sub_category as low-trust and prompt for
  // a garment photo instead of accepting silently.
  classification_source?: "web_retrieval" | "tag_inference";
  retrieved_product?: {
    found: boolean;
    url: string;
    matched_description: string;
  };
  search?: {
    query: string;
    suggested_sites: string[];
  };
  discontinued_likely?: boolean;
  source_signals?: string[];
}

export type Tab = "closet" | "add" | "stylist" | "logs";
export type Channel = "A" | "B" | "C" | "D";
