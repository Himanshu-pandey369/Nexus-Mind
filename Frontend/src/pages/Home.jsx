import { useState, useRef } from "react";
import { useDispatch } from "react-redux";
import api from "../../utils/axios";
import Sidebar from "../components/Sidebar";
import ChatArea from "../components/ChatArea";
import ArtifactPanel from "../components/ArtifactPanel";
import { fetchCreditBalance, setCreditBalance } from "../redux/creditsSlice";

// ─────────────────────────────────────────────────────────────────────────────
// Home — top-level layout and shared state coordinator
//
// Layout (desktop):  [Sidebar 260px] | [ChatArea flex-1] | [ArtifactPanel 360px]
// Layout (tablet):   Sidebar collapses to drawer overlay; artifact panel collapses
// Layout (mobile):   Chat is full-screen; sidebar & artifact behind drawer controls
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const dispatch = useDispatch();

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
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  // ── Artifact ──────────────────────────────────────────────────────────────
  // Coding agent artifacts: { type, files: [{ name, content }] }[]
  // Legacy text artifact: { type: "code", content: string } (retained for non-coding messages)
  const [artifact, setArtifact] = useState(null);

  // ── Agent selection ───────────────────────────────────────────────────────
  // "auto" = let the backend router decide.
  // "search", "chat", etc. = direct manual selection passed to backend.
  const [selectedAgent, setSelectedAgent] = useState("auto");
  const selectedAgentRef = useRef(selectedAgent);

  const handleAgentSelect = (agentId) => {
    selectedAgentRef.current = agentId;
    setSelectedAgent(agentId);
  };

  // ── Artifact selection from message bubble ────────────────────────────────
  const handleSelectArtifact = (art) => {
    setArtifact(art);
    setArtifactOpen(true);
  };

  // ── Shared conversation-reset helper ─────────────────────────────────────
  // Inline because it only resets local state — no async, no deps needed.
  const resetChat = () => {
    setMessages([]);
    setArtifact(null);
    setConversationTitle("New Conversation");
    setPrompt("");
    setError(null);
    setSelectedFile(null);
    setUploadError(null);
  };

  // ── Load messages for a selected conversation ─────────────────────────────
  const loadConversation = async (id, initialTitle) => {
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

      // Restore artifact from the latest assistant message:
      // Prefer structured artifacts (Coding Agent), fall back to legacy code-block detection
      const lastAssistant = [...loaded]
        .reverse()
        .find((m) => m.role === "assistant");
      const codingArtifacts = lastAssistant?.artifacts?.filter(
        (a) => a.type === "code_generation" || (Array.isArray(a.files) && a.files.length > 0)
      );
      if (codingArtifacts && codingArtifacts.length > 0) {
        setArtifact({ type: "project", artifacts: codingArtifacts });
      } else if (lastAssistant && lastAssistant.content.includes("```")) {
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
  };

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
    if ((!trimmed && !selectedFile) || loading) return;

    setError(null);
    setUploadError(null);

    const promptText = trimmed || "Analyze this image";
    const fileToSend = selectedFile;

    // Optimistically add the user message
    let optimisticImages = [];
    if (fileToSend) {
      optimisticImages = [URL.createObjectURL(fileToSend)];
    }
    const optimisticMsg = {
      role: "user",
      content: promptText,
      ...(optimisticImages.length > 0 ? { images: optimisticImages } : {}),
    };
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

        const title = promptText.slice(0, 60) + (promptText.length > 60 ? "…" : "");
        setConversationTitle(title);

        await api
          .patch(`/chat/conversations/${activeConvId}/title`, { title })
          .catch((err) => {
            console.warn("Failed to set conversation title:", err.message);
          });
      } else if (messages.length === 0) {
        const title = promptText.slice(0, 60) + (promptText.length > 60 ? "…" : "");
        setConversationTitle(title);
        api
          .patch(`/chat/conversations/${activeConvId}/title`, { title })
          .then(() => setSidebarRefresh((n) => n + 1))
          .catch(() => {});
      }

      // POST /agent/chat — { prompt, conversationId, agent } or FormData with file
      // The Agent controller persists the user message to Chat Service internally,
      // so we do NOT double-save it here.
      const agentToSend = selectedAgentRef.current || selectedAgent || "auto";

      let res;
      if (fileToSend) {
        const formData = new FormData();
        formData.append("prompt", promptText);
        formData.append("conversationId", activeConvId);
        formData.append("agent", agentToSend);
        formData.append("file", fileToSend);

        res = await api.post("/agent/chat", formData);
      } else {
        res = await api.post("/agent/chat", {
          prompt: promptText,
          conversationId: activeConvId,
          agent: agentToSend,
        });
      }

      // Clear the selected file on successful response
      setSelectedFile(null);

      const aiText = res.data.aiResponse;
      const images = Array.isArray(res.data.images) ? res.data.images : [];
      const artifacts = Array.isArray(res.data.artifacts) ? res.data.artifacts : [];

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: aiText, images, artifacts },
      ]);

      // Synchronize updated credit balance
      if (typeof res.data.credits === "number") {
        dispatch(setCreditBalance(res.data.credits));
      }
      dispatch(fetchCreditBalance());

      if (isFirstMessage) {
        setSidebarRefresh((n) => n + 1);
      }

      // ── Artifact detection ──────────────────────────────────────────────
      // Priority 1: structured project artifacts from Coding Agent
      // Priority 2: legacy — surface markdown code fences in the artifact panel
      const codingArtifacts = artifacts.filter(
        (a) => a.type === "code_generation" || (Array.isArray(a.files) && a.files.length > 0)
      );
      if (codingArtifacts.length > 0) {
        setArtifact({ type: "project", artifacts: codingArtifacts });
        setArtifactOpen(true);
      } else if (aiText && aiText.includes("```")) {
        setArtifact({ type: "code", content: aiText });
        setArtifactOpen(true);
      } else {
        setArtifact(null);
      }
    } catch (err) {
      if (err.response?.status === 402) {
        setError(
          "⚡ Insufficient credits to run this agent. Please top up your credits from the sidebar to continue."
        );
      } else {
        const msg =
          err.response?.data?.message ||
          "Something went wrong. Please try again.";
        setError(msg);
      }
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
          onSelectArtifact={handleSelectArtifact}
          artifactPanelOpen={artifactOpen}
          selectedFile={selectedFile}
          onFileChange={setSelectedFile}
          onRemoveFile={() => setSelectedFile(null)}
          uploadError={uploadError}
          onUploadError={setUploadError}
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
