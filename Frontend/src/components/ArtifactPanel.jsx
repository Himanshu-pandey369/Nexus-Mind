import { useState } from "react";

// ── Icons ─────────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}

function CodeBracketIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path fillRule="evenodd" d="M6.28 5.22a.75.75 0 0 1 0 1.06L2.56 10l3.72 3.72a.75.75 0 0 1-1.06 1.06L.97 10.53a.75.75 0 0 1 0-1.06L5.22 5.22a.75.75 0 0 1 1.06 0Zm7.44 0a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L17.44 10l-3.72-3.72a.75.75 0 0 1 0-1.06ZM11.377 2.011a.75.75 0 0 1 .612.867l-2.5 14.5a.75.75 0 0 1-1.478-.255l2.5-14.5a.75.75 0 0 1 .866-.612Z" clipRule="evenodd" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41Z" clipRule="evenodd" />
    </svg>
  );
}

function ArtifactEmptyIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-12 w-12" aria-hidden="true">
      <rect x="8" y="8" width="32" height="32" rx="6" stroke="#374151" strokeWidth="2" />
      <path d="M16 24h16M16 18h10M16 30h8" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── ArtifactPanel ─────────────────────────────────────────────────────────────

/**
 * Artifact panel displays code / preview / image / document outputs from the AI.
 *
 * Current backend contract: the Agent Service returns only `aiResponse` (plain text).
 * The panel therefore displays that text in the Code tab as-is.
 * When the backend adds structured artifacts (code, imageUrl, fileUrl) those fields
 * can be plugged in here without changing the panel API.
 *
 * Props:
 *   artifact:  { type, content, imageUrl, language } | null
 *   onClose:   () => void
 */
export default function ArtifactPanel({ artifact, onClose }) {
  const [tab, setTab] = useState("code");

  // Detect if content looks like code to decide default tab
  const hasCode =
    artifact?.type === "code" ||
    artifact?.type === "text" ||
    (artifact?.content && artifact.content.length > 0);
  const hasImage = artifact?.type === "image" && artifact?.imageUrl;
  const hasPreview = artifact?.type === "code" && artifact?.content;

  const renderCode = () => (
    <pre className="h-full overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-300 font-mono">
      <code>{artifact?.content || ""}</code>
    </pre>
  );

  const renderPreview = () => {
    // Safe preview: render HTML in a sandboxed iframe with no scripts
    if (!artifact?.content) return null;
    const blob = new Blob([artifact.content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    return (
      <iframe
        title="Code preview"
        src={url}
        sandbox="allow-same-origin"
        className="h-full w-full rounded-lg border border-slate-700 bg-white"
      />
    );
  };

  const renderImage = () => (
    <div className="flex h-full items-center justify-center p-4">
      <img
        src={artifact.imageUrl}
        alt="AI-generated image"
        className="max-h-full max-w-full rounded-xl object-contain"
      />
    </div>
  );

  return (
    <aside className="flex h-full flex-col bg-slate-950 border-l border-slate-800">
      {/* ── Panel header ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <CodeBracketIcon />
          <h2 className="text-sm font-semibold text-slate-200">Artifact</h2>
          {artifact?.type && (
            <span className="rounded-full bg-indigo-600/20 px-2 py-0.5 text-xs font-medium text-indigo-400 capitalize">
              {artifact.type}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close artifact panel"
          className="rounded-md p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <CloseIcon />
        </button>
      </div>

      {/* ── Empty state ── */}
      {!artifact && (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center select-none">
          <ArtifactEmptyIcon />
          <p className="mt-4 text-sm font-medium text-slate-400">No artifact yet</p>
          <p className="mt-1 text-xs text-slate-600">
            Ask NexusMind to write code, create a presentation, or generate an image.
          </p>
        </div>
      )}

      {/* ── Tabs (only when there's content) ── */}
      {artifact && (
        <>
          {/* Tab bar — only show Code/Preview for code artifacts */}
          {(hasCode || hasPreview) && !hasImage && (
            <div className="flex shrink-0 gap-1 border-b border-slate-800 px-3 pt-2">
              <button
                onClick={() => setTab("code")}
                className={`flex items-center gap-1.5 rounded-t-md px-3 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  tab === "code"
                    ? "border-b-2 border-indigo-500 text-indigo-400 bg-slate-800"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <CodeBracketIcon />
                Code
              </button>
              {hasPreview && (
                <button
                  onClick={() => setTab("preview")}
                  className={`flex items-center gap-1.5 rounded-t-md px-3 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    tab === "preview"
                      ? "border-b-2 border-indigo-500 text-indigo-400 bg-slate-800"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <EyeIcon />
                  Preview
                </button>
              )}
            </div>
          )}

          {/* ── Panel body ── */}
          <div className="flex-1 overflow-hidden p-3">
            {hasImage
              ? renderImage()
              : tab === "preview" && hasPreview
              ? renderPreview()
              : renderCode()}
          </div>
        </>
      )}
    </aside>
  );
}
