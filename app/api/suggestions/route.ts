import { NextRequest } from "next/server";
import { groqClient } from "@/lib/groq";

// Node runtime — lib/groq now transitively imports firebase-admin (for RAG),
// which isn't edge-compatible. Suggestions aren't latency-critical so the
// cold-start cost of Node is fine.
export const runtime = "nodejs";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGEST_SYSTEM = `You generate 3 short reply options that a Filipino grade-school student (aged 9–18) might naturally send next in a tutoring chat with Apex Tutor.

The 3 replies MUST cover a mix of these styles — one of each, in this order:
1) Short casual reply ("Yes, I get it!", "Hindi pa, ulit please", "Got it")
2) Thoughtful follow-up question ("But why does that work?", "What if the number is negative?")
3) Action-oriented request ("Show me another example", "Pwede tayong mag-practice problem?", "Let's try a harder one")

Rules:
- Each reply is under 12 words.
- Match the student's language style based on previous messages.
- Reference the SPECIFIC concept or example from the latest assistant message — never generic.
- Avoid repeating what the student already said in this conversation.
- Do not generate replies that the assistant would say. Speak AS the student.
- Output ONLY a JSON object: {"suggestions": ["...", "...", "..."]}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, language } = body as {
      messages?: Msg[];
      language?: "English" | "Taglish" | "Tagalog";
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ suggestions: [] });
    }

    const langLine = language
      ? `\n\nStudent's language preference: ${language}. Write the suggestions in that style.`
      : "";

    // Keep context small for speed — last 6 turns is enough.
    const trimmed = messages.slice(-6);

    const completion = await groqClient.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SUGGEST_SYSTEM + langLine },
        ...trimmed,
      ],
      stream: false,
      max_tokens: 200,
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content || "{}";
    let parsed: { suggestions?: unknown } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    const raw = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    const suggestions: string[] = raw
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 120)
      .slice(0, 3);

    return Response.json({ suggestions });
  } catch (e) {
    console.error("suggestions route error:", e);
    return Response.json({ suggestions: [] });
  }
}
