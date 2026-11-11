import type { AgentSettings, Platform, Slide } from "./types";

const platformSet = new Set<Platform>(["Instagram", "TikTok"]);
const hex = /^#[0-9a-fA-F]{6}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const int = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : undefined;

export function parsePlatforms(value: unknown): Platform[] {
  return Array.isArray(value) ? [...new Set(value.filter((p): p is Platform => platformSet.has(p)))] : [];
}

export function parseSlides(value: unknown): Slide[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({ headline: str(s.headline, 90) ?? "", body: str(s.body, 260) ?? "" }))
    .filter((s) => s.headline || s.body)
    .slice(0, 10);
}

export function parseHashtags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((t): t is string => typeof t === "string").map((t) => t.replace(/^#/, "").replace(/\s+/g, "")).filter(Boolean).slice(0, 5);
}

/** Applies a partial, untrusted settings update onto the current settings. */
export function mergeSettings(current: AgentSettings, input: Record<string, unknown>): AgentSettings {
  const next = { ...current, theme: { ...current.theme } };
  if (typeof input.enabled === "boolean") next.enabled = input.enabled;
  if (typeof input.autoPublish === "boolean") next.autoPublish = input.autoPublish;
  next.brandName = str(input.brandName, 80) ?? next.brandName;
  next.handle = str(input.handle, 40) ?? next.handle;
  next.description = str(input.description, 3000) ?? next.description;
  next.audience = str(input.audience, 160) ?? next.audience;
  next.tone = str(input.tone, 100) ?? next.tone;
  if (Array.isArray(input.pillars)) next.pillars = input.pillars.map((p) => str(p, 80)).filter((p): p is string => !!p).slice(0, 12);
  if (Array.isArray(input.platforms)) next.platforms = parsePlatforms(input.platforms);
  next.carouselsPerWeek = int(input.carouselsPerWeek, 0, 14) ?? next.carouselsPerWeek;
  next.storiesPerDay = int(input.storiesPerDay, 0, 10) ?? next.storiesPerDay;
  if (Array.isArray(input.postingHours)) {
    next.postingHours = [...new Set(input.postingHours.map((h) => int(h, 0, 23)).filter((h): h is number => h !== undefined))].sort((a, b) => a - b);
  }
  next.timezoneOffsetMinutes = int(input.timezoneOffsetMinutes, -840, 840) ?? next.timezoneOffsetMinutes;
  if (input.theme && typeof input.theme === "object") {
    for (const key of ["background", "text", "accent"] as const) {
      const value = (input.theme as Record<string, unknown>)[key];
      if (typeof value === "string" && hex.test(value)) next.theme[key] = value;
    }
  }
  return next;
}
