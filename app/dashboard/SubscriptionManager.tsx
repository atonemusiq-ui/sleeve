"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startPlanCheckout, cancelPlanSubscription } from "@/app/actions/plans";
import type { Plan } from "@/lib/plans";

type PlanRow = {
    key: Plan;
    label: string;
    priceCents: number;
    rateBps: number;
    breakEvenCents: number | null;
};

// The Subscription page's plan-selection grid (app/dashboard/subscription/
// page.tsx passes in the three plans from lib/plans.ts already merged with
// their breakeven figures). Upgrading posts straight to Stripe Checkout via
// startPlanCheckout; the plan itself only actually changes once the
// dedicated webhook (app/api/webhooks/stripe-subscriptions/route.ts)
// confirms the subscription, not when this form submits.
export default function SubscriptionManager({
    currentPlan,
    plans,
    hasActiveSubscription,
}: {
    currentPlan: Plan;
    plans: PlanRow[];
    hasActiveSubscription: boolean;
}) {
    const [canceling, setCanceling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

  async function handleCancel() {
        const confirmed = window.confirm(
                "Cancel your paid plan? You'll keep your current rate until the period ends, then move to Free."
              );
        if (!confirmed) return;

      setCanceling(true);
        setError(null);
        const result = await cancelPlanSubscription();
        setCanceling(false);

      if (result.error) {
              setError(result.error);
              return;
      }
        router.refresh();
  }

  return (
        <div className="flex flex-col gap-6">
          {error && <p className="text-rust font-mono text-sm">{error}</p>}
        
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {plans.map((plan) => {
                    const isCurrent = plan.key === currentPlan;
          
                    return (
                                  <div
                                                  key={plan.key}
                                                  className={`border rounded-lg p-5 flex flex-col gap-3 ${
                                                                    isCurrent ? "border-gold bg-gold/5" : "border-paper/15 bg-paper/5"
                                                  }`}
                                                >
                                                <div>
                                                                <span className="font-display text-xl block">{plan.label}</span>
                                                                <span className="font-mono text-forest text-lg">
                                                                  {plan.priceCents === 0 ? "Free" : `$${(plan.priceCents / 100).toFixed(0)}/mo`}
                                                                </span>
                                                </div>
                                  
                                                <p className="font-mono text-xs text-paper/60">
                                                  {(plan.rateBps / 100).toFixed(0)}% commission on every sale
                                                </p>
                                  
                                    {plan.breakEvenCents !== null && (
                                                                  <p className="font-mono text-xs text-paper/40">
                                                                                    Pays for itself at ${(plan.breakEvenCents / 100).toFixed(0)}/mo in sales
                                                                  </p>
                                                )}
                                  
                                    {isCurrent && (
                                                                  <span className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold text-center">
                                                                                    Current plan
                                                                  </span>
                                                )}
                                  
                                    {!isCurrent && plan.key === "free" && hasActiveSubscription && (
                                                                  <button
                                                                                      type="button"
                                                                                      onClick={handleCancel}
                                                                                      disabled={canceling}
                                                                                      className="font-mono text-xs px-3 py-1.5 rounded border border-rust/40 text-rust hover:bg-rust/10 disabled:opacity-50"
                                                                                    >
                                                                    {canceling ? "Canceling..." : "Cancel plan"}
                                                                  </button>
                                                )}
                                  
                                    {!isCurrent && plan.key !== "free" && (
                                                                  <form action={startPlanCheckout}>
                                                                                    <input type="hidden" name="plan" value={plan.key} />
                                                                                    <button
                                                                                                          type="submit"
                                                                                                          className="w-full font-mono text-xs px-3 py-1.5 rounded bg-gold text-ink font-medium hover:opacity-90"
                                                                                                        >
                                                                                                        Upgrade to {plan.label}
                                                                                      </button>
                                                                  </form>
                                                )}
                                  </div>
                                );
        })}
              </div>
        </div>
      );
}
