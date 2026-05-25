import Groq from "groq-sdk";
import { getInstructor } from "./instructors";
import { cosineSimilarity } from "./chunking";
import { getAllChunks, type ChunkDoc } from "./textbooks";
import { embed } from "./embeddings";
import type { Lesson } from "./lessons";

/** Lesson context passed into the prompt to make the AI drive the lesson. */
export interface LessonContext {
  lesson: Lesson;
  gradeLevel: number;
  /** True only on the very first assistant turn of this lesson. Drives the
   *  "intro + calibration question" opener vs. just continuing teaching. */
  isFirstTurnOfLesson: boolean;
  /** Student's first name — used by the AI to address them personally. */
  studentName?: string;
}

export const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Shared tutoring style used by all instructors. The instructor's persona +
// subject scope is prepended at request time.
export const SYSTEM_PROMPT = `You are a tutor for Filipino grade-school students aged 9–18. You teach the way the best human tutors do — not by lecturing, but by guiding students to discover the answer themselves.

# Stay in character — ALWAYS

You are a human tutor. You are NOT an AI, language model, chatbot, assistant, GPT, LLM, or any kind of program. Never refer to yourself as any of those. Never say "as an AI", "I'm a language model", "my training data", "I was trained", or anything similar. Never apologize for being a model or mention technical issues, errors, or system problems.

If a student asks "are you a robot?" or "are you AI?" or "are you human?", deflect warmly without lying outright:
- "I'm Professor [Name], your [Subject] tutor — that's all that matters! Now let's get back to learning."
- "I'm here to help you learn. What were we working on?"
- "Haha, what makes you ask? Let's focus on your question first."

If something goes wrong on your end (you misread, lost context, gave a confusing answer), recover in character like a human tutor would: "Wait — let me re-read that. Could you ask again?" or "Hmm, I got mixed up. Walk me through what you're asking?" — NEVER mention errors, glitches, the system, or technical issues.

# Your teaching personality

- **Socratic** — Prefer asking guiding questions over giving direct answers. Lead the student to the concept; do not just hand it over. Even when you must explain something, end with a question that pushes their thinking.
- **Adaptive** — Read the student's reply carefully. If they sound confused or give a wrong answer, simplify and slow down. If they sound confident or get it right, deepen the challenge or move to a related concept. Match their level.
- **Patient & encouraging** — Never make a student feel dumb. Treat every mistake as useful information ("Good attempt — let's see why it didn't work, kasi this is actually a really common confusion."). Normalize struggle as part of learning.
- **Concrete** — Always anchor abstract ideas in real-world examples, ideally Filipino-relatable ones (jeepney fares, palengke prices, basketball stats, halo-halo layers, etc.). Definitions alone are forbidden — pair every definition with a tangible example.
- **Scaffolded** — Break complex topics into small, digestible steps. Check understanding after each step before moving on. Do not dump everything at once.
- **Honest about limits** — If a question is outside Math/Science or far beyond the student's current level, say so kindly and refocus: "That's a great question for later — for now let's nail down X first, okay?"

# How to structure every reply

Follow this pattern (adapt the proportions to what the student said):

1. **Acknowledge** — Briefly validate what the student said or attempted. ("Magaling — you spotted that we need to multiply first." / "Good question!" / "I see why you'd think that.")
2. **Correct or affirm with a brief explanation** — One or two sentences. If they're wrong, gently redirect. If they're right, confirm and reinforce *why* it's right.
3. **Concrete example or analogy** — Show the idea with a small, relatable example. Use simple numbers. Use real Filipino context when natural.
4. **Follow-up question** — End with ONE question that either checks their understanding, asks them to apply what they just learned, or pushes them one step further. This is the most important part — never end a reply without asking something back.

# Hard rules

- Keep replies short. Aim for under 120 words unless the student explicitly asks for a long explanation. Walls of text overwhelm young learners.
- Never solve an entire multi-step problem in one go. Walk through it step by step, asking the student what comes next at each step.
- Do not use heavy markdown (no big headings, no nested bullets). Plain prose with at most one short list. The student is reading this in a chat bubble.
- For ANY mathematical notation, use LaTeX wrapped in dollar signs. Inline math goes in single dollars: $x^2 + 2x + 1$, $\\frac{1}{2}$, $\\sqrt{16} = 4$. Display math (anything that should stand alone on its own line, like a multi-step equation, fraction, integral, or summation) goes in double dollars: $$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$. Use LaTeX whenever plain text would be ambiguous or hard to read — fractions, exponents, square roots, Greek letters, subscripts, summations, integrals. Simple numbers like "5" or "the year 2026" stay as plain text.
- Avoid emojis unless the student uses them first.
- If the student gives a one-word reply ("ok", "yes", "I don't know"), do not lecture — ask a smaller, easier question to find out what they actually know.
- If the student asks you to "just give the answer," gently push back once: "I'll give it, but first — what do you think it might be? Even a guess is great." If they refuse twice, then give the answer with a brief explanation.

# Conversation openers

- On the VERY FIRST reply of a conversation, briefly greet the student by introducing yourself using your persona name (e.g., "Hi! I'm Professor Maria — ...") before addressing their question. On all subsequent replies, do NOT re-introduce yourself.
- If their first message is vague ("I want to learn math"), don't dive in blindly — ask one focused question to find their starting point ("Sure! What topic are you working on right now — fractions, algebra, geometry, or something else?").

If the student has provided a grade level, subject, or topic, tailor your examples and vocabulary to that level.`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Models.
//   - TEXT_MODEL: used for the bulk of chat turns. We use 8b-instant because
//     Groq's free tier caps the 70B model at 100k tokens/day, which is
//     ~25 lesson turns before hitting "rate_limit_exceeded". 8b-instant has
//     ~5x the free quota and still handles widget-emitting / lesson driving
//     reliably. If you upgrade to Groq Dev Tier, swap this back to
//     "llama-3.3-70b-versatile" for marginally smarter conversation.
//   - VISION_MODEL: used only when the latest user message has images.
const TEXT_MODEL = "llama-3.1-8b-instant";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

// RAG retrieval tuning.
const RAG_TOP_K = 5;          // how many chunks to inject per query
const RAG_MIN_SCORE = 0.35;   // cosine similarity floor — below this, treat as no match

// Heuristic for detecting "follow-up" messages where RAG retrieval is wasted
// work: the user is acknowledging, asking for more detail on what was just
// said, or otherwise relying on conversation history rather than asking a
// brand-new question that needs fresh textbook grounding.
//
// Conservative on purpose: it's much better to run RAG unnecessarily than to
// skip it when we needed it. So we only return true when the message clearly
// looks conversational.
const FOLLOW_UP_OPENER = /^(ok|okay|yes|yeah|yep|yup|no|nope|nah|sure|cool|nice|thanks|salamat|sige|oo|hindi pa|got it|gets|gets ko|i see|i get it|i understand|naiintindihan|alam ko na|continue|go on|keep going|next|more|tell me more|explain more|simulan na|ulit|again|huh|what|why)\b/i;

function looksLikeFollowUp(
  lastUserMessage: string,
  history: ChatMessage[]
): boolean {
  // No prior assistant turn → there's nothing to follow up ON.
  const hasAssistantHistory = history.some(
    (m) => m.role === "assistant" && m.content
  );
  if (!hasAssistantHistory) return false;

  const text = lastUserMessage.trim();
  if (!text) return true;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Very short with no question mark → almost certainly an acknowledgment.
  if (wordCount <= 4 && !text.includes("?")) return true;

  // Starts with a conversational opener AND is short → follow-up.
  if (FOLLOW_UP_OPENER.test(text) && wordCount <= 8) return true;

  return false;
}

// Per-instructor chunk cache. Vercel functions stay warm for a few minutes,
// so subsequent chat turns reuse the cached chunks instead of re-fetching the
// whole collection from Firestore (expensive at scale).
const chunkCache = new Map<string, { chunks: ChunkDoc[]; expiresAt: number }>();
const CHUNK_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getChunksWithCache(instructorId: string): Promise<ChunkDoc[]> {
  const now = Date.now();
  const cached = chunkCache.get(instructorId);
  if (cached && cached.expiresAt > now) return cached.chunks;
  const chunks = await getAllChunks(instructorId);
  chunkCache.set(instructorId, { chunks, expiresAt: now + CHUNK_CACHE_TTL_MS });
  return chunks;
}

/** Retrieve top-K most similar chunks for a query. Empty array if no chunks
 *  exist for the instructor (i.e., no textbook uploaded yet). */
async function retrieveRagContext(
  instructorId: string,
  query: string
): Promise<ChunkDoc[]> {
  const chunks = await getChunksWithCache(instructorId);
  if (chunks.length === 0) return [];

  const queryVec = await embed(query);
  const scored = chunks
    .map((c) => ({ chunk: c, score: cosineSimilarity(queryVec, c.embedding) }))
    .filter((s) => s.score >= RAG_MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, RAG_TOP_K);
  return scored.map((s) => s.chunk);
}

function formatLessonBlock(ctx: LessonContext): string {
  const { lesson, gradeLevel, isFirstTurnOfLesson, studentName } = ctx;
  const nameClause = studentName ? ` Address them as "${studentName}".` : "";

  // Open with intro + calibration on first turn; otherwise continue.
  const opener = isFirstTurnOfLesson
    ? `First turn: 1-sentence greeting → say lesson title → ask: "${lesson.calibrationQuestion}"`
    : `Continue teaching. Don't re-introduce.`;

  return `\n\n# Lesson: ${lesson.title}
Goal: ${lesson.objective}
Student: Grade ${gradeLevel}.${nameClause}

${opener}

# Drive the lesson — RULES
- Reply = 1-2 short sentences + ONE widget marker. EVERY turn.
- React warmly to their answer, THEN emit the next widget. No dead air.
- Vary widgets. Don't repeat the same type 3 times in a row.
- After ~5 successful interactions and they can explain it, emit [[LESSON_COMPLETE]] at the end.

# Widget formats (emit ONE per turn)
[[QUIZ:Q=question;A=opt1;B=opt2;C=opt3;correct=A]]
[[FRACTION_BAR:target=3/4]]  — student clicks cells to fill the fraction
[[MATCH:prompt=Match equations to solutions|pairs=2x+1=3=>x=1|3x=6=>x=2|x-4=0=>x=4]]
[[SORT:prompt=Put these steps in order|items=Subtract 3 from both sides|Divide both sides by 2|Solution: x=4]]  — student drags rows into the correct order

# Example (good)
"Magaling! Now build 5/8 yourself:
[[FRACTION_BAR:target=5/8]]"

# Example (BAD)
"That's right! Do you understand?"  — no widget, generic chatbot. AVOID.`;
}

function formatRagContext(chunks: ChunkDoc[]): string {
  if (chunks.length === 0) return "";
  const blocks = chunks
    .map((c, i) => `Excerpt ${i + 1}:\n${c.text}`)
    .join("\n\n");
  return `\n\n# Reference material\n\nThe following excerpts were retrieved from this instructor's reference material. Use them as your primary source of truth — paraphrase and teach from them naturally.\n\nIMPORTANT: Do NOT mention page numbers, sources, "the textbook says", "according to my reference", "the excerpts show", or any phrasing that exposes that you're working from retrieved material. Speak as a tutor who simply knows this content. The student should never realize the answer was retrieved.\n\nIf the excerpts don't cover the question, answer from general knowledge without acknowledging the gap.\n\n${blocks}`;
}

export async function streamChatResponse(
  messages: ChatMessage[],
  subject?: string,
  gradeLevel?: string,
  topic?: string,
  voiceMode?: boolean,
  language?: "English" | "Taglish" | "Tagalog",
  instructorId?: string,
  /**
   * Base64 data URLs of images attached to the LATEST user message only.
   * When present, we switch to a vision-capable model and reformat the last
   * user turn using OpenAI's multimodal content-array shape.
   */
  images?: string[],
  /**
   * Curriculum context. When present, the AI drives a specific lesson rather
   * than asking "what would you like to learn?" and watches for mastery to
   * emit a [[LESSON_COMPLETE]] marker.
   */
  lessonContext?: LessonContext
) {
  const instructor = getInstructor(instructorId);
  const personaBlock = instructor ? instructor.personaPrompt + "\n\n" : "";

  // RAG retrieval: only the latest user message drives retrieval. We pick
  // the last user message in the history; if none exists (shouldn't happen
  // in normal flow), retrieval is skipped silently.
  //
  // Optimization: skip retrieval entirely on follow-up messages ("ok", "more
  // please", "I don't get it"). The conversation history already carries the
  // chunks from the original retrieval, so a second fetch is wasted work and
  // adds 200ms–4s of latency depending on cache state.
  let ragBlock = "";
  if (instructor) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser?.content) {
      const priorHistory = messages.slice(0, messages.indexOf(lastUser));
      if (looksLikeFollowUp(lastUser.content, priorHistory)) {
        console.log(`[RAG] skipping retrieval — follow-up: "${lastUser.content.slice(0, 60)}"`);
      } else {
        try {
          const ctxChunks = await retrieveRagContext(
            instructor.id,
            lastUser.content
          );
          ragBlock = formatRagContext(ctxChunks);
        } catch (e) {
          // RAG is non-essential — log and continue without it.
          console.error("[RAG] retrieval failed, continuing without context:", e);
        }
      }
    }
  }

  const contextLine = topic
    ? `\n\nCurrent context: Subject: ${subject || instructor?.subject || "General"}, Grade Level: ${gradeLevel || "Not specified"}, Topic: ${topic}`
    : subject
      ? `\n\nCurrent context: Subject: ${subject}`
      : instructor
        ? `\n\nCurrent context: Subject: ${instructor.subject}`
        : "";

  const languageLine = (() => {
    if (voiceMode) {
      return `\n\nVOICE MODE ENABLED: The student has voice playback turned on. Respond in clear, pure English only — no Tagalog or Taglish in this response. Keep sentences short and conversational so the text-to-speech voice reads naturally. Avoid markdown symbols, emojis, and bullet points; write in flowing prose.`;
    }
    if (language === "English") {
      return `\n\nLANGUAGE: Respond in clear English only. Do not use Tagalog or Taglish.`;
    }
    if (language === "Tagalog") {
      return `\n\nLANGUAGE: Respond in pure Tagalog (Filipino). Use natural Filipino phrasing. Technical terms in English are acceptable only when there is no common Tagalog equivalent (e.g., "atom", "algebra").`;
    }
    // Default: Taglish
    return `\n\nLANGUAGE: Respond in Taglish — natural code-switched mix of English and Tagalog as Filipino students commonly speak. Keep technical terms in English; weave Tagalog connectors and explanations for warmth and clarity.`;
  })();

  // Curriculum block — overrides the generic "ask what they want to learn"
  // opener and tells the AI exactly what to teach this session.
  const lessonBlock = lessonContext
    ? formatLessonBlock(lessonContext)
    : "";

  const systemContent =
    personaBlock +
    SYSTEM_PROMPT +
    contextLine +
    languageLine +
    lessonBlock +
    ragBlock;

  const hasImages = Array.isArray(images) && images.length > 0;

  // Build the messages array. Convert the LAST user turn to multimodal content
  // when images are attached. Earlier turns stay as plain text strings.
  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } };
  type OutMessage = {
    role: "system" | "user" | "assistant";
    content: string | ContentPart[];
  };

  const out: OutMessage[] = [{ role: "system", content: systemContent }];

  if (hasImages && messages.length > 0) {
    // Pass everything but the final message as plain text.
    for (let i = 0; i < messages.length - 1; i++) {
      out.push(messages[i]);
    }
    // Reformat the final user message as multimodal.
    const last = messages[messages.length - 1];
    const parts: ContentPart[] = [];
    if (last.content) parts.push({ type: "text", text: last.content });
    for (const dataUrl of images!) {
      parts.push({ type: "image_url", image_url: { url: dataUrl } });
    }
    out.push({ role: last.role, content: parts });
  } else {
    for (const m of messages) out.push(m);
  }

  return groqClient.chat.completions.create({
    model: hasImages ? VISION_MODEL : TEXT_MODEL,
    // The SDK's type expects `string` content; multimodal arrays are
    // accepted by the underlying API but TS doesn't know that yet.
    messages: out as Parameters<typeof groqClient.chat.completions.create>[0]["messages"],
    stream: true,
    max_tokens: 1024,
    temperature: 0.7,
  });
}
