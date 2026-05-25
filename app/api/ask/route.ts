import { NextRequest } from "next/server";
import { groqClient } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 30;

interface AskBody {
  question?: string;
  courseTitle?: string;
  lessonTitle?: string;
  lessonObjective?: string;
  /** What's on screen right now — helps the AI ground its answer. */
  currentStepText?: string;
  studentName?: string;
  /** Optional prior Q&A turns within this side-panel session. */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

const SYSTEM = `You're an in-lesson helper. The student is mid-lesson and paused to ask one specific question. Answer it in 2-4 short sentences using simple, encouraging language.

Rules:
- Stay strictly relevant to the lesson the student is in.
- Don't introduce yourself. Don't ask what they want to learn. Just answer.
- Don't go off on tangents. If they ask something far outside the lesson, say "Let's circle back to today's lesson — for now, the key idea is..." and steer back.
- No markdown headings. Plain prose. At most one short list.
- If math, write it inline as plain text (e.g., "1/2 + 1/3 = 5/6"). No LaTeX.
- End on an encouraging beat — "Now you've got it" / "Make sense?" — so the student feels ready to resume.`;

export async function POST(req: NextRequest) {
  let body: AskBody;
  try {
    body = (await req.json()) as AskBody;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const question = (body.question ?? "").trim();
  if (!question) return new Response("Question required", { status: 400 });

  const context = [
    body.courseTitle ? `Course: ${body.courseTitle}` : "",
    body.lessonTitle ? `Lesson: ${body.lessonTitle}` : "",
    body.lessonObjective ? `Lesson goal: ${body.lessonObjective}` : "",
    body.currentStepText
      ? `On screen right now: ${body.currentStepText.slice(0, 600)}`
      : "",
    body.studentName ? `Student's name: ${body.studentName}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const messages = [
    { role: "system" as const, content: SYSTEM + (context ? "\n\n" + context : "") },
    ...(body.history ?? []),
    { role: "user" as const, content: question },
  ];

  try {
    const stream = await groqClient.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages,
      stream: true,
      max_tokens: 350,
      temperature: 0.6,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) controller.enqueue(encoder.encode(text));
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
  } catch (e) {
    console.error("[api/ask] failed:", e);
    return new Response("AI unavailable", { status: 502 });
  }
}
