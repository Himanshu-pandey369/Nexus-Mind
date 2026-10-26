// MessageBubble — renders a single user or assistant message.
// The backend Message schema: { _id, conversationId, role, content, createdAt, updatedAt }
// Local optimistic messages: { role, content } (no _id or timestamp yet).

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

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const time = formatTime(message.createdAt);

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`group max-w-[85%] space-y-1 ${isUser ? "items-end" : "items-start"} flex flex-col`}
      >
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? "bg-indigo-600 text-white rounded-br-sm"
              : "bg-slate-800 text-slate-100 rounded-bl-sm"
          }`}
        >
          {message.content}
        </div>
        {time && (
          <span className="px-1 text-xs text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">
            {time}
          </span>
        )}
      </div>
    </div>
  );
}
