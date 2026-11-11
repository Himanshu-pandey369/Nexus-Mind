import { useState, useRef, useEffect } from "react";

// ── Icon components ───────────────────────────────────────────────────────────

function AutoIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M9.674 2.075a.75.75 0 0 1 .652 0l7.25 3.5A.75.75 0 0 1 18 6.25v7.5a.75.75 0 0 1-.424.672l-7.25 3.5a.75.75 0 0 1-.652 0l-7.25-3.5A.75.75 0 0 1 2 13.75v-7.5a.75.75 0 0 1 .424-.672l7.25-3.5Z" clipRule="evenodd" />
    </svg>
  );
}

function ChatIconSvg() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M2 10c0-3.967 3.69-7 8-7 4.31 0 8 3.033 8 7s-3.69 7-8 7a9.165 9.165 0 0 1-2.63-.381l-3.276 1.092A.75.75 0 0 1 3 16.693V14.5A6.997 6.997 0 0 1 2 10Z" clipRule="evenodd" />
    </svg>
  );
}

function SearchIconSvg() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
    </svg>
  );
}

function CodeIconSvg() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 0 0 2 4.25v11.5A2.25 2.25 0 0 0 4.25 18h11.5A2.25 2.25 0 0 0 18 15.75V4.25A2.25 2.25 0 0 0 15.75 2H4.25Zm4.03 6.28a.75.75 0 0 0-1.06-1.06L5.97 9.47a.75.75 0 0 0 0 1.06l1.25 1.25a.75.75 0 1 0 1.06-1.06l-.72-.72.72-.72Zm4.5-1.06a.75.75 0 1 0-1.06 1.06l.72.72-.72.72a.75.75 0 1 0 1.06 1.06l1.25-1.25a.75.75 0 0 0 0-1.06l-1.25-1.25Z" clipRule="evenodd" />
    </svg>
  );
}

function PdfIconSvg() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" clipRule="evenodd" />
    </svg>
  );
}

function PptIconSvg() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a3.5 3.5 0 0 1-1.5 2.898v9.523A.75.75 0 0 1 15.75 18H4.25A.75.75 0 0 1 3.5 17.25V7.527A3.5 3.5 0 0 1 2 4.629V2.341a.75.75 0 0 1 .628-.74Z" clipRule="evenodd" />
    </svg>
  );
}

function ImageIconSvg() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a.75.75 0 0 0-1.06 0l-1.91 1.909.47.47a.75.75 0 1 1-1.06 1.06L6.53 8.091a.75.75 0 0 0-1.06 0l-2.97 2.97ZM12 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-nm-text-muted" aria-hidden="true">
      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
  );
}

// ── Agent definitions ─────────────────────────────────────────────────────────

const AGENTS = [
  { id: "auto",   label: "Auto",   description: "Let NexusMind decide",          Icon: AutoIcon    },
  { id: "chat",   label: "Chat",   description: "General conversation & Q&A",     Icon: ChatIconSvg },
  { id: "search", label: "Search", description: "Real-time web search",           Icon: SearchIconSvg },
  { id: "coding", label: "Coding", description: "Code generation & debugging",    Icon: CodeIconSvg },
  { id: "pdf",    label: "PDF",    description: "Read & summarise PDF documents", Icon: PdfIconSvg  },
  { id: "pdfRag", label: "PDF RAG", description: "Chat & search in PDF documents", Icon: PdfIconSvg },
  { id: "ppt",    label: "PPT",    description: "Generate presentation slides",   Icon: PptIconSvg  },
  { id: "vision", label: "Image",  description: "Generate or analyse images",     Icon: ImageIconSvg },
];

// ── AgentSelector Component ───────────────────────────────────────────────────

export default function AgentSelector({ selectedAgent, onSelect, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const current = AGENTS.find((a) => a.id === selectedAgent) || AGENTS[0];
  const { Icon: CurrentIcon } = current;

  const handleSelect = (agentId) => {
    if (typeof onSelect === "function") {
      onSelect(agentId);
    }
    if (typeof onChange === "function") {
      onChange(agentId);
    }
    setOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-1.5 rounded-lg border border-nm-border bg-nm-secondary px-2.5 sm:px-3 py-1.5 text-xs font-medium text-nm-text-secondary transition hover:bg-nm-hover hover:border-gold/40 focus:outline-none focus:ring-2 focus:ring-gold/50 shrink-0 select-none"
      >
        <span className="shrink-0 text-gold"><CurrentIcon /></span>
        <span className="shrink-0">{current.label}</span>
        <span className="shrink-0"><ChevronDownIcon /></span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select agent"
          className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-nm-border bg-nm-elevated p-1 shadow-2xl shadow-black/60"
        >
          {AGENTS.map((agent) => {
            const { Icon: AgentIcon } = agent;
            const isSelected = agent.id === selectedAgent;
            return (
              <button
                key={agent.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(agent.id)}
                className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gold/50 ${
                  isSelected
                    ? "bg-gold-surface text-gold border border-gold/30"
                    : "text-nm-text-secondary hover:bg-nm-hover hover:text-nm-text border border-transparent"
                }`}
              >
                <span className="mt-0.5 shrink-0 text-gold"><AgentIcon /></span>
                <div>
                  <div className="font-medium text-nm-text">{agent.label}</div>
                  <div className="text-nm-text-muted">{agent.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
