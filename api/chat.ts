import Anthropic from "@anthropic-ai/sdk";
import { requireUser, checkChatInput, getBearerToken } from "./_lib/gate.js";
import { loadClosetForChat, normalizeOutfits } from "./_lib/closet.js";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const STYLIST_SYSTEM_PROMPT = `You are a personal AI stylist embedded in a premium Digital Closet app. You have access to the user's wardrobe inventory and help them with outfit suggestions, styling advice, and wardrobe decisions.

PERSONALITY: Direct, warm, confident. Like a high-end personal stylist — not a chatbot. Never robotic. Never over-explaining. No filler phrases like "Great question!" or "Certainly!".

YOUR CAPABILITIES:
- Suggest outfits using items from the user's actual closet
- Give styling advice based on occasion, weather, or mood
- Identify wardrobe gaps
- Suggest what to buy to complete looks
- Answer questions about care, fit, and styling

RULES:
- Keep responses concise — max 3-4 sentences unless a detailed breakdown is requested
- When suggesting outfits, always reference specific items from the closet data provided
- If asked about something outside wardrobe/styling, redirect warmly: "That's outside my lane — I'm your wardrobe specialist. What can I help you style?"
- Never apologize. Never over-explain.
- If the closet is empty or has few items, acknowledge it and ask what they're working with

The user's closet data will be provided in each message as context.

HOW YOU REPLY:
- ALWAYS reply by calling the respond tool. Never reply with plain text.
- "message" is your short conversational reply (2-3 sentences). It frames the options; the details live in the outfits.
- When the user asks what to wear, for outfit ideas, or how to style something, give up to 3 outfits in "outfits". Build each ONLY from the numbered closet items (use the # numbers exactly as listed; never invent a number). Put pieces the user does not own that would complete the look in "missing" as short descriptions.
- For questions that are not about outfits, leave "outfits" empty.`;

const RESPOND_TOOL = {
  name: "respond",
  description: "Send your reply to the user, with optional outfit boards.",
  input_schema: {
    type: "object" as const,
    properties: {
      message: { type: "string", description: "Your conversational reply, 2-3 sentences." },
      outfits: {
        type: "array",
        description: "0 to 3 outfit options. Empty unless the user asked for outfits or styling.",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short name for the look, e.g. 'Polished dinner'." },
            note: { type: "string", description: "One sentence on why it works." },
            items: {
              type: "array",
              items: { type: "integer" },
              description: "Closet item numbers (the # numbers) used in this outfit.",
            },
            missing: {
              type: "array",
              items: { type: "string" },
              description: "Pieces the user does not own that would complete the look.",
            },
          },
          required: ["title", "items"],
        },
      },
    },
    required: ["message"],
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
        const userId = await requireUser(req, res, "chat");
    if (!userId) return;
    const { messages } = req.body;
    const inputError = checkChatInput(messages, undefined);
    if (inputError) {
      return res.status(400).json({ error: inputError });
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing messages" });
    }

    // The closet summary is built on the server from the signed-in user's saved
    // items, so it can't be forged or cut off by the browser.
    const { context, ids } = await loadClosetForChat(getBearerToken(req));

    const systemWithContext = context
      ? `${STYLIST_SYSTEM_PROMPT}\n\n## USER'S CURRENT CLOSET (refer to items by their # number):\n${context}`
      : STYLIST_SYSTEM_PROMPT;

    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1500,
      system: systemWithContext,
      messages: messages,
      tools: [RESPOND_TOOL],
      tool_choice: { type: "tool", name: "respond" },
    });

    let message = "";
    let outfits: ReturnType<typeof normalizeOutfits> = [];
    for (const block of response.content as any[]) {
      if (block.type === "tool_use" && block.name === "respond" && block.input) {
        if (typeof block.input.message === "string") message = block.input.message;
        outfits = normalizeOutfits(block.input.outfits, ids);
      } else if (block.type === "text" && !message) {
        message = block.text;
      }
    }

    return res.status(200).json({ message, outfits });
  } catch (error: any) {
    console.error("Chat error:", error);
    return res.status(500).json({
      error: "Chat failed",
      
    });
  }
}
