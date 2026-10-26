import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

// ── Icons ─────────────────────────────────────────────────────────────────────

function SparkleIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-10 w-10 text-slate-700" aria-hidden="true">
      <path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684ZM13.949 13.684a1 1 0 0 0-1.898 0l-.184.551a1 1 0 0 1-.632.633l-.551.183a1 1 0 0 0 0 1.898l.551.183a1 1 0 0 1 .633.633l.183.551a1 1 0 0 0 1.898 0l.184-.551a1 1 0 0 1 .632-.633l.551-.183a1 1 0 0 0 0-1.898l-.551-.184a1 1 0 0 1-.633-.632l-.183-.551Z" />
    </svg>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center px-4 py-20 select-none">
      <SparkleIcon />
      <h2 className="mt-4 text-xl font-semibold text-slate-300">
        How can I help you today?
      </h2>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Chat, search the web, write code, analyse PDFs, create presentations,
        or generate images — all in one place.
      </p>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex justify-start px-4">
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-slate-800 px-4 py-3">
        <span className="flex gap-1" aria-label="AI is typing">
          <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" />
        </span>
      </div>
    </div>
  );
}

// ── MessageList ───────────────────────────────────────────────────────────────

export default function MessageList({ messages, loading, error }) {
  const endRef = useRef(null);
  const containerRef = useRef(null);

  // Smart auto-scroll: only scroll to bottom when near the bottom already
  // (so users can read earlier messages without being jerked down)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
    if (isNearBottom) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
      aria-live="polite"
      aria-label="Conversation messages"
    >
      {messages.length === 0 && !loading && !error ? (
        <EmptyState />
      ) : (
        <div className="mx-auto max-w-3xl space-y-2 px-4 py-6">
          {messages.map((msg, i) => (
            <MessageBubble key={msg._id || `msg-${i}`} message={msg} />
          ))}

          {loading && <TypingIndicator />}

          {error && (
            <div
              role="alert"
              className="mx-auto max-w-lg rounded-xl border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-300"
            >
              <span className="font-semibold">Error: </span>
              {error}
            </div>
          )}

          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
