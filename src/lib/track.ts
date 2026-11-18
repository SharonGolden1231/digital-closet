import posthog from "posthog-js";

// Pilot analytics (PostHog). Off unless VITE_POSTHOG_KEY is set.
// Privacy rules for this file:
//  - no autocapture, no session recording, no page-leave capture: closet
//    photos and typed answers must never be sent;
//  - people are identified by their random user id only, never by email;
//  - event properties are counts, channels and step names only.

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://eu.i.posthog.com";

let started = false;

function start(): boolean {
  if (started) return true;
  if (!key) return false;
  posthog.init(key, {
    api_host: host,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_surveys: true,
    person_profiles: "identified_only",
    persistence: "localStorage",
    ip: false,
  } as any);
  // No location from IP: PostHog would otherwise store each person's city.
  posthog.register({ $geoip_disable: true });
  started = true;
  return true;
}

export type TrackEvent =
  | "session_start"
  | "onboarding_step"
  | "onboarding_done"
  | "consent_decision"
  | "item_saved"
  | "recommendation_opened"
  | "account_deletion_requested"
  | "account_deletion_cancelled"
  | "invite_shared"
  | "password_reset_requested"
  | "password_changed"
  | "access_requested"
  | "access_approved";

export function identify(userId: string) {
  if (!start()) return;
  posthog.identify(userId);
}

export function track(event: TrackEvent, props: Record<string, string | number | boolean> = {}) {
  if (!start()) return;
  try {
    posthog.capture(event, props);
  } catch {
    // Analytics must never break the app.
  }
}

export function resetTracking() {
  if (!started) return;
  try {
    posthog.reset();
  } catch {
    // ignore
  }
}
