import { NextRequest } from "next/server";
import { streamChatResponse, ChatMessage } from "@/lib/groq";

export const runtime = "edge";

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
    } = body as {
      messages: ChatMessage[];
      subject?: string;
      gradeLevel?: string;
      topic?: string;
      voiceMode?: boolean;
      language?: "English" | "Taglish" | "Tagalog";
      instructorId?: string;
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
      instructorId
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
