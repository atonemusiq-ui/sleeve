"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Stripe confirms the payment a moment before Fyby's webhook finishes saving
// the purchase, so a buyer can land in their Library a second or two early.
// Refresh quietly until the new song shows up (up to about 30 seconds).
export default function WaitForPurchase() {
  const router = useRouter();
  useEffect(() => {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (tries > 15) {
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, 2000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
