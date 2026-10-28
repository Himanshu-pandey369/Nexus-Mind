// MessageBubble — renders a single user or assistant message.
// Backend Message schema: { _id, conversationId, role, content, images, createdAt, updatedAt }
// Optimistic messages:    { role, content, images }

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(isoString) {
  if (!isoString) return null;
  try {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

/** Only allow http / https links; block javascript: and data: schemes. */
function safeHref(href) {
  try {
    const url = new URL(href, window.location.href);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : "#";
  } catch {
    return "#";
  }
}

// ── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable; fail silently
    }
  };

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy code"}
      className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition select-none focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
        copied
          ? "bg-indigo-600 text-white"
          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
      }`}
    >
      {copied ? (
        <>
          <CheckIcon />
          Copied
        </>
      ) : (
        <>
          <CopyIcon />
          Copy
        </>
      )}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
      <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
      <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
    </svg>
  );
}

// ── CodeBlock ─────────────────────────────────────────────────────────────────

function CodeBlock({ language, children }) {
  const code = String(children).replace(/\n$/, "");
  const lang = language || "text";

  return (
    <div className="group/code relative my-3 rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-800 px-4 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 select-none">
          {lang}
        </span>
        <CopyButton code={code} />
      </div>

      {/* Highlighted code */}
      <SyntaxHighlighter
        language={lang}
        style={oneDark}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "1rem",
          background: "transparent",
          fontSize: "0.8125rem",
          lineHeight: "1.6",
          overflowX: "auto",
        }}
        codeTagProps={{ style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

// ── react-markdown component map ──────────────────────────────────────────────

const markdownComponents = {
  // Code: fenced (block) vs inline
  // react-markdown v10 removed the `inline` prop.
  // Detect block code by the presence of a language-* className (fenced block)
  // or by the code containing newlines (indented block).
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const isBlock = match || String(children).includes("\n");
    if (isBlock) {
      return (
        <CodeBlock language={match?.[1]}>{children}</CodeBlock>
      );
    }
    return (
      <code
        className="rounded bg-slate-700/60 px-1 py-0.5 font-mono text-[0.8125rem] text-indigo-300"
        {...props}
      >
        {children}
      </code>
    );
  },

  // Headings
  h1: ({ children }) => (
    <h1 className="mb-3 mt-5 text-xl font-bold text-slate-100 leading-snug">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-4 text-lg font-semibold text-slate-100 leading-snug">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-3 text-base font-semibold text-slate-200">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-3 text-sm font-semibold text-slate-200">{children}</h4>
  ),

  // Paragraphs
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 leading-relaxed text-slate-200">{children}</p>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="mb-3 ml-5 list-disc space-y-1 text-slate-200">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-5 list-decimal space-y-1 text-slate-200">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),

  // Bold / italic
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-100">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-slate-300">{children}</em>
  ),

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-indigo-500 pl-4 italic text-slate-400">
      {children}
    </blockquote>
  ),

  // Horizontal rule
  hr: () => <hr className="my-4 border-slate-700" />,

  // Table
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-slate-700 bg-slate-800">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-slate-800">{children}</tbody>
  ),
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-slate-300">{children}</td>
  ),

  // Links — safe href only
  a: ({ href, children }) => (
    <a
      href={safeHref(href || "")}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300"
    >
      {children}
    </a>
  ),
};

// ── ImageLightbox ─────────────────────────────────────────────────────────────

function ImageLightbox({ url, alt, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label="Image lightbox"
    >
      {/* Stop propagation so clicking the image itself doesn't close */}
      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={url}
          alt={alt}
          className="max-h-[85vh] max-w-[88vw] rounded-xl object-contain shadow-2xl"
        />
        <button
          onClick={onClose}
          aria-label="Close image"
          className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-300 shadow-lg transition hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <CloseXIcon />
        </button>
      </div>
    </div>
  );
}

function CloseXIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}

function ArtifactIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-indigo-400" aria-hidden="true">
      <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 0 0 2 4.25v11.5A2.25 2.25 0 0 0 4.25 18h11.5A2.25 2.25 0 0 0 18 15.75V4.25A2.25 2.25 0 0 0 15.75 2H4.25Zm4.03 6.28a.75.75 0 0 0-1.06-1.06L5.97 9.47a.75.75 0 0 0 0 1.06l1.25 1.25a.75.75 0 1 0 1.06-1.06l-.72-.72.72-.72Zm4.5-1.06a.75.75 0 1 0-1.06 1.06l.72.72-.72.72a.75.75 0 1 0 1.06 1.06l1.25-1.25a.75.75 0 0 0 0-1.06l-1.25-1.25Z" clipRule="evenodd" />
    </svg>
  );
}

// ── ImageGrid ─────────────────────────────────────────────────────────────────

function ImageGrid({ images }) {
  const [lightbox, setLightbox] = useState(null); // { url, alt }

  const openLightbox = useCallback((url, alt) => setLightbox({ url, alt }), []);
  const closeLightbox = useCallback(() => setLightbox(null), []);

  if (!images || images.length === 0) return null;

  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {images.map((imgUrl, idx) => (
          <button
            key={`${imgUrl}-${idx}`}
            type="button"
            onClick={() => openLightbox(imgUrl, `Search result ${idx + 1}`)}
            className="group/img relative block aspect-video overflow-hidden rounded-lg border border-slate-700 bg-slate-900 transition hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label={`View image ${idx + 1}`}
          >
            <img
              src={imgUrl}
              alt={`Search result ${idx + 1}`}
              loading="lazy"
              onError={(e) => {
                const container = e.currentTarget.parentElement;
                if (container) container.style.display = "none";
              }}
              className="h-full w-full object-cover transition duration-200 group-hover/img:scale-105"
            />
          </button>
        ))}
      </div>

      {lightbox && (
        <ImageLightbox url={lightbox.url} alt={lightbox.alt} onClose={closeLightbox} />
      )}
    </>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

export default function MessageBubble({ message, onSelectArtifact }) {
  const isUser = message.role === "user";
  const time = formatTime(message.createdAt);
  const images = Array.isArray(message.images) ? message.images : [];
  const artifacts = Array.isArray(message.artifacts) ? message.artifacts : [];
  const projectFiles = artifacts.flatMap((a) => (Array.isArray(a.files) ? a.files : []));

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`group max-w-[85%] space-y-1 ${isUser ? "items-end" : "items-start"} flex flex-col`}
      >
        {isUser ? (
          /* ── User message: styled bubble ─────────────────────────── */
          <div className="rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-3 text-sm leading-relaxed text-white whitespace-pre-wrap break-words">
            {message.content}
          </div>
        ) : (
          /* ── Assistant message: transparent, Markdown-rendered ────── */
          <div className="min-w-0 max-w-full overflow-hidden rounded-2xl rounded-bl-sm bg-slate-800/50 px-4 py-3 text-sm text-slate-100">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
              // Do not interpret raw HTML from model output
              skipHtml={true}
            >
              {message.content || ""}
            </ReactMarkdown>

            {/* Search result images */}
            <ImageGrid images={images} />

            {/* Coding Agent Generated Files / Artifact trigger */}
            {projectFiles.length > 0 && (
              <div className="mt-3 pt-2 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => onSelectArtifact?.({ type: "project", artifacts })}
                  className="flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-950/50 px-3 py-2 text-xs font-medium text-indigo-300 transition hover:bg-indigo-900/60 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <ArtifactIcon />
                  <span>
                    View Generated Project ({projectFiles.length} file{projectFiles.length === 1 ? "" : "s"})
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Timestamp (hover-visible) */}
        {time && (
          <span className="px-1 text-xs text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">
            {time}
          </span>
        )}
      </div>
    </div>
  );
}
