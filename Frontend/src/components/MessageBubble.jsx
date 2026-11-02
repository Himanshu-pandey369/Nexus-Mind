// MessageBubble — renders a single user or assistant message.
// Backend Message schema: { _id, conversationId, role, content, images, createdAt, updatedAt }
// Optimistic messages:    { role, content, images }

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import api from "../../utils/axios";

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
  a: ({ href, children }) => {
    const safe = safeHref(href || "");
    const isPdfLink = safe.includes("res.cloudinary.com") && safe.toLowerCase().includes(".pdf");

    if (isPdfLink) {
      const handlePdfClick = async (e) => {
        e.preventDefault();
        try {
          const res = await api.get("/agent/pdf/download", {
            params: { url: safe },
            responseType: "blob",
          });
          const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = safe.split("/").pop() || "document.pdf";
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
          console.error("PDF download proxy error:", err);
          window.open(safe, "_blank");
        }
      };

      return (
        <a
          href={safe}
          onClick={handlePdfClick}
          className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300 cursor-pointer"
        >
          {children}
        </a>
      );
    }

    return (
      <a
        href={safe}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300"
      >
        {children}
      </a>
    );
  },
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

// ── PdfIcon ───────────────────────────────────────────────────────────────────

function PdfIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-red-400" aria-hidden="true">
      <path fillRule="evenodd" d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" clipRule="evenodd" />
    </svg>
  );
}

// ── PdfDownloadCard ───────────────────────────────────────────────────────────

function PdfDownloadCard({ title, url }) {
  const [downloading, setDownloading] = useState(false);

  if (!url) return null;

  const handleDownload = async (e) => {
    e.preventDefault();
    setDownloading(true);
    try {
      const filename = `${title || "document"}.pdf`;
      const response = await api.get("/agent/pdf/download", {
        params: { url, filename },
        responseType: "blob",
      });

      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Authenticated PDF download failed, falling back to direct URL:", err);
      window.open(url, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3">
      <PdfIcon />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-200">
          {title || "Generated Document"}
        </p>
        <p className="text-[10px] text-slate-500">PDF · NexusMind</p>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="shrink-0 flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-red-500 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-red-500"
      >
        {downloading ? (
          <>
            <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            Downloading...
          </>
        ) : (
          "Download"
        )}
      </button>
    </div>
  );
}

// ── PptIcon ───────────────────────────────────────────────────────────────────

function PptIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-orange-400" aria-hidden="true">
      <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a3.5 3.5 0 0 1-1.5 2.898v9.523A.75.75 0 0 1 15.75 18H4.25A.75.75 0 0 1 3.5 17.25V7.527A3.5 3.5 0 0 1 2 4.629V2.341a.75.75 0 0 1 .628-.74Z" clipRule="evenodd" />
    </svg>
  );
}

// ── PptDownloadCard ───────────────────────────────────────────────────────────

function PptDownloadCard({ title, url }) {
  const [downloading, setDownloading] = useState(false);

  if (!url) return null;

  const handleDownload = async (e) => {
    e.preventDefault();
    setDownloading(true);
    try {
      const filename = `${title || "presentation"}.pptx`;
      const response = await api.get("/agent/ppt/download", {
        params: { url, filename },
        responseType: "blob",
      });

      const blobUrl = window.URL.createObjectURL(
        new Blob([response.data], {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        })
      );
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Authenticated PPT download failed, falling back to direct URL:", err);
      window.open(url, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-950/30 px-4 py-3">
      <PptIcon />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-200">
          {title || "Generated Presentation"}
        </p>
        <p className="text-[10px] text-slate-500">PPTX · NexusMind</p>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="shrink-0 flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-orange-500 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-orange-500"
      >
        {downloading ? (
          <>
            <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            Downloading...
          </>
        ) : (
          "Download"
        )}
      </button>
    </div>
  );
}

// ── ImageGrid ─────────────────────────────────────────────────────────────────

function ImageGrid({ images }) {
  const [lightbox, setLightbox] = useState(null); // { url, alt }

  const openLightbox = useCallback((url, alt) => setLightbox({ url, alt }), []);
  const closeLightbox = useCallback(() => setLightbox(null), []);

  if (!images || images.length === 0) return null;

  // A single generated image gets a wider square display; multiple images use a grid
  const isSingle = images.length === 1;

  return (
    <>
      <div
        className={
          isSingle
            ? "mt-3"
            : "mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
        }
      >
        {images.map((imgUrl, idx) => {
          const altText = `Image ${idx + 1}`;
          return (
            <button
              key={`${imgUrl}-${idx}`}
              type="button"
              onClick={() => openLightbox(imgUrl, altText)}
              className={`group/img relative block overflow-hidden rounded-xl border border-slate-700 bg-slate-900 transition hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isSingle
                  ? "w-full max-w-sm aspect-square"
                  : "aspect-video"
              }`}
              aria-label={`View ${altText}`}
            >
              <img
                src={imgUrl}
                alt={altText}
                loading="lazy"
                onError={(e) => {
                  const container = e.currentTarget.parentElement;
                  if (container) container.style.display = "none";
                }}
                className="h-full w-full object-cover transition duration-200 group-hover/img:scale-105"
              />
              {/* Download hint on hover */}
              <a
                href={imgUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-2 right-2 hidden rounded-md bg-black/60 px-2 py-1 text-[10px] text-white backdrop-blur-sm group-hover/img:flex items-center gap-1 hover:bg-black/80"
                aria-label="Download image"
              >
                ↓ Save
              </a>
            </button>
          );
        })}
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

  // Separate PDF artifacts from coding project artifacts
  const pdfArtifacts = [...artifacts.filter((a) => a.type === "pdf" && a.url)];
  if (pdfArtifacts.length === 0 && message.content) {
    const match = message.content.match(/\[(?:⬇️\s*)?Download PDF\]\((https?:\/\/[^\s)]+\.pdf[^\s)]*)\)/i);
    if (match) {
      const titleMatch = message.content.match(/\*\*Title:\*\*\s*(.+)/i);
      pdfArtifacts.push({
        type: "pdf",
        title: titleMatch ? titleMatch[1].trim() : "Generated Document",
        url: match[1],
      });
    }
  }

  // Separate PPT artifacts
  const pptArtifacts = [...artifacts.filter((a) => a.type === "ppt" && a.url)];
  if (pptArtifacts.length === 0 && message.content) {
    const match = message.content.match(/\[(?:⬇️\s*)?Download Presentation\]\((https?:\/\/[^\s)]+\.pptx[^\s)]*)\)/i);
    if (match) {
      const titleMatch = message.content.match(/\*\*Presentation:\*\*\s*(.+)/i);
      pptArtifacts.push({
        type: "ppt",
        title: titleMatch ? titleMatch[1].trim() : "Generated Presentation",
        url: match[1],
      });
    }
  }

  const projectFiles = artifacts
    .filter((a) => a.type !== "pdf" && a.type !== "ppt")
    .flatMap((a) => (Array.isArray(a.files) ? a.files : []));

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

            {/* Search result images or Vision Agent generated images */}
            <ImageGrid images={images} />

            {/* PDF Agent — download card for each generated PDF */}
            {pdfArtifacts.map((pdf, idx) => (
              <PdfDownloadCard
                key={`${pdf.url}-${idx}`}
                title={pdf.title}
                url={pdf.url}
              />
            ))}

            {/* PPT Agent — download card for each generated presentation */}
            {pptArtifacts.map((ppt, idx) => (
              <PptDownloadCard
                key={`${ppt.url}-${idx}`}
                title={ppt.title}
                url={ppt.url}
              />
            ))}

            {/* Coding Agent Generated Files / Artifact trigger */}
            {projectFiles.length > 0 && (
              <div className="mt-3 pt-2 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => onSelectArtifact?.({ type: "project", artifacts: artifacts.filter((a) => a.type !== "pdf" && a.type !== "ppt") })}
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
