// MessageBubble — renders a single user or assistant message.
// The backend Message schema: { _id, conversationId, role, content, images, createdAt, updatedAt }
// Local optimistic messages: { role, content, images } (no _id or timestamp yet).

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
  const images = Array.isArray(message.images) ? message.images : [];

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

          {/* Render search result images if present */}
          {!isUser && images.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {images.map((imgUrl, idx) => (
                <a
                  key={`${imgUrl}-${idx}`}
                  href={imgUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/img relative block aspect-video overflow-hidden rounded-lg border border-slate-700 bg-slate-900 transition hover:border-indigo-500"
                  title="Click to view full image"
                >
                  <img
                    src={imgUrl}
                    alt={`Search result ${idx + 1}`}
                    loading="lazy"
                    onError={(e) => {
                      // Hide failed image container gracefully without breaking text
                      const container = e.currentTarget.parentElement;
                      if (container) container.style.display = "none";
                    }}
                    className="h-full w-full object-cover transition duration-200 group-hover/img:scale-105"
                  />
                </a>
              ))}
            </div>
          )}
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
