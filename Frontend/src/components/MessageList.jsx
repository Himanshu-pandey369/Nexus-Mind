import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import MessageBubble from "./MessageBubble";
import LoadingIndicator from "./LoadingIndicator";
import NexusMindLogo from "./NexusMindLogo";

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center px-4 py-20 select-none">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-surface border border-gold/30 p-2.5 shadow-md">
        <NexusMindLogo className="h-full w-full" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-nm-text">
        How can I help you today?
      </h2>
      <p className="mt-2 max-w-sm text-sm text-nm-text-muted">
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
              className="mx-auto max-w-lg rounded-xl border border-nm-error/30 bg-nm-error/10 px-4 py-3 text-sm text-nm-error"
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
