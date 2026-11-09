import { useSelector } from "react-redux";
import AgentSelector from "./AgentSelector";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import getUserPlan from "../utils/userPlan";

// ── Icons ─────────────────────────────────────────────────────────────────────

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
    </svg>
  );
}

function PanelIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path fillRule="evenodd" d="M2.5 3A1.5 1.5 0 0 0 1 4.5v3A1.5 1.5 0 0 0 2.5 9h6A1.5 1.5 0 0 0 10 7.5v-3A1.5 1.5 0 0 0 8.5 3h-6Zm9.5 0A1.5 1.5 0 0 0 10.5 4.5v7A1.5 1.5 0 0 0 12 13h6a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 17.5 3H12Zm-9 8.5A1.5 1.5 0 0 0 1.5 13v2.5A1.5 1.5 0 0 0 3 17h6a1.5 1.5 0 0 0 1.5-1.5V13A1.5 1.5 0 0 0 8.5 11.5h-6Z" clipRule="evenodd" />
    </svg>
  );
}

// ── ChatArea ──────────────────────────────────────────────────────────────────

export default function ChatArea({
  conversationTitle,
  messages,
  loading,
  error,
  prompt,
  onPromptChange,
  onSend,
  selectedAgent,
  onAgentSelect,
  onAgentChange,
  onToggleSidebar,
  onToggleArtifact,
  onSelectArtifact,
  artifactPanelOpen,
  selectedFile,
  onFileChange,
  onRemoveFile,
  uploadError,
  onUploadError,
}) {
  const handleAgentChange = onAgentSelect || onAgentChange;
  const { userData } = useSelector((state) => state.user);
  const userPlan = getUserPlan(userData);
  return (
    <div className="flex h-full flex-col bg-slate-950 min-w-0">
      {/* ── Chat header ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 px-3 sm:px-4 py-2.5 sm:py-3 gap-2 sm:gap-4 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Sidebar toggle — visible on tablet/mobile */}
          <button
            onClick={onToggleSidebar}
            title="Toggle sidebar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 lg:hidden"
            aria-label="Toggle sidebar"
          >
            <MenuIcon />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-slate-200">
              {conversationTitle || "New Conversation"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Dynamic User Plan Badge */}
          <span className="hidden sm:inline-flex items-center rounded-full bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-indigo-300 border border-slate-700/60 select-none">
            {userPlan} Plan
          </span>

          {/* Agent selector */}
          <AgentSelector
            selectedAgent={selectedAgent}
            onSelect={handleAgentChange}
            onChange={handleAgentChange}
          />

          {/* Artifact panel toggle */}
          <button
            onClick={onToggleArtifact}
            title="Toggle artifact panel"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              artifactPanelOpen ? "bg-slate-800 text-slate-200" : ""
            }`}
            aria-label="Toggle artifact panel"
            aria-pressed={artifactPanelOpen}
          >
            <PanelIcon />
          </button>
        </div>
      </header>

      {/* ── Message list (scrollable) ── */}
      <MessageList
        messages={messages}
        loading={loading}
        error={error}
        onSelectArtifact={onSelectArtifact}
      />

      {/* ── Chat input ── */}
      <ChatInput
        prompt={prompt}
        onChange={onPromptChange}
        onSend={onSend}
        loading={loading}
        disabled={loading}
        selectedFile={selectedFile}
        onFileChange={onFileChange}
        onRemoveFile={onRemoveFile}
        uploadError={uploadError}
        onUploadError={onUploadError}
      />
    </div>
  );
}
