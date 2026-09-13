import type { ReactNode } from "react";

// A native <details>/<summary> disclosure panel — no client JS required, so
// it works fine wrapped around either a server component (most dashboard
// panels, the public artist page) or a client one (AlbumManager). Shared
// between the Artist Studio dashboard and the public artist page so both
// can collapse sections a visitor isn't actively using instead of piling up
// a wall of always-expanded boxes.
// `open` (not React's `defaultOpen`, which doesn't apply to <details>) sets
// only the *initial* state — with no onToggle handler this stays fully
// uncontrolled afterward, so a click just toggles it like any native
// disclosure and React never fights the user's click.
export default function CollapsibleSection({
  title,
  badge,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: ReactNode;
  description?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group border border-paper/15 rounded-lg mb-6">
      <summary className="flex items-center justify-between gap-4 px-6 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden">
        <span className="flex items-center gap-3 min-w-0">
          <span className="font-display text-lg truncate">{title}</span>
          {badge}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4 text-paper/40 flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="px-6 pb-6 pt-4 border-t border-paper/10 flex flex-col gap-3">
        {description && <p className="font-mono text-xs text-paper/60">{description}</p>}
        {children}
      </div>
    </details>
  );
}
