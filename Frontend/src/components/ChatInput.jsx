import { useEffect, useRef, useState } from "react";

// ── Icons ─────────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.903 6.083H12a.75.75 0 0 1 0 1.5H4.182l-1.903 6.083a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.288Z" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path fillRule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501-.002.002a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 6.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.452a1.125 1.125 0 0 0 1.587 1.593l3.458-3.555a3 3 0 0 0-.005-4.24Z" clipRule="evenodd" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.94l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.94 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}

function PdfFileIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-red-400" aria-hidden="true">
      <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V7.875A1.875 1.875 0 0 0 18.375 6H15a2.25 2.25 0 0 1-2.25-2.25V1.5H5.625Z" />
      <path d="M14.25 1.5v3.75c0 .414.336.75.75.75h3.75L14.25 1.5Z" />
    </svg>
  );
}

function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── ChatInput ─────────────────────────────────────────────────────────────────

export default function ChatInput({
  prompt,
  onChange,
  onSend,
  loading,
  disabled,
  selectedFile,
  onFileChange,
  onRemoveFile,
  uploadError,
  onUploadError,
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Generate and clean up preview object URL
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  useEffect(() => {
    if (prompt === "" && textareaRef.current) {
      textareaRef.current.style.height = "24px";
    }
  }, [prompt]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea up to max
  const handleChange = (e) => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    }
    onChange(e.target.value);
  };

  const isPdf = Boolean(
    selectedFile &&
      (selectedFile.type === "application/pdf" ||
        selectedFile.name.toLowerCase().endsWith(".pdf"))
  );

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
    ];
    const fileIsPdf = file.name.toLowerCase().endsWith(".pdf");
    if (!validTypes.includes(file.type) && !fileIsPdf) {
      if (onUploadError) {
        onUploadError("Only image files (JPEG, PNG, WebP, GIF) and PDF documents are allowed.");
      }
      e.target.value = "";
      return;
    }

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      if (onUploadError) {
        onUploadError("File size exceeds 10MB limit.");
      }
      e.target.value = "";
      return;
    }

    if (onUploadError) onUploadError(null);
    if (onFileChange) onFileChange(file);
    e.target.value = "";
  };

  const handleSend = () => {
    if ((!prompt.trim() && !selectedFile) || loading || disabled) return;

    // Reset textarea to its compact height
    if (textareaRef.current) {
      textareaRef.current.style.height = "24px";
    }

    onSend();
  };

  const canSend = (prompt.trim().length > 0 || selectedFile) && !loading && !disabled;

  return (
    <div className="shrink-0 border-t border-slate-800 bg-slate-950 px-4 py-4">
      <div className="mx-auto max-w-3xl">
        {/* Upload error alert */}
        {uploadError && (
          <div className="mb-2 flex items-center justify-between rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-1.5 text-xs text-red-300">
            <span>{uploadError}</span>
            <button
              type="button"
              onClick={() => onUploadError && onUploadError(null)}
              className="ml-2 text-red-400 hover:text-red-200"
            >
              ✕
            </button>
          </div>
        )}

        {/* Selected file preview */}
        {selectedFile && (
          <div className="mb-2 flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/90 p-2">
            {isPdf ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-red-500/30 bg-red-950/40">
                <PdfFileIcon />
              </div>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="Attachment preview"
                className="h-12 w-12 rounded object-cover border border-slate-700 shrink-0"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-800">
                <PaperclipIcon />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {isPdf && (
                  <span className="rounded bg-red-500/20 px-1 py-0.5 text-[10px] font-semibold text-red-400 uppercase tracking-wider">
                    PDF
                  </span>
                )}
                <p className="truncate text-xs font-medium text-slate-200">{selectedFile.name}</p>
              </div>
              <p className="text-[11px] text-slate-400">{formatFileSize(selectedFile.size)}</p>
            </div>
            <button
              type="button"
              onClick={onRemoveFile}
              disabled={loading}
              title="Remove attachment"
              aria-label="Remove attachment"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-800 hover:text-red-400 focus:outline-none"
            >
              <CloseIcon />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 sm:gap-3 rounded-xl border border-slate-700 bg-slate-900 px-3 sm:px-4 py-3 transition focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            onChange={handleFileInputChange}
            className="hidden"
            aria-label="Upload file"
          />

          {/* Attachment button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || loading}
            title="Attach image or PDF"
            aria-label="Attach image or PDF"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <PaperclipIcon />
          </button>

          {/* Prompt textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={prompt}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled
                ? "Starting conversation…"
                : selectedFile
                ? isPdf
                  ? "Ask a question about this PDF… (Enter to send)"
                  : "Ask a question about this image… (Enter to send)"
                : "Message NexusMind… (Enter to send, Shift+Enter for newline)"
            }
            disabled={disabled || loading}
            aria-label="Chat input"
            className="flex-1 resize-none bg-transparent text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
            style={{ minHeight: "24px", maxHeight: "180px", overflowY: "auto" }}
          />

          {/* Send button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <SendIcon />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-center text-xs text-slate-600">
          NexusMind can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}
