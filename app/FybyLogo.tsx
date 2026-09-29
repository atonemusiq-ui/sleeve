// The Fyby mark: a vinyl record whose center label is a play button.
// The outer rim is outlined in paper so the black disc still reads on the
// site's dark ink background. Pure SVG, no external asset.
export default function FybyLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="58" fill="#14121A" stroke="#E8E1D3" strokeOpacity="0.35" strokeWidth="3" />
      <circle cx="60" cy="60" r="47" stroke="#F6F1E7" strokeOpacity="0.18" strokeWidth="2" />
      <circle cx="60" cy="60" r="37" stroke="#F6F1E7" strokeOpacity="0.18" strokeWidth="2" />
      <path d="M 24 38 A 44 44 0 0 1 46 18" stroke="#F6F1E7" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="60" r="24" fill="#FF5A36" />
      <path d="M 54 49 L 70 60 L 54 71 Z" fill="#14121A" />
    </svg>
  );
}

// The "fyby" wordmark in orange, set in Unbounded to match the logo files.
export function FybyWordmark({ className = "text-3xl" }: { className?: string }) {
  return (
    <span className={`font-logo font-extrabold lowercase text-flame leading-none tracking-[-0.045em] ${className}`}>
      fyby
    </span>
  );
}
