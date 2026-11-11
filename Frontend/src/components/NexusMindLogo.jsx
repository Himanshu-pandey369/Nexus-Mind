/**
 * Reusable NexusMind Brand Logo component
 * Renders the official interwoven N ribbon SVG icon.
 */
export default function NexusMindLogo({ className = "h-6 w-6", alt = "NexusMind" }) {
  return (
    <img
      src="/nexusmind-icon.svg"
      alt={alt}
      className={`shrink-0 object-contain select-none ${className}`}
      draggable="false"
    />
  );
}
