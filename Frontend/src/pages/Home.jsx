import { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { clearUser } from "../redux/userSlice";
import api from "../../utils/axios";

export default function Home() {
  const dispatch = useDispatch();
  const { userData } = useSelector((state) => state.user);

  // Chat state
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [convLoading, setConvLoading] = useState(false);

  const messagesEndRef = useRef(null);

  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Create a conversation when the component mounts (once per login session)
  useEffect(() => {
    const createConversation = async () => {
      setConvLoading(true);
      try {
        const res = await api.post("/chat/conversations");
        setConversationId(res.data.conversation._id);
      } catch (err) {
        console.error("Failed to create conversation:", err.message);
        setError("Could not start a conversation. Please refresh.");
      } finally {
        setConvLoading(false);
      }
    };

    createConversation();
  }, []);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error("Logout failed:", err.message);
    } finally {
      dispatch(clearUser());
    }
  };

  const handleSend = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading || !conversationId) return;

    // Optimistically add user message to the UI
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setPrompt("");
    setError(null);
    setLoading(true);

    try {
      const res = await api.post("/agent/chat", {
        prompt: trimmed,
        conversationId,
      });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.data.aiResponse },
      ]);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col min-h-svh bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-indigo-600 to-fuchsia-600 text-base font-bold text-white">
            N
          </div>
          <span className="text-lg font-semibold tracking-tight">NexusMind</span>
        </div>

        <div className="flex items-center gap-4">
          {userData?.photoURL && (
            <img
              src={userData.photoURL}
              alt="avatar"
              className="h-8 w-8 rounded-full"
            />
          )}
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {userData?.name || userData?.email}
          </span>
          <button
            onClick={handleLogout}
            className="rounded-lg bg-slate-200 px-4 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ── Messages area ── */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {convLoading && (
            <p className="text-center text-sm text-slate-400">
              Starting conversation…
            </p>
          )}

          {messages.length === 0 && !convLoading && (
            <div className="text-center text-slate-400 mt-20">
              <p className="text-4xl mb-4">💬</p>
              <p className="text-lg font-medium">
                Ask NexusMind anything
              </p>
              <p className="text-sm mt-1">
                Chat, search, coding help, PDFs, presentations, and images.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-sm"
                    : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Loading bubble */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-4 py-3">
                <span className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" />
                </span>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              ⚠️ {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* ── Input bar ── */}
      <footer className="border-t border-slate-200 dark:border-slate-800 px-4 py-4 shrink-0">
        <div className="mx-auto max-w-2xl flex gap-3 items-end">
          <textarea
            rows={1}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message NexusMind… (Enter to send)"
            disabled={loading || convLoading || !conversationId}
            className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-relaxed focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400"
            style={{ maxHeight: "150px", overflowY: "auto" }}
          />
          <button
            onClick={handleSend}
            disabled={!prompt.trim() || loading || convLoading || !conversationId}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Send"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.903 6.083H12a.75.75 0 0 1 0 1.5H4.182l-1.903 6.083a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.288Z" />
              </svg>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
