import { useEffect, useState } from "react";

const STATUSES = [
  "Thinking...",
  "Analyzing...",
  "Reasoning...",
  "Generating...",
];

function SparkleIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4 text-indigo-400"
      aria-hidden="true"
    >
      <path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684ZM13.949 13.684a1 1 0 0 0-1.898 0l-.184.551a1 1 0 0 1-.632.633l-.551.183a1 1 0 0 0 0 1.898l.551.183a1 1 0 0 1 .633.633l.183.551a1 1 0 0 0 1.898 0l.184-.551a1 1 0 0 1 .632-.633l.551-.183a1 1 0 0 0 0-1.898l-.551-.184a1 1 0 0 1-.633-.632l-.183-.551Z" />
    </svg>
  );
}

export default function LoadingIndicator({ currentStatus }) {
  const [statusIndex, setStatusIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (currentStatus) return;

    const interval = setInterval(() => {
      setFade(false);
      const timer = setTimeout(() => {
        setStatusIndex((prev) => (prev + 1) % STATUSES.length);
        setFade(true);
      }, 180);
      return () => clearTimeout(timer);
    }, 2200);

    return () => clearInterval(interval);
  }, [currentStatus]);

  const displayStatus = currentStatus || STATUSES[statusIndex];

  return (
    <div
      className="flex w-full justify-start"
      role="status"
      aria-live="polite"
      aria-label="AI response is loading"
    >
      <div className="group max-w-[85%] space-y-1 items-start flex flex-col">
        <div className="min-w-0 max-w-full overflow-hidden rounded-2xl rounded-bl-sm bg-slate-800/60 border border-slate-700/50 px-4 py-3 text-sm text-slate-100 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {/* Pulsing AI badge */}
            <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 border border-indigo-500/30">
              <SparkleIcon />
              <span
                className="absolute inset-0 rounded-lg animate-ping bg-indigo-400/20"
                style={{ animationDuration: "2s" }}
              />
            </div>

            {/* Rotating status text & typing dots */}
            <div className="flex flex-col gap-1 min-w-[130px]">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium tracking-wide text-indigo-300 transition-opacity duration-200 select-none ${
                    fade ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {displayStatus}
                </span>

                {/* Animated typing dots / wave */}
                <span className="flex items-center gap-1" aria-hidden="true">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" />
                </span>
              </div>

              {/* Shimmer pulse wave bar */}
              <div className="h-1 w-28 overflow-hidden rounded-full bg-slate-700/50">
                <div className="h-full w-full rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-indigo-500 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
