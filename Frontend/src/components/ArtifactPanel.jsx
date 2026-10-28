import { useState, useMemo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

// ── Icons ─────────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}

function CodeBracketIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path fillRule="evenodd" d="M6.28 5.22a.75.75 0 0 1 0 1.06L2.56 10l3.72 3.72a.75.75 0 0 1-1.06 1.06L.97 10.53a.75.75 0 0 1 0-1.06L5.22 5.22a.75.75 0 0 1 1.06 0Zm7.44 0a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L17.44 10l-3.72-3.72a.75.75 0 0 1 0-1.06ZM11.377 2.011a.75.75 0 0 1 .612.867l-2.5 14.5a.75.75 0 0 1-1.478-.255l2.5-14.5a.75.75 0 0 1 .866-.612Z" clipRule="evenodd" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41Z" clipRule="evenodd" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
      <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
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

// ── Language detection from filename ─────────────────────────────────────────

function detectLanguage(filename) {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map = {
    js: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx",
    py: "python", html: "html", css: "css", scss: "scss",
    json: "json", md: "markdown", sh: "bash", bash: "bash",
    java: "java", cpp: "cpp", c: "c", cs: "csharp",
    go: "go", rs: "rust", rb: "ruby", php: "php",
    yml: "yaml", yaml: "yaml", xml: "xml", sql: "sql",
    txt: "text",
  };
  return map[ext] || "text";
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable; fail silently
    }
  };
  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy file content"}
      className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition select-none focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
        copied ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
      }`}
    >
      {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
    </button>
  );
}

// ── Project artifact panel (multi-file) ───────────────────────────────────────

function ProjectArtifact({ projectArtifacts }) {
  // Flatten all files across artifacts (usually just one artifact with multiple files)
  const allFiles = useMemo(
    () => projectArtifacts.flatMap((a) => (Array.isArray(a.files) ? a.files : [])),
    [projectArtifacts]
  );

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [tab, setTab] = useState("code");

  if (allFiles.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-500">
        No files in this artifact.
      </div>
    );
  }

  const currentFile = allFiles[Math.min(selectedIdx, allFiles.length - 1)];
  const lang = detectLanguage(currentFile.name);

  // Preview is only offered when the project has an HTML file
  const htmlFile = allFiles.find((f) => f.name.toLowerCase().endsWith(".html"));
  const canPreview = Boolean(htmlFile);

  // Build preview HTML by inlining CSS and JS into the HTML file
  const buildPreviewHtml = () => {
    if (!htmlFile) return "";
    let html = htmlFile.content;
    // Inline <link rel="stylesheet" href="..."> references to local CSS files
    html = html.replace(
      /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*\/?>/gi,
      (match, href) => {
        const cssFile = allFiles.find(
          (f) => f.name === href || f.name.endsWith("/" + href)
        );
        return cssFile ? `<style>${cssFile.content}</style>` : match;
      }
    );
    // Inline <script src="..."> references to local JS files
    html = html.replace(
      /<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi,
      (match, src) => {
        const jsFile = allFiles.find(
          (f) => f.name === src || f.name.endsWith("/" + src)
        );
        return jsFile ? `<script>${jsFile.content}</script>` : match;
      }
    );
    return html;
  };

  const renderPreview = () => {
    const html = buildPreviewHtml();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    return (
      <iframe
        key={url}
        title="Project preview"
        src={url}
        sandbox="allow-scripts allow-same-origin"
        className="h-full w-full rounded-lg border border-slate-700 bg-white"
      />
    );
  };

  return (
    <div className="flex h-full flex-col min-h-0">
      {/* ── File list ── */}
      <div className="shrink-0 border-b border-slate-800 px-3 py-2">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Files ({allFiles.length})
        </p>
        <div className="flex flex-col gap-0.5">
          {allFiles.map((file, idx) => (
            <button
              key={`${file.name}-${idx}`}
              onClick={() => { setSelectedIdx(idx); setTab("code"); }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 ${
                idx === selectedIdx
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                  : "text-slate-300 hover:bg-slate-800 border border-transparent"
              }`}
              title={file.name}
            >
              <FileIcon />
              <span className="truncate font-mono">{file.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Code / Preview tabs ── */}
      <div className="flex shrink-0 gap-1 border-b border-slate-800 px-3 pt-2">
        <button
          onClick={() => setTab("code")}
          className={`flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            tab === "code"
              ? "border-b-2 border-indigo-500 text-indigo-400 bg-slate-800"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <CodeBracketIcon className="h-3.5 w-3.5" />
          Code
        </button>
        {canPreview && (
          <button
            onClick={() => setTab("preview")}
            className={`flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
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

      {/* ── File content ── */}
      {tab === "code" ? (
        <div className="flex flex-1 flex-col min-h-0">
          {/* File header with name + copy */}
          <div className="flex shrink-0 items-center justify-between bg-slate-800/60 px-3 py-1.5">
            <span className="font-mono text-[11px] text-slate-400 truncate">{currentFile.name}</span>
            <CopyButton text={currentFile.content} />
          </div>
          {/* Syntax-highlighted content */}
          <div className="flex-1 overflow-auto">
            <SyntaxHighlighter
              language={lang}
              style={oneDark}
              PreTag="div"
              customStyle={{
                margin: 0,
                padding: "1rem",
                background: "transparent",
                fontSize: "0.75rem",
                lineHeight: "1.6",
                minHeight: "100%",
              }}
              codeTagProps={{
                style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
              }}
            >
              {currentFile.content}
            </SyntaxHighlighter>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden p-3">{renderPreview()}</div>
      )}
    </div>
  );
}

// ── Legacy text/code artifact (non-coding-agent responses) ────────────────────

function LegacyCodeArtifact({ content }) {
  const [tab, setTab] = useState("code");
  const hasPreview = content.includes("<html") || content.includes("<!doctype");

  const renderPreview = () => {
    const blob = new Blob([content], { type: "text/html" });
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

  return (
    <div className="flex h-full flex-col min-h-0">
      {(hasPreview) && (
        <div className="flex shrink-0 gap-1 border-b border-slate-800 px-3 pt-2">
          <button
            onClick={() => setTab("code")}
            className={`flex items-center gap-1.5 rounded-t-md px-3 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              tab === "code"
                ? "border-b-2 border-indigo-500 text-indigo-400 bg-slate-800"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <CodeBracketIcon className="h-3.5 w-3.5" />
            Code
          </button>
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
        </div>
      )}
      <div className="flex-1 overflow-hidden p-3">
        {tab === "preview" && hasPreview
          ? renderPreview()
          : (
            <pre className="h-full overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-300 font-mono whitespace-pre-wrap break-words">
              <code>{content || ""}</code>
            </pre>
          )}
      </div>
    </div>
  );
}

// ── ArtifactPanel (main export) ───────────────────────────────────────────────

/**
 * Props:
 *   artifact:
 *     null                                              — nothing to show
 *     { type: "project", artifacts: [...] }             — Coding Agent project files
 *     { type: "code",    content: string }              — legacy Markdown-with-fences
 *   onClose: () => void
 */
export default function ArtifactPanel({ artifact, onClose }) {
  const isProject = artifact?.type === "project" && Array.isArray(artifact.artifacts);
  const isLegacyCode = artifact?.type === "code" && typeof artifact.content === "string";

  // Header badge label
  const badge = isProject ? "project" : artifact?.type ?? null;

  return (
    <aside className="flex h-full flex-col bg-slate-950 border-l border-slate-800">
      {/* ── Panel header ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <CodeBracketIcon />
          <h2 className="text-sm font-semibold text-slate-200">Artifact</h2>
          {badge && (
            <span className="rounded-full bg-indigo-600/20 px-2 py-0.5 text-xs font-medium text-indigo-400 capitalize">
              {badge}
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

      {/* ── Project artifact (Coding Agent) ── */}
      {isProject && (
        <ProjectArtifact
          key={JSON.stringify(artifact.artifacts)}
          projectArtifacts={artifact.artifacts}
        />
      )}

      {/* ── Legacy code artifact ── */}
      {isLegacyCode && !isProject && (
        <LegacyCodeArtifact content={artifact.content} />
      )}
    </aside>
  );
}
