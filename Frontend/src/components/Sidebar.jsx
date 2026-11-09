import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { clearUser } from "../redux/userSlice";
import { fetchCreditBalance } from "../redux/creditsSlice";
import api from "../../utils/axios";
import CreditModal from "./CreditModal";
import getUserPlan from "../utils/userPlan";

// ── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path fillRule="evenodd" d="M2 10c0-3.967 3.69-7 8-7 4.31 0 8 3.033 8 7s-3.69 7-8 7a9.165 9.165 0 0 1-2.63-.381l-3.276 1.092A.75.75 0 0 1 3 16.693V14.5A6.997 6.997 0 0 1 2 10Z" clipRule="evenodd" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-1.07a.75.75 0 1 0-1.08-1.04l-2.25 2.333a.75.75 0 0 0 0 1.04l2.25 2.333a.75.75 0 1 0 1.08-1.04L8.704 10.75H18.25A.75.75 0 0 0 19 10Z" clipRule="evenodd" />
    </svg>
  );
}

// ── Sidebar Component ─────────────────────────────────────────────────────────

export default function Sidebar({
  activeConversationId,
  onSelectConversation,
  onNewChat,
  refreshTrigger,
  onClose,
}) {
  const dispatch = useDispatch();
  const { userData } = useSelector((state) => state.user);
  const { balance } = useSelector((state) => state.credits);
  const userPlan = getUserPlan(userData);

  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(false);
  const [convError, setConvError] = useState(null);
  const [creditModalOpen, setCreditModalOpen] = useState(false);

  // Fetch credits on mount
  useEffect(() => {
    dispatch(fetchCreditBalance());
  }, [dispatch]);

  // Fetch conversation list whenever refreshTrigger changes
  useEffect(() => {
    let cancelled = false;

    const fetchConversations = async () => {
      setConvLoading(true);
      setConvError(null);
      try {
        const res = await api.get("/chat/conversations");
        if (cancelled) return;

        const rawList = res.data.conversations || [];

        // Deduplicate raw conversations by _id
        const uniqueMap = new Map();
        for (const conv of rawList) {
          if (conv && conv._id && !uniqueMap.has(conv._id)) {
            uniqueMap.set(conv._id, conv);
          }
        }
        const uniqueConvs = Array.from(uniqueMap.values());

        // Verify that each conversation has at least one actual user message
        const verified = await Promise.all(
          uniqueConvs.map(async (conv) => {
            try {
              const msgRes = await api.get(`/chat/conversations/${conv._id}/messages`);
              const msgs = msgRes.data?.messages || [];
              const hasUserMsg = msgs.some((m) => m.role === "user");
              if (!hasUserMsg) {
                return null;
              }
              // If title is missing or default, derive from first user message
              let title = conv.title;
              if (!title || title === "New Conversation") {
                const firstUser = msgs.find((m) => m.role === "user");
                if (firstUser?.content) {
                  title =
                    firstUser.content.slice(0, 60) +
                    (firstUser.content.length > 60 ? "…" : "");
                }
              }
              return {
                ...conv,
                title: title || conv.title || "New Conversation",
              };
            } catch {
              return null;
            }
          })
        );

        if (!cancelled) {
          // Final deduplication before updating state
          const finalMap = new Map();
          for (const conv of verified.filter(Boolean)) {
            if (conv && conv._id && !finalMap.has(conv._id)) {
              finalMap.set(conv._id, conv);
            }
          }
          setConversations(Array.from(finalMap.values()));
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch conversations:", err.message);
          setConvError("Could not load conversations.");
        }
      } finally {
        if (!cancelled) {
          setConvLoading(false);
        }
      }
    };

    fetchConversations();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error("Logout failed:", err.message);
    } finally {
      dispatch(clearUser());
    }
  };

  return (
    <aside className="flex h-full w-full flex-col bg-slate-950 border-r border-slate-800">
      {/* ── Brand header ── */}
      <div className="flex items-center gap-3 px-4 py-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm font-bold text-white select-none">
          N
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-base font-semibold tracking-tight text-slate-100">
            NexusMind
          </span>
          <span className="text-[10px] text-indigo-400 font-medium">
            {userPlan} Plan
          </span>
        </div>
        {/* Close button — only visible on mobile when sidebar is open as drawer */}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 lg:hidden"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        )}
      </div>

      {/* ── New Chat button ── */}
      <div className="px-3 pb-3 shrink-0">
        <button
          onClick={onNewChat}
          className="flex w-full items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <PlusIcon />
          New Chat
        </button>
      </div>

      <div className="mx-3 mb-3 border-t border-slate-800 shrink-0" />

      {/* ── Conversation list ── */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5 min-h-0">
        <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Recent
        </p>

        {convLoading && (
          <div className="flex items-center justify-center py-8">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        )}

        {convError && !convLoading && (
          <p className="px-2 py-3 text-xs text-red-400">{convError}</p>
        )}

        {!convLoading && !convError && conversations.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-slate-500">
            No conversations yet.
            <br />
            Start a new chat!
          </p>
        )}

        {conversations.map((conv) => {
          const isActive = conv._id === activeConversationId;
          return (
            <button
              key={conv._id}
              onClick={() => onSelectConversation(conv._id, conv.title)}
              title={conv.title}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 ${
                isActive
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                  : "text-slate-300 hover:bg-slate-800 border border-transparent"
              }`}
            >
              <ChatBubbleIcon />
              <span className="truncate">{conv.title || "New Conversation"}</span>
            </button>
          );
        })}
      </div>

      {/* ── User profile footer & Credits ── */}
      <div className="shrink-0 border-t border-slate-800 p-3 space-y-2">
        {/* Credits pill button */}
        <button
          type="button"
          onClick={() => setCreditModalOpen(true)}
          className="flex w-full items-center justify-between rounded-lg border border-indigo-500/30 bg-indigo-950/40 px-2.5 py-1.5 text-xs text-indigo-300 transition hover:bg-indigo-900/50 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <span className="text-amber-400">⚡</span>
            <span>
              {typeof balance === "number"
                ? `${balance.toLocaleString()} credits`
                : "Loading credits..."}
            </span>
          </span>
          <span className="text-[10px] uppercase font-semibold text-indigo-400 hover:text-indigo-200">
            Buy / Details →
          </span>
        </button>

        <div className="flex items-center gap-3">
          {userData?.photoURL ? (
            <img
              src={userData.photoURL}
              alt={userData.name || "avatar"}
              className="h-8 w-8 rounded-full shrink-0 ring-1 ring-slate-700"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
              {(userData?.name || userData?.email || "U")[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-xs font-medium text-slate-200">
                {userData?.name || "User"}
              </p>
              <span className="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[9px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                {userPlan}
              </span>
            </div>
            <p className="truncate text-xs text-slate-500">
              {userData?.email || ""}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Sign out"
          >
            <SignOutIcon />
          </button>
        </div>
      </div>

      <CreditModal
        isOpen={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
      />
    </aside>
  );
}
