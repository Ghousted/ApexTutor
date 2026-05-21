"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";

/**
 * Renders an assistant or user message with Markdown + LaTeX math support.
 *
 * Math syntax:
 *   - Inline: $E = mc^2$
 *   - Block:  $$\int_0^1 x^2\,dx = \frac{1}{3}$$
 *
 * Streaming-safe: KaTeX's `throwOnError: false` setting means partial
 * expressions (e.g., $\frac{1) during a streaming response just render as
 * raw text until the closing delimiter arrives — no thrown errors, no
 * flashing layout.
 */
function MessageContentInner({ text }: { text: string }) {
  return (
    <div className="message-content">
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[
          [
            rehypeKatex,
            {
              throwOnError: false,
              strict: "ignore",
            },
          ],
        ]}
        components={{
          // Tighter spacing for chat bubbles — react-markdown defaults to
          // browser <p> margins which feel cavernous inside a small bubble.
          p: ({ children }) => (
            <p className="m-0 whitespace-pre-wrap leading-relaxed">{children}</p>
          ),
          // Lists need a little indent + spacing between items.
          ul: ({ children }) => (
            <ul className="list-disc pl-5 my-1 space-y-0.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 my-1 space-y-0.5">{children}</ol>
          ),
          // Inline + block code — small chips, neutral styling.
          code: ({ children, className }) => {
            const isBlock = /language-/.test(className || "");
            if (isBlock) {
              return (
                <code className="block bg-slate-900/5 rounded-md p-2 my-1 font-mono text-xs overflow-x-auto">
                  {children}
                </code>
              );
            }
            return (
              <code className="bg-slate-900/5 rounded px-1 py-0.5 font-mono text-[0.85em]">
                {children}
              </code>
            );
          },
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          // Block math (rehype-katex wraps in <div class="math math-display">)
          // and inline math (<span class="math math-inline">) — KaTeX styles
          // come from the global CSS import in layout.tsx.
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

// Memo: avoid re-running the markdown parser when the parent re-renders
// for an unrelated reason.
const MessageContent = memo(MessageContentInner, (prev, next) => prev.text === next.text);

export default MessageContent;
