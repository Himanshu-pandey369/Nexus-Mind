import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import MessageBubble from "./MessageBubble";
import LoadingIndicator from "./LoadingIndicator";

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

// ── MessageList ───────────────────────────────────────────────────────────────

export default function MessageList({ messages, loading, error, onSelectArtifact }) {
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);

  // Synchronize loading state with Redux if available, falling back to props
  const reduxLoading = useSelector((state) => state.chat?.loading ?? state.chat?.isLoading);
  const reduxStatus = useSelector((state) => state.chat?.status);
  const isGenerating = reduxLoading !== undefined ? reduxLoading : loading;

  // Chapter 13: Auto-scroll to bottom on messages and loading state changes
  // Uses requestAnimationFrame and scrollIntoView with smooth scrolling and block: "end"
  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [messages, isGenerating]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
      aria-live="polite"
      aria-label="Conversation messages"
    >
      {messages.length === 0 && !isGenerating && !error ? (
        <EmptyState />
      ) : (
        <div className="mx-auto max-w-3xl space-y-2 px-4 py-6">
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg._id || `msg-${i}`}
              message={msg}
              onSelectArtifact={onSelectArtifact}
            />
          ))}

          {isGenerating && <LoadingIndicator currentStatus={reduxStatus} />}

          {error && (
            <div
              role="alert"
              className="mx-auto max-w-lg rounded-xl border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-300"
            >
              <span className="font-semibold">Error: </span>
              {error}
            </div>
          )}

          {/* Bottom reference for automatic scrolling */}
          <div ref={messagesEndRef} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
