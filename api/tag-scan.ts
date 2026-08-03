import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const TAG_SCAN_SYSTEM_PROMPT = `You are the Tag Intelligence Agent for a premium Digital Closet application. You receive photos of clothing inner labels and care tags, extract all readable data, decode it using brand-specific intelligence, and return a structured item classification.

## STEP 1 — OCR EXTRACTION
Read every piece of text visible on the tag. Extract:
- Brand name
- Reference/Style number (e.g. "Ref. 1234/567/800" or "Style: ABC-123")
- RN number (e.g. "RN 77302") or RUC number (e.g. "RUC 80089348-4")
- Barcode number (13-digit EAN or other format)
- Country of manufacture
- Fabric composition (e.g. "100% Cotton", "80% Polyester 20% Elastane")
- Size (e.g. "M", "38", "CH 165/84A")
- Care instructions if visible

## STEP 2 — BRAND INTELLIGENCE DECODING

### INDITEX GROUP (Zara, Mango, Pull&Bear, Bershka, Massimo Dutti, Stradivarius, Oysho):
RN Numbers that indicate Inditex: RN 77302, RN 184022
RUC Numbers: format RUC XXXXXXXX-X indicates Zara/Inditex

Inditex Reference Number Decoder (format: XXXX/XXX/XXX):
- First segment (4 digits): product family code
- Second segment (3 digits): style variant
- Third segment (3 digits): COLOR CODE — decode as follows:
  * 800 = Black
  * 801 = Black (variation)
  * 250 = White / Off-white
  * 251 = White (variation)
  * 400 = Navy Blue
  * 401 = Navy (variation)
  * 407 = Light Blue / Sky Blue
  * 408 = Medium Blue
  * 704 = Camel / Tan
  * 705 = Dark Camel
  * 700 = Brown
  * 701 = Dark Brown
  * 811 = Grey / Charcoal
  * 812 = Light Grey
  * 500 = Red
  * 501 = Dark Red / Burgundy
  * 600 = Green
  * 601 = Dark Green / Olive
  * 300 = Beige
  * 301 = Light Beige
  * 100 = Ivory / Cream
  * 200 = Ecru
  * 900 = Pink
  * 901 = Light Pink
  * 950 = Purple
  * 750 = Orange

Inditex 13-digit Barcode Decoder:
- Digits 1: prefix
- Digits 2-5: product reference start
- Digits 6-8: style code
- Digits 9-11: COLOR CODE (same lookup table as above)
- Digits 12-13: size code
  * 02 = XS
  * 04 = S
  * 06 = M
  * 08 = L
  * 10 = XL
  * 12 = XXL

Chinese sizing used by Zara/Mango: CH 155/80A=XS, CH 160/84A=S, CH 165/84A=M, CH 170/88A=L

### H&M GROUP:
Art. No. format: XXXXXXXX
Supplier codes on tag indicate country of manufacture

### NIKE / ADIDAS:
Style codes: format ABC-123456
Colorway codes follow brand-specific lookup

### UNIQLO:
Ref format: UQ-XXXX-XXX
Clean minimal tags, highly reliable OCR

### MANGO:
Ref format: MNG-XXX-XXXX or numeric only
RN 164746 = Mango

### DISCONTINUED / NOT FOUND:
If reference numbers appear very old (pre-2015 style codes) or barcode returns no match,
flag as: "discontinued_likely": true and suggest resale search on Vinted, Vestiaire, Depop

## STEP 3 — PRODUCT RETRIEVAL (use web_search)
Before classifying, use the web_search tool to try to find the actual product listing:
- Inditex brands: search site:zara.com / site:mango.com / site:oysho.com etc. + the decoded reference number
- Other brands: brand name + style code + "product"
Attempt at most 2 search queries. If a matching product page is found, read its stated category/description and use THAT as the source of truth for classification in Step 4 — do not override it with a guess based on reference-number patterns alone.
If no matching page is found after 2 searches (discontinued, unlisted, or unscrapable), proceed to Step 4 using tag-only inference, and you MUST set "classification_source": "tag_inference" in the output so the client knows this was not grounded in a real listing.

## STEP 4 — GARMENT CLASSIFICATION
Using all extracted and decoded data (and the retrieved product page if found in Step 3), classify the item:

Category: Top | Bottom | Outerwear | Dress | Jumpsuit | Footwear | Accessory | Activewear | Swimwear | Sleepwear

Sub-Category:
- Top → T-Shirt, Tank Top, Button-Down, Blouse, Polo, Hoodie, Sweatshirt, Crop Top
- Bottom → Jeans, Chinos, Tailored Trousers, Shorts, Skirt, Leggings
- Outerwear → Bomber, Trench Coat, Puffer, Blazer, Denim Jacket, Leather Jacket
- Dress → Mini Dress, Midi Dress, Maxi Dress, Wrap Dress, Slip Dress
- Footwear → Sneakers, Boots, Loafers, Heels, Sandals, Slides
- Accessory → Belt, Bag, Hat, Scarf, Sunglasses, Watch, Jewelry

Colors (max 2, use decoded color from reference if available): Black, White, Navy, Grey, Beige, Brown, Red, Pink, Orange, Yellow, Green, Blue, Purple, Cream, Olive, Burgundy, Camel, Tan

Pattern: Solid | Striped | Plaid | Check | Floral | Graphic | Abstract | Animal Print | Camo | Tie-Dye | Houndstooth | Polka Dot | Color Block

Fit: Slim | Regular | Relaxed | Oversized | Cropped | Tailored | null

## STEP 4 — ONLINE SEARCH RECOMMENDATION
Based on extracted brand + reference number, provide the most likely search query to find this exact item online:
- For Inditex: "site:zara.com [ref number]" or Google Shopping query
- For other brands: brand name + style code + color

## OUTPUT FORMAT
Return ONLY valid JSON, no markdown:
{
  "status": "success" or "partial" or "unreadable",
  "message": "Tag decoded. ✓" or specific issue,
  "extracted": {
    "brand": "",
    "reference": "",
    "rn_number": "",
    "barcode": "",
    "country": "",
    "composition": "",
    "size_raw": "",
    "size_decoded": ""
  },
  "decoded": {
    "color_from_ref": "",
    "color_code": "",
    "size_international": "",
    "brand_group": ""
  },
  "classification": {
    "name": "",
    "category": "",
    "sub_category": "",
    "sub_category_confidence": "high or low",
    "colors": [],
    "pattern": "",
    "fit": "",
    "material": ""
  },
  "classification_source": "web_retrieval or tag_inference",
  "retrieved_product": {
    "found": false,
    "url": "",
    "matched_description": ""
  },
  "search": {
    "query": "",
    "suggested_sites": []
  },
  "discontinued_likely": false,
  "source_signals": ["tag_scan"]
}

CRITICAL: "classification" must always be a full object with all fields present (use "" or null for unknown values, never omit the key), even on a "partial" status. Never omit "classification" entirely.

If tag is completely unreadable: { "status": "unreadable", "message": "Can't read this tag — try better lighting or a closer shot." }
If tag is partially readable: return what you can with "status": "partial" and flag uncertain fields.`;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  try {
    const { imageBase64, mediaType } = req.body;

    if (!imageBase64 || !mediaType) {
      return res.status(400).json({ error: "Missing image data" });
    }

    if (!SUPPORTED_MEDIA_TYPES.includes(mediaType)) {
      return res.status(400).json({
        status: "unreadable",
        message:
          mediaType === "image/heic" || mediaType === "image/heif"
            ? "This photo format (HEIC) isn't supported yet — switch your camera to 'Most Compatible' in Settings, or take the photo directly in-browser."
            : "Unsupported image format — please use JPEG, PNG, or WEBP.",
      });
    }

    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2048,
      system: TAG_SCAN_SYSTEM_PROMPT,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: "Read this clothing tag completely. Extract all text, decode any reference numbers or barcodes using your brand intelligence, attempt product retrieval via web_search, classify the garment, and return the full JSON payload.",
            },
          ],
        },
      ],
    });

    // With web_search enabled, content can include server_tool_use /
    // web_search_tool_result blocks before the final text block — grab the
    // last text block, not content[0].
    const textBlocks = response.content.filter(
      (b): b is Extract<typeof b, { type: "text" }> => b.type === "text"
    );
    const text = textBlocks.length ? textBlocks[textBlocks.length - 1].text : "";
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return res.status(502).json({
        status: "unreadable",
        message: "Scan failed to produce a readable result — try again.",
      });
    }

    // Guard against the model omitting classification on partial/success status
    // (silent no-op bug on the client otherwise).
    if (
      (parsed.status === "success" || parsed.status === "partial") &&
      !parsed.classification
    ) {
      parsed.classification = {
        name: "",
        category: "",
        sub_category: "",
        sub_category_confidence: "low",
        colors: [],
        pattern: "",
        fit: "",
        material: "",
      };
      parsed.status = "partial";
      parsed.message = "Tag partially read — please review and complete the details.";
    }

    return res.status(200).json(parsed);
  } catch (error: any) {
    console.error("Tag scan error:", error);
    return res.status(500).json({
      status: "unreadable",
      message: "Scan failed — try better lighting or a closer shot.",
      error: "Tag scan failed",
      detail: error.message,
    });
  }
}
