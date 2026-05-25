import { NextRequest } from "next/server";
import { streamChatResponse, ChatMessage } from "@/lib/groq";

// Node runtime is required because we use firebase-admin (Firestore SDK) and
// Transformers.js (BGE-small for query embedding) for RAG retrieval. Both
// need Node-only APIs that the edge runtime doesn't expose.
export const runtime = "nodejs";
// Embedding the user query takes ~50–200ms on a warm function. Chunk
// retrieval from Firestore + cosine ranking adds another ~200–500ms. Bump
// the timeout so the full chat turn (incl. Groq streaming) has headroom.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      messages,
      subject,
      gradeLevel,
      topic,
      voiceMode,
      language,
      instructorId,
      images,
    } = body as {
      messages: ChatMessage[];
      subject?: string;
      gradeLevel?: string;
      topic?: string;
      voiceMode?: boolean;
      language?: "English" | "Taglish" | "Tagalog";
      instructorId?: string;
      images?: string[];
    };

    if (!messages || !Array.isArray(messages)) {
      return new Response("Invalid messages", { status: 400 });
    }

    const stream = await streamChatResponse(
      messages,
      subject,
      gradeLevel,
      topic,
      voiceMode,
      language,
      instructorId,
      images
    );

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
