"use client";

import { useState } from "react";

// A datetime-local picker has no time zone, and the server runs on UTC, so
// the artist's local time is converted to an exact ISO timestamp here in
// the browser and submitted in a hidden field.
export default function StartTimeInput({ name, className }: { name: string; className?: string }) {
  const [iso, setIso] = useState("");
  return (
    <>
      <input
        type="datetime-local"
        className={className}
        onChange={(e) => {
          const d = e.target.value ? new Date(e.target.value) : null;
          setIso(d && !Number.isNaN(d.getTime()) ? d.toISOString() : "");
        }}
      />
      <input type="hidden" name={name} value={iso} />
    </>
  );
}
