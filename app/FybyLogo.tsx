// A small hand-drawn mark rather than plain text — a ticket-stub silhouette
// (echoing the dashed perforation already used by .ticket-divider in
// globals.css) with a play triangle standing in for the "note," tying the
// wordmark to the concert-ticket/receipt visual language used elsewhere on
// the site (see app/ReceiptAnimation.tsx). Pure SVG, no external asset, so
// it scales cleanly and needs no image request.
export default function FybyLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="36" height="36" rx="9" stroke="#C9A227" strokeWidth="2" />
      <line
        x1="15"
        y1="5"
        x2="15"
        y2="35"
        stroke="#C9A227"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        opacity="0.8"
      />
      <path d="M23 13.5 L23 26.5 L32 20 Z" fill="#C9A227" />
    </svg>
  );
}
