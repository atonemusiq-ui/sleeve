import { headers } from "next/headers";
import {
  ADMIN_HEADER,
  PHASE_HEADER,
  isFeatureOn,
  livePhase,
  parsePhase,
  type Feature,
  type Phase,
} from "@/lib/phases";

// The phase this request sees, as decided by middleware.ts (live phase, or
// the admin's investor-demo preview). Falls back to the live phase if the
// header is missing (a route outside the middleware matcher).
export function currentPhase(): Phase {
  return parsePhase(headers().get(PHASE_HEADER)) ?? livePhase();
}

export function isAdminRequest(): boolean {
  return headers().get(ADMIN_HEADER) === "1";
}

export function featureOn(feature: Feature): boolean {
  return isFeatureOn(feature, currentPhase());
}

// Every feature's on/off state for this request, for handing to client
// components as a plain object.
export function featureMap(): Record<Feature, boolean> {
  const phase = currentPhase();
  return {
    verified: isFeatureOn("verified", phase),
    radio: isFeatureOn("radio", phase),
    tv: isFeatureOn("tv", phase),
    aiMusic: isFeatureOn("aiMusic", phase),
    merch: isFeatureOn("merch", phase),
    connect: isFeatureOn("connect", phase),
    ads: isFeatureOn("ads", phase),
    interests: isFeatureOn("interests", phase),
  };
}
