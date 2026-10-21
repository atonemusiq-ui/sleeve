"use client";

import { useState, useTransition } from "react";
import { cancelVendorPlan } from "@/app/actions/vendors";

export default function CancelVendorPlanButton() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (message) return <span className="font-mono text-[11px] text-paper/60 max-w-[16rem] text-right">{message}</span>;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Cancel Vendor Pro? You stay live until the end of this billing month, then your page comes down.")) return;
        start(async () => {
          const result = await cancelVendorPlan();
          setMessage(result.error ?? "Canceled. You stay live until the end of this billing month.");
        });
      }}
      className="font-mono text-[11px] text-paper/50 hover:text-rust disabled:opacity-50"
    >
      Cancel plan
    </button>
  );
}
