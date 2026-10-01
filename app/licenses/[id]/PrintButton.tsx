"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10"
    >
      Print / save as PDF
    </button>
  );
}
