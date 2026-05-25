"use client";

import { useEffect, useRef, useState } from "react";
import { X, Send, Loader2, MessageCircle, Sparkles } from "lucide-react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import MessageContent from "./MessageContent";

/**
 * Slide-in Q&A panel. Pauses the lesson visually; the lesson state itself
 * doesn't advance until the panel is closed. The Q&A history is local to
 * this panel session — once dismissed it disappears so the student can't
 * accidentally derail the lesson with chat history.
 */
type Msg = { role: "user" | "assistant"; content: string };

export default function CourseQAPanel({
  open,
  onClose,
  courseTitle,
  lessonTitle,
  lessonObjective,
  currentStepText,
  studentName,
}: {
  open: boolean;
  onClose: () => void;
  courseTitle?: string;
  lessonTitle?: string;
  lessonObjective?: string;
  currentStepText?: string;
  studentName?: string | null;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Slide in / out
  useEffect(() => {
    if (!panelRef.current || !overlayRef.current) return;
    if (open) {
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.2, ease: "power2.out" }
      );
      gsap.fromTo(
        panelRef.current,
        { x: "100%" },
        { x: "0%", duration: 0.35, ease: "power3.out" }
      );
    }
  }, [open]);

  // Scroll to bottom on new content
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  if (!open) return null;

  const send = async () => {
    const q = input.trim();
    if (!q || streaming) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setStreaming(true);
    const assistantIdx = next.length; // index of the placeholder we'll append
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          courseTitle,
          lessonTitle,
          lessonObjective,
          currentStepText,
          studentName,
          history: messages,
        }),
      });
      if (!res.ok || !res.body) throw new Error("Bad response");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[assistantIdx] = { role: "assistant", content: full };
          return copy;
        });
      }
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        copy[assistantIdx] = {
          role: "assistant",
          content: "Sorry — couldn't reach the tutor. Try again?",
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        ref={overlayRef}
        onClick={onClose}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
      />
      <aside
        ref={panelRef}
        className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col"
      >
        {/* Header */}
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">Ask a question</p>
              <p className="text-[11px] text-slate-500 truncate">
                Pauses the lesson — won&apos;t mess up your progress.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-ink hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="text-center py-6">
              <Sparkles className="w-6 h-6 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium text-ink">
                Stuck on something?
              </p>
              <p className="text-xs text-slate-500 max-w-[28ch] mx-auto leading-relaxed mt-1">
                Ask anything about this lesson and your tutor will explain.
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <Bubble key={i} msg={m} />
          ))}
          {streaming && messages[messages.length - 1]?.content === "" && (
            <div className="flex items-center gap-2 text-slate-400 text-xs pl-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Thinking…
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Composer */}
        <footer className="px-4 py-3 border-t border-slate-100">
          <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 focus-within:border-indigo-400">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Type your question…"
              rows={1}
              disabled={streaming}
              className="flex-1 bg-transparent outline-none text-sm text-ink placeholder-slate-400 resize-none max-h-32 py-1"
            />
            <button
              onClick={send}
              disabled={!input.trim() || streaming}
              className={cn(
                "p-2 rounded-full transition-colors shrink-0",
                input.trim() && !streaming
                  ? "bg-indigo-500 hover:bg-indigo-600 text-white"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
              aria-label="Send"
            >
              {streaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-2">
            The lesson pauses while you chat. Close to resume.
          </p>
        </footer>
      </aside>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  if (msg.role === "user") {
    return (
      <div className="self-end max-w-[85%] bg-indigo-500 text-white rounded-2xl rounded-tr-sm px-3.5 py-2 text-sm">
        {msg.content}
      </div>
    );
  }
  return (
    <div className="self-start max-w-[90%] bg-slate-100 text-slate-800 rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm">
      {msg.content ? <MessageContent text={msg.content} /> : <span>&nbsp;</span>}
    </div>
  );
}
