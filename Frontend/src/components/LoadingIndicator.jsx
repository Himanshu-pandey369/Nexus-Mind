import { useEffect, useState } from "react";
import NexusMindLogo from "./NexusMindLogo";

const STATUSES = [
  "Thinking...",
  "Analyzing...",
  "Reasoning...",
  "Generating...",
];

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
        <div className="min-w-0 max-w-full overflow-hidden rounded-2xl rounded-bl-sm bg-nm-secondary border border-nm-border px-4 py-3 text-sm text-nm-text shadow-sm">
          <div className="flex items-center gap-3">
            {/* Pulsing AI badge */}
            <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold-surface border border-gold/40 p-1">
              <NexusMindLogo className="h-full w-full" />
              <span
                className="absolute inset-0 rounded-lg animate-ping bg-gold/20"
                style={{ animationDuration: "2s" }}
              />
            </div>

            {/* Rotating status text & typing dots */}
            <div className="flex flex-col gap-1 min-w-[130px]">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium tracking-wide text-gold transition-opacity duration-200 select-none ${
                    fade ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {displayStatus}
                </span>

                {/* Animated typing dots / wave */}
                <span className="flex items-center gap-1" aria-hidden="true">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-gold animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-gold animate-bounce" />
                </span>
              </div>

              {/* Shimmer pulse wave bar */}
              <div className="h-1 w-28 overflow-hidden rounded-full bg-nm-border-subtle">
                <div className="h-full w-full rounded-full bg-gradient-to-r from-gold-muted via-gold-light to-gold animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
