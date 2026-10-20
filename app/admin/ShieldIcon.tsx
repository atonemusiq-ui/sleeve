export default function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M10 2.5 16 5v4.5c0 3.8-2.6 6.6-6 8-3.4-1.4-6-4.2-6-8V5l6-2.5Z" strokeLinejoin="round" />
      <path d="m7.3 10 1.9 1.9 3.6-3.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
