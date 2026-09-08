import { getAnalyticsConsent } from "./analyticsConsent";

type YandexMetrikaFunction = (
  counterId: number,
  method: string,
  ...args: unknown[]
) => unknown;

type QueuedYandexMetrikaFunction = YandexMetrikaFunction & {
  a?: unknown[][];
  l?: number;
};

declare global {
  interface Window {
    ym?: QueuedYandexMetrikaFunction;
  }
}

const SCRIPT_ID = "yandex-metrika-tag";
const FIRST_PARTY_METRIKA_COOKIES = [
  "_ym_debug",
  "_ym_d",
  "_ym_hostIndex",
  "_ym_isad",
  "_ym_uid",
  "_ym_visorc",
];
const SENSITIVE_QUERY_PARAMS = new Set([
  "access",
  "code",
  "email",
  "refresh",
  "token",
  "uid",
]);

let initialized = false;
let lastTrackedUrl: string | null = null;

function getCounterId(): number | null {
  const rawCounterId = import.meta.env.VITE_YANDEX_METRIKA_ID?.trim();
  if (!rawCounterId) return null;

  const counterId = Number(rawCounterId);
  return Number.isSafeInteger(counterId) && counterId > 0 ? counterId : null;
}

function ensureYandexMetrikaQueue(): QueuedYandexMetrikaFunction {
  if (window.ym) return window.ym;

  const queuedYm = ((...args: unknown[]) => {
    (queuedYm.a ??= []).push(args);
  }) as QueuedYandexMetrikaFunction;
  queuedYm.l = Date.now();
  window.ym = queuedYm;
  return queuedYm;
}

function getAnonymousLocationHref(): string {
  const locationHref = window.location.href;
  const url = new URL(locationHref);
  let containsSensitiveData = false;

  for (const key of [...url.searchParams.keys()]) {
    if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
      containsSensitiveData = true;
      url.searchParams.delete(key);
    }
  }

  return containsSensitiveData ? url.href : locationHref;
}

export function initYandexMetrika(): void {
  if (
    initialized
    || typeof window === "undefined"
    || getAnalyticsConsent() !== "accepted"
  ) return;

  const counterId = getCounterId();
  if (counterId === null) return;

  initialized = true;
  const ym = ensureYandexMetrikaQueue();

  if (!document.getElementById(SCRIPT_ID)) {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://mc.yandex.ru/metrika/tag.js";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  ym(counterId, "init", {
    accurateTrackBounce: true,
    clickmap: true,
    defer: true,
    trackLinks: true,
  });
}

export function trackYandexMetrikaPageView(): void {
  if (typeof window === "undefined" || getAnalyticsConsent() !== "accepted") return;

  const counterId = getCounterId();
  if (counterId === null) return;

  initYandexMetrika();
  const url = getAnonymousLocationHref();
  if (url === lastTrackedUrl) return;

  window.ym?.(counterId, "hit", url);
  lastTrackedUrl = url;
}

export function reachYandexMetrikaGoal(goalName: string): boolean {
  const counterId = getCounterId();
  const normalizedGoalName = goalName.trim();
  if (
    counterId === null
    || !normalizedGoalName
    || typeof window === "undefined"
    || getAnalyticsConsent() !== "accepted"
  ) {
    return false;
  }

  initYandexMetrika();
  window.ym?.(counterId, "reachGoal", normalizedGoalName);
  return true;
}

function removeFirstPartyMetrikaCookies(): void {
  const hostname = window.location.hostname;
  const hostnameParts = hostname.split(".");
  const isIpAddress = /^\d+(\.\d+){3}$/.test(hostname);
  const domainAttributes = [""];
  if (hostname && hostname !== "localhost" && !isIpAddress) {
    for (let index = 0; index < hostnameParts.length - 1; index += 1) {
      domainAttributes.push(`; domain=.${hostnameParts.slice(index).join(".")}`);
    }
  }

  const visibleMetrikaCookies = document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter((name) => name.startsWith("_ym_"));
  const cookieNames = new Set([
    ...FIRST_PARTY_METRIKA_COOKIES,
    ...visibleMetrikaCookies,
  ]);

  for (const name of cookieNames) {
    for (const domainAttribute of domainAttributes) {
      document.cookie = `${name}=; Max-Age=0; path=/${domainAttribute}; SameSite=Lax`;
    }
  }
}

function removeMetrikaStorageKeys(): void {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keysToRemove = Array.from(
      { length: storage.length },
      (_, index) => storage.key(index),
    ).filter((key): key is string => Boolean(key?.startsWith("_ym")));

    keysToRemove.forEach((key) => storage.removeItem(key));
  }
}

export function disableYandexMetrika(): void {
  if (typeof window === "undefined") return;

  const counterId = getCounterId();
  if (initialized && counterId !== null) {
    window.ym?.(counterId, "destruct");
  }

  document.getElementById(SCRIPT_ID)?.remove();
  document
    .querySelectorAll<HTMLScriptElement>('script[src*="mc.yandex.ru/metrika/"]')
    .forEach((script) => script.remove());
  delete window.ym;
  initialized = false;
  lastTrackedUrl = null;
  removeFirstPartyMetrikaCookies();
  removeMetrikaStorageKeys();
}
