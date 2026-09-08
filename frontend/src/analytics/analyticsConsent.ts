export type AnalyticsConsentValue = "accepted" | "declined";

export const ANALYTICS_CONSENT_KEY = "grant_support_analytics_consent";
export const OPEN_ANALYTICS_SETTINGS_EVENT = "analytics:open-settings";

export function getAnalyticsConsent(): AnalyticsConsentValue | null {
  if (typeof window === "undefined") return null;

  const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
  return value === "accepted" || value === "declined" ? value : null;
}

export function setAnalyticsConsent(value: AnalyticsConsentValue): void {
  window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
}

export function openAnalyticsSettings(): void {
  window.dispatchEvent(new Event(OPEN_ANALYTICS_SETTINGS_EVENT));
}
