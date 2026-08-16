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

## STEP 3 — GARMENT CLASSIFICATION
Using all extracted and decoded data, classify the item:

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
Your entire response must be ONLY the JSON object below — nothing before it, nothing after it. The first character of your response must be "{" and the last character must be "}". Do not repeat the object, do not add a second copy, do not add any closing remarks after it.

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
  "search": {
    "query": "",
    "suggested_sites": []
  },
  "discontinued_likely": false,
  "source_signals": ["tag_scan"]
}

If tag is completely unreadable: { "status": "unreadable", "message": "Can't read this tag — try better lighting or a closer shot." }
If tag is partially readable: return what you can with "status": "partial" and flag uncertain fields.`;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { imageBase64, mediaType } = req.body;

    if (!imageBase64 || !mediaType) {
      return res.status(400).json({ error: "Missing image data" });
    }

    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2048,
      system: TAG_SCAN_SYSTEM_PROMPT,
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
              text: "Read this clothing tag completely. Extract all text, decode any reference numbers or barcodes using your brand intelligence, classify the garment, and return the full JSON payload.",
            },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    let clean = text.replace(/```json\n?|\n?```/g, "").trim();

    // Model output can include a complete, valid JSON object followed by
    // extra trailing content (or, less often, leading prose despite
    // instructions not to) — strip anything outside the outermost braces
    // rather than trusting the model never adds anything extra.
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.slice(firstBrace, lastBrace + 1);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return res.status(502).json({
        status: "unreadable",
        message: "Scan failed to produce a readable result — try again.",
      });
    }

    const VALID_STATUSES = ["success", "partial", "unreadable"];
    if (!VALID_STATUSES.includes(parsed.status)) {
      parsed.status = parsed.classification ? "partial" : "unreadable";
    }

    // Guard against the model omitting classification on partial/success
    // status — otherwise the client silently renders "decoded" with every
    // field blank instead of anything actionable.
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

    if (!parsed.message || typeof parsed.message !== "string" || !parsed.message.trim()) {
      parsed.message =
        parsed.status === "success"
          ? "Tag decoded ✓"
          : parsed.status === "partial"
          ? "Tag partially read — please review and complete the details."
          : "Couldn't read this tag clearly — try a closer, well-lit shot.";
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
