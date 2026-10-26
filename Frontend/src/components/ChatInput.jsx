import { useEffect, useRef } from "react";

// ── Icons ─────────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.903 6.083H12a.75.75 0 0 1 0 1.5H4.182l-1.903 6.083a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.288Z" />
    </svg>
  );
}

// ── ChatInput ─────────────────────────────────────────────────────────────────

export default function ChatInput({
  prompt,
  onChange,
  onSend,
  loading,
  disabled,
}) {

  useEffect(() => {
  if (prompt === "" && textareaRef.current) {
    textareaRef.current.style.height = "24px";
  }
}, [prompt]);

  const textareaRef = useRef(null);

 const handleKeyDown = (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
};

  // Auto-resize textarea up to max
  const handleChange = (e) => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    }
    onChange(e.target.value);
  };

  const handleSend = () => {
  if (!prompt.trim() || loading || disabled) return;

  // Reset textarea to its compact height
  if (textareaRef.current) {
    textareaRef.current.style.height = "24px";
  }

  onSend();
};

  const canSend = prompt.trim().length > 0 && !loading && !disabled;

  return (
    <div className="shrink-0 border-t border-slate-800 bg-slate-950 px-4 py-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 transition focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
          <textarea
            ref={textareaRef}
            rows={1}
            value={prompt}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled
                ? "Starting conversation…"
                : "Message NexusMind… (Enter to send, Shift+Enter for newline)"
            }
            disabled={disabled || loading}
            aria-label="Chat input"
            className="flex-1 resize-none bg-transparent text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
            style={{ minHeight: "24px", maxHeight: "180px", overflowY: "auto" }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <SendIcon />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-center text-xs text-slate-600">
          NexusMind can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}
