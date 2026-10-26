import { useState, useCallback, useRef, useEffect } from "react";
import api from "../../utils/axios";
import Sidebar from "../components/Sidebar";
import ChatArea from "../components/ChatArea";
import ArtifactPanel from "../components/ArtifactPanel";

// ─────────────────────────────────────────────────────────────────────────────
// Home — top-level layout and shared state coordinator
//
// Layout (desktop):  [Sidebar 260px] | [ChatArea flex-1] | [ArtifactPanel 360px]
// Layout (tablet):   Sidebar collapses to drawer overlay; artifact panel collapses
// Layout (mobile):   Chat is full-screen; sidebar & artifact behind drawer controls
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  // ── Panel visibility (tablet / mobile) ────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [artifactOpen, setArtifactOpen] = useState(false);

  // ── Conversation state ────────────────────────────────────────────────────
  const [conversationId, setConversationId] = useState(null);
  const [conversationTitle, setConversationTitle] = useState("New Conversation");
  const [messages, setMessages] = useState([]);

  // Increment to trigger sidebar refresh after new conversation is created/titled
  const [sidebarRefresh, setSidebarRefresh] = useState(0);

  // ── Chat state ────────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Agent selection ───────────────────────────────────────────────────────
  // "auto" = let the backend router decide.
  // "search", "chat", etc. = direct manual selection passed to backend.
  const [selectedAgent, setSelectedAgent] = useState("auto");
  const selectedAgentRef = useRef(selectedAgent);

  const handleAgentSelect = useCallback((agentId) => {
    selectedAgentRef.current = agentId;
    setSelectedAgent(agentId);
  }, []);

  // ── Artifact ──────────────────────────────────────────────────────────────
  // { type: "code"|"image"|"text", content: string, imageUrl?: string }
  const [artifact, setArtifact] = useState(null);

  // ── Shared conversation-reset helper ─────────────────────────────────────
  // Inline because it only resets local state — no async, no deps needed.
  const resetChat = useCallback(() => {
    setMessages([]);
    setArtifact(null);
    setConversationTitle("New Conversation");
    setPrompt("");
    setError(null);
  }, []);

  // ── Load messages for a selected conversation ─────────────────────────────
  const loadConversation = useCallback(
    async (id, initialTitle) => {
      resetChat();
      setConversationId(id);
      if (initialTitle) {
        setConversationTitle(initialTitle);
      }
      setLoading(true);
      try {
        const res = await api.get(`/chat/conversations/${id}/messages`);
        const loaded = res.data.messages || [];
        setMessages(loaded);
        // Retain initialTitle if valid, or derive from the first user message
        const firstUser = loaded.find((m) => m.role === "user");
        if (initialTitle && initialTitle !== "New Conversation") {
          setConversationTitle(initialTitle);
        } else if (firstUser?.content) {
          const t = firstUser.content;
          setConversationTitle(t.slice(0, 60) + (t.length > 60 ? "…" : ""));
        }

        // Restore artifact if the latest assistant message contains code
        const lastAssistant = [...loaded]
          .reverse()
          .find((m) => m.role === "assistant");
        if (lastAssistant && lastAssistant.content.includes("```")) {
          setArtifact({ type: "code", content: lastAssistant.content });
        } else {
          setArtifact(null);
        }
      } catch (err) {
        console.error("Failed to load messages:", err.message);
        setError("Could not load conversation messages.");
      } finally {
        setLoading(false);
      }
    },
    [resetChat]
  );

  // ── Sidebar: select a conversation ───────────────────────────────────────
  const handleSelectConversation = (id, title) => {
    if (id === conversationId) return;
    loadConversation(id, title);
    setSidebarOpen(false);
  };

  // ── New Chat button ───────────────────────────────────────────────────────
  const handleNewChat = () => {
    resetChat();
    setConversationId(null);
    setSidebarOpen(false);
  };

  // ── Send a message ────────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    setError(null);

    // Optimistically add the user message
    const optimisticMsg = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, optimisticMsg]);
    setPrompt("");
    setLoading(true);

    let activeConvId = conversationId;
    const isFirstMessage = !activeConvId;

    try {
      if (!activeConvId) {
        // Create conversation on demand when the first message is sent
        const createRes = await api.post("/chat/conversations");
        activeConvId = createRes.data.conversation._id;
        setConversationId(activeConvId);

        const title = trimmed.slice(0, 60) + (trimmed.length > 60 ? "…" : "");
        setConversationTitle(title);

        await api
          .patch(`/chat/conversations/${activeConvId}/title`, { title })
          .catch((err) => {
            console.warn("Failed to set conversation title:", err.message);
          });
      } else if (messages.length === 0) {
        const title = trimmed.slice(0, 60) + (trimmed.length > 60 ? "…" : "");
        setConversationTitle(title);
        api
          .patch(`/chat/conversations/${activeConvId}/title`, { title })
          .then(() => setSidebarRefresh((n) => n + 1))
          .catch(() => {});
      }

      // POST /agent/chat — { prompt, conversationId, agent }
      // The Agent controller persists the user message to Chat Service internally,
      // so we do NOT double-save it here.
      const agentToSend = selectedAgentRef.current || selectedAgent || "auto";

      const res = await api.post("/agent/chat", {
        prompt: trimmed,
        conversationId: activeConvId,
        agent: agentToSend,
      });

      const aiText = res.data.aiResponse;
      const images = Array.isArray(res.data.images) ? res.data.images : [];

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: aiText, images },
      ]);

      if (isFirstMessage) {
        setSidebarRefresh((n) => n + 1);
      }

      // ── Artifact detection ──────────────────────────────────────────────
      // Current backend: aiResponse is always plain text.
      // Surface code blocks (``` fences) in the artifact panel.
      if (aiText && aiText.includes("```")) {
        setArtifact({ type: "code", content: aiText });
        setArtifactOpen(true);
      } else {
        setArtifact(null);
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        "Something went wrong. Please try again.";
      setError(msg);
      // Optimistic message remains visible so the user knows what they sent.
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-svh w-full overflow-hidden bg-slate-950">
      {/* ── Mobile sidebar overlay ───────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      {/*
        Desktop (lg+): always visible at 260px
        Tablet/Mobile: slide-over drawer
      */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-[260px] transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:z-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:flex lg:w-[260px] lg:shrink-0`}
      >
        <Sidebar
          activeConversationId={conversationId}
          onSelectConversation={handleSelectConversation}
          onNewChat={handleNewChat}
          refreshTrigger={sidebarRefresh}
        />
      </div>

      {/* ── Centre chat area ─────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <ChatArea
          conversationTitle={conversationTitle}
          messages={messages}
          loading={loading}
          error={error}
          prompt={prompt}
          onPromptChange={setPrompt}
          onSend={handleSend}
          selectedAgent={selectedAgent}
          onAgentSelect={handleAgentSelect}
          onAgentChange={handleAgentSelect}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          onToggleArtifact={() => setArtifactOpen((o) => !o)}
          artifactPanelOpen={artifactOpen}
        />
      </div>

      {/* ── Right artifact panel ─────────────────────────────────────────── */}
      {/* Mobile overlay */}
      {artifactOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 xl:hidden"
          onClick={() => setArtifactOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed inset-y-0 right-0 z-30 w-[360px] transform transition-transform duration-300 ease-in-out xl:static xl:translate-x-0 xl:z-auto ${
          artifactOpen ? "translate-x-0" : "translate-x-full xl:hidden"
        } xl:w-[360px] xl:shrink-0`}
      >
        <ArtifactPanel
          artifact={artifact}
          onClose={() => setArtifactOpen(false)}
        />
      </div>
    </div>
  );
}
