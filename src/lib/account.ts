import { authFetch } from "./authFetch";

// Talks to /api/account and /api/profile for the signed-in user.

export type Invite = { code: string; used: boolean; paused: boolean };

export type AccountStatus = {
  deletionRequestedAt: string | null;
  deleteOn: string | null;
  aiConsent: boolean;
  consentVersion: string;
  invites: Invite[];
};

export type StyleProfile = {
  first_name: string | null;
  adult_confirmed: boolean;
  age_band: string | null;
  shops_for: string | null;
  weekdays: string[];
  weekends: string[];
  style_now: string[];
  style_toward: string[];
  style_icon: string | null;
  goals: string[];
  brand_tiers: string[];
  brands: string[];
  height_cm: number | null;
  fit_issues: string[];
  colors_love: string[];
  colors_avoid: string[];
  onboarding_completed_at: string | null;
};

export const EMPTY_PROFILE: StyleProfile = {
  first_name: null,
  adult_confirmed: false,
  age_band: null,
  shops_for: null,
  weekdays: [],
  weekends: [],
  style_now: [],
  style_toward: [],
  style_icon: null,
  goals: [],
  brand_tiers: [],
  brands: [],
  height_cm: null,
  fit_issues: [],
  colors_love: [],
  colors_avoid: [],
  onboarding_completed_at: null,
};

export class ApiError extends Error {
  status: number;
  code?: string;
  // Which field the server refused (e.g. "shoulder_cm"), when it says.
  field?: string;
  constructor(message: string, status: number, code?: string, field?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(path, init);
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    throw new ApiError(
      data.error || "Something went wrong — please try again.",
      res.status,
      data.code,
      typeof data.field === "string" ? data.field : undefined
    );
  }
  return data as T;
}

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const getAccount = () => call<AccountStatus>("/api/account");

export type Measurements = {
  weight_kg: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  inseam_cm: number | null;
  shoulder_cm: number | null;
  units: "imperial" | "metric";
};

export type ProfileResponse = {
  profile: StyleProfile | null;
  measurements: Measurements | null;
  bodyConsent: boolean;
  isAdmin: boolean;
};

export const getProfile = () => call<ProfileResponse>("/api/profile");

// Sensitive: saved only with the separate tick-box consent.
export const saveMeasurements = (measurements: Measurements) =>
  call<{ ok: true }>("/api/profile", post({ measurements, bodyConsent: true }));

// Withdraws the measurements consent and deletes the numbers.
export const deleteMeasurements = () => call<{ ok: true }>("/api/profile", post({ measurements: null }));

export const saveProfile = (answers: Partial<StyleProfile>, completed = false) =>
  call<{ ok: true }>("/api/profile", post({ answers, completed }));

// Answers (e.g. height) and measurements in ONE request, so the measurement
// history gets one entry for the whole Fit screen.
export const saveProfileAndMeasurements = (
  answers: Partial<StyleProfile>,
  measurements: Measurements,
  completed = false
) => call<{ ok: true }>("/api/profile", post({ answers, completed, measurements, bodyConsent: true }));

export const setConsent = (granted: boolean) =>
  call<{ ok: true }>("/api/account", post({ action: "consent", granted }));

export const requestDeletion = () =>
  call<{ ok: true; deletionRequestedAt: string; deleteOn: string }>(
    "/api/account",
    post({ action: "request_deletion" })
  );

export const cancelDeletion = () =>
  call<{ ok: true }>("/api/account", post({ action: "cancel_deletion" }));

// Public: create an account with an invite code (no login needed).
export async function redeemInvite(code: string, email: string, password: string): Promise<void> {
  const res = await fetch("/api/redeem-invite", post({ code, email, password }));
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    throw new ApiError(data.error || "Couldn't create your account — please try again.", res.status, data.code);
  }
}
