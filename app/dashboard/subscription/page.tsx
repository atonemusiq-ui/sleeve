import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import SubscriptionManager from "../SubscriptionManager";
import { PLANS, planOf, breakEvenCentsPerMonth, type Plan } from "@/lib/plans";

// Where an artist sees their current plan and Fyby's commission on each
// sale, and can upgrade to Artist/Pro or cancel back to Free. Split out as
// its own page rather than a dashboard section, same reasoning as
// dashboard/catalog and dashboard/library -- billing deserves its own
// focused page rather than one more collapsible section.
export default async function SubscriptionPage() {
  const supabase = createClient();

    const {
        data: { user },
          } = await supabase.auth.getUser();

            if (!user) {
                redirect("/login");
                  }

                    const { data: profile } = await supabase
                        .from("profiles")
                            .select("role")
                                .eq("id", user.id)
                                    .single();

                                      if (profile?.role !== "artist") {
                                          redirect("/");
                                            }

                                              const { data: artist } = await supabase
                                                  .from("artists")
                                                      .select("plan, plan_subscription_id")
                                                          .eq("user_id", user.id)
                                                              .single();

                                                                const currentPlan = planOf((artist as any)?.plan);

                                                                  const plans = (Object.keys(PLANS) as Plan[]).map((key) => ({
                                                                      key,
                                                                          label: PLANS[key].label,
                                                                              priceCents: PLANS[key].priceCents,
                                                                                  rateBps: PLANS[key].rateBps,
                                                                                      breakEvenCents: breakEvenCentsPerMonth(key),
                                                                                        }));

                                                                                          return (
                                                                                              <main className="max-w-5xl mx-auto px-6 py-12">
                                                                                                    <header className="mb-12">
                                                                                                            <Link href="/dashboard" className="font-mono text-xs text-paper/50 hover:text-gold">
                                                                                                                      &larr; Dashboard
                                                                                                                              </Link>
                                                                                                                              
                                                                                                                                      <h1 className="font-display text-3xl text-gold mt-2">Subscription</h1>
                                                                                                                                      
                                                                                                                                              <p className="font-mono text-xs text-paper/50 mt-2">
                                                                                                                                                        A plan buys down Fyby&apos;s commission on every sale -- it doesn&apos;t add features on top of it.
                                                                                                                                                                </p>
                                                                                                                                                                      </header>
                                                                                                                                                                      
                                                                                                                                                                            <div className="ticket-divider mb-10" />
                                                                                                                                                                            
                                                                                                                                                                                  <SubscriptionManager
                                                                                                                                                                                          currentPlan={currentPlan}
                                                                                                                                                                                                  plans={plans}
                                                                                                                                                                                                          hasActiveSubscription={Boolean((artist as any)?.plan_subscription_id)}
                                                                                                                                                                                                                />
                                                                                                                                                                                                                    </main>
                                                                                                                                                                                                                      );
                                                                                                                                                                                                                      }
