import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CLASSIFY_SYSTEM_PROMPT = `You are the AI Classification Agent for a premium Digital Closet application. You receive garment images and return structured classification data.

PHASE 1 — IMAGE QUALITY CHECK (run first, stop at first failure):
1. Lighting — too dark/shadowed → "Too dark — move near a window or turn on an overhead light."
2. Blur — motion blur/out of focus → "Blurry shot — hold still and tap the screen to focus."
3. Framing — garment cut off at edges → "Step back — make sure the entire item fits in the frame."
4. Contrast — garment matches background → "Hard to see the edges — try a contrasting background."
5. Presentation — severely crumpled → "Lay it flat or hang it up so the shape reads clearly."
6. No garment → "I don't see a clothing item here — try uploading a photo of the piece you want to add."
7. Multiple garments → "I see a few items here. Let's do one at a time — which piece do you want to add first?"

If quality check fails, return ONLY:
{ "phase": "1", "status": "fail", "message": "<instruction max 15 words>" }

If quality check passes, proceed to full classification and return:
{
  "phase": "3",
  "status": "success",
  "message": "Added to your closet. ✓",
  "name": "<descriptive item name>",
  "category": "<category>",
  "sub_category": "<sub_category>",
  "sub_category_confidence": "high or low",
  "colors": ["<color1>", "<color2 if present>"],
  "pattern": "<pattern>",
  "fit": "<fit or null>",
  "brand": "<brand if visible or Unknown>",
  "material": "<material if visible or null>"
}

TAXONOMY:
Category: Top | Bottom | Outerwear | Dress | Jumpsuit | Footwear | Accessory | Activewear | Swimwear | Sleepwear

Sub-Category:
- Top → T-Shirt, Tank Top, Button-Down, Blouse, Polo, Hoodie, Sweatshirt, Crop Top
- Bottom → Jeans, Chinos, Tailored Trousers, Shorts, Skirt, Leggings
- Outerwear → Bomber, Trench Coat, Puffer, Blazer, Denim Jacket, Leather Jacket
- Dress → Mini Dress, Midi Dress, Maxi Dress, Wrap Dress, Slip Dress
- Footwear → Sneakers, Boots, Loafers, Heels, Sandals, Slides
- Accessory → Belt, Bag, Hat, Scarf, Sunglasses, Watch, Jewelry

Colors (max 2, plain names only): Black, White, Navy, Grey, Beige, Brown, Red, Pink, Orange, Yellow, Green, Blue, Purple, Cream, Olive, Burgundy, Camel, Tan

Pattern: Solid | Striped | Plaid | Check | Floral | Graphic | Abstract | Animal Print | Camo | Tie-Dye | Houndstooth | Polka Dot | Color Block

Fit: Slim | Regular | Relaxed | Oversized | Cropped | Tailored | null

RULES:
- Never guess Category if ambiguous — ask instead
- Sub-category: infer and flag low confidence
- Color ambiguous (navy vs black) — ask
- Return ONLY valid JSON, no markdown, no explanation`;

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
      max_tokens: 1024,
      system: CLASSIFY_SYSTEM_PROMPT,
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
              text: "Evaluate this garment image. Run Phase 1 quality checks first. If it passes, classify the item completely and return the full JSON payload.",
            },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Strip markdown if model wraps in code blocks
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);
  } catch (error: any) {
    console.error("Classify error:", error);
    return res.status(500).json({
      error: "Classification failed",
      detail: error.message,
    });
  }
}
