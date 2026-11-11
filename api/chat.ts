import Anthropic from "@anthropic-ai/sdk";
import { requireUser, checkChatInput, getBearerToken } from "./_lib/gate.js";
import { loadClosetContext } from "./_lib/closet.js";

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

The user's closet data will be provided in each message as context.`;

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
    const closetContext = await loadClosetContext(getBearerToken(req));

    const systemWithContext = closetContext
      ? `${STYLIST_SYSTEM_PROMPT}\n\n## USER'S CURRENT CLOSET:\n${closetContext}`
      : STYLIST_SYSTEM_PROMPT;

    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      system: systemWithContext,
      messages: messages,
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return res.status(200).json({ message: text });
  } catch (error: any) {
    console.error("Chat error:", error);
    return res.status(500).json({
      error: "Chat failed",
      
    });
  }
}
