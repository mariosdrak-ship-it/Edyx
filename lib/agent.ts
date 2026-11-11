import { generateContent } from "./generate";
import { instagramConfigured, publishToInstagram } from "./publishers/instagram";
import { publishToTikTok, tiktokConfigured } from "./publishers/tiktok";
import { getStore, logLine, newId, updateStore } from "./store";
import type { AgentSettings, Platform, Post, PostFormat } from "./types";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const PLAN_DAYS = 3;
const MAX_GENERATIONS_PER_RUN = 3;

export const dryRun = () => process.env.EDYX_DRY_RUN === "true";

export function slideImageUrls(post: Post) {
  const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
  return post.slides.map((_, index) => `${base}/api/render/${post.id}/${index}.jpg`);
}

/** Platforms a given format can be published to. */
export function platformsFor(format: PostFormat, platforms: Platform[]) {
  return format === "story" ? platforms.filter((p) => p === "Instagram") : platforms;
}

export function publishingStatus() {
  return {
    dryRun: dryRun(),
    publicBaseUrl: Boolean(process.env.PUBLIC_BASE_URL),
    instagram: instagramConfigured(),
    tiktok: tiktokConfigured(),
    openai: Boolean(process.env.OPENAI_API_KEY),
  };
}

async function publishTo(platform: Platform, post: Post, urls: string[]) {
  if (dryRun()) return { platform, ok: true, simulated: true, id: `dry-run-${Date.now()}` };
  if (!process.env.PUBLIC_BASE_URL) throw new Error("PUBLIC_BASE_URL is not set, so the platform can't fetch slide images.");
  if (platform === "Instagram") {
    if (!instagramConfigured()) throw new Error("Instagram is not connected (set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID).");
    return { platform, ok: true, id: await publishToInstagram(post, urls) };
  }
  if (!tiktokConfigured()) throw new Error("TikTok is not connected (set TIKTOK_ACCESS_TOKEN).");
  return { platform, ok: true, id: await publishToTikTok(post, urls) };
}

export async function publishPost(postId: string): Promise<Post> {
  const post = await updateStore((store) => {
    const found = store.posts.find((p) => p.id === postId);
    if (!found) throw new Error("Post not found.");
    if (found.status === "publishing" || found.status === "published") throw new Error(`Post is already ${found.status}.`);
    found.status = "publishing";
    return { ...found };
  });

  const urls = slideImageUrls(post);
  // Keep successes from earlier attempts so a retry doesn't double-post.
  const results = (post.results ?? []).filter((r) => r.ok);
  const targets = platformsFor(post.format, post.platforms).filter((p) => !results.some((r) => r.platform === p));
  for (const platform of targets) {
    try {
      results.push(await publishTo(platform, post, urls));
    } catch (error) {
      results.push({ platform, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return updateStore((store) => {
    const saved = store.posts.find((p) => p.id === postId);
    if (!saved) throw new Error("Post was deleted while publishing.");
    saved.results = results;
    const failures = results.filter((r) => !r.ok);
    if (results.length === 0) {
      saved.status = "failed";
      saved.error = "None of the selected platforms support this format.";
    } else if (failures.length) {
      saved.status = "failed";
      saved.error = failures.map((f) => `${f.platform}: ${f.error}`).join(" · ");
    } else {
      saved.status = "published";
      saved.publishedAt = new Date().toISOString();
      delete saved.error;
    }
    logLine(store, `${saved.status === "published" ? "Published" : "Failed to publish"} ${saved.format} “${saved.topic}”${dryRun() ? " (dry run)" : ""}${saved.error ? `: ${saved.error}` : ""}`);
    return { ...saved };
  });
}

type Slot = { format: PostFormat; at: Date };

/** Works out which carousel/story slots in the next few days still need content. */
export function plannedSlots(settings: AgentSettings, posts: Post[], now = new Date()): Slot[] {
  const offset = settings.timezoneOffsetMinutes * 60_000;
  const hours = [...new Set(settings.postingHours)].filter((h) => h >= 0 && h <= 23).sort((a, b) => a - b);
  if (!hours.length) return [];
  const today = Math.floor((now.getTime() + offset) / DAY);
  const active = posts.filter((p) => p.status !== "failed");
  const slots: Slot[] = [];

  for (let day = today; day < today + PLAN_DAYS; day++) {
    const cpw = Math.max(0, Math.min(14, settings.carouselsPerWeek));
    const carousels = Math.floor(((day + 1) * cpw) / 7) - Math.floor((day * cpw) / 7);
    const wanted: Record<PostFormat, number> = { carousel: carousels, story: Math.max(0, Math.min(10, settings.storiesPerDay)) };

    for (const format of ["carousel", "story"] as PostFormat[]) {
      const sameDay = active.filter((p) => p.format === format && Math.floor((Date.parse(p.scheduledFor) + offset) / DAY) === day);
      let missing = wanted[format] - sameDay.length;
      const used = new Set(sameDay.map((p) => new Date(Date.parse(p.scheduledFor) + offset).getUTCHours()));
      // Spread across posting hours; stories start from the opposite end so formats interleave.
      const order = format === "story" ? [...hours].reverse() : hours;
      for (const hour of order) {
        if (missing <= 0) break;
        const at = new Date(day * DAY + hour * HOUR - offset);
        if (at.getTime() <= now.getTime() + 5 * 60_000 || used.has(hour)) continue;
        slots.push({ format, at });
        used.add(hour);
        missing--;
      }
    }
  }
  return slots.sort((a, b) => a.at.getTime() - b.at.getTime());
}

const agentState = globalThis as typeof globalThis & { __edyxAgentRunning?: boolean };

/** One agent "tick": plan and create upcoming content, then publish anything that's due. */
export async function runAgent(now = new Date()) {
  if (agentState.__edyxAgentRunning) return { skipped: true, created: 0, published: 0, failed: 0 };
  agentState.__edyxAgentRunning = true;
  let created = 0;
  let published = 0;
  let failed = 0;
  try {
    const { settings, posts } = await getStore();

    if (settings.enabled && settings.platforms.length && settings.pillars.length) {
      const slots = plannedSlots(settings, posts, now).slice(0, MAX_GENERATIONS_PER_RUN);
      const recentTopics = posts.map((p) => p.topic);
      let pillarIndex = posts.filter((p) => p.createdBy === "agent").length;
      for (const slot of slots) {
        const pillar = settings.pillars[pillarIndex++ % settings.pillars.length];
        try {
          const content = await generateContent({ format: slot.format, settings, pillar, avoidTopics: recentTopics });
          recentTopics.push(content.topic);
          await updateStore((store) => {
            store.posts.push({
              id: newId(),
              format: slot.format,
              platforms: platformsFor(slot.format, settings.platforms),
              ...content,
              status: settings.autoPublish ? "scheduled" : "pending_approval",
              scheduledFor: slot.at.toISOString(),
              createdAt: new Date().toISOString(),
              createdBy: "agent",
            });
            logLine(store, `Agent created ${slot.format} “${content.topic}” for ${slot.at.toISOString()}`);
          });
          created++;
        } catch (error) {
          await updateStore((store) => logLine(store, `Agent could not create a ${slot.format}: ${error instanceof Error ? error.message : error}`));
          break;
        }
      }
    }

    const due = (await getStore()).posts.filter((p) => p.status === "scheduled" && Date.parse(p.scheduledFor) <= now.getTime());
    for (const post of due) {
      const result = await publishPost(post.id).catch(() => null);
      if (result?.status === "published") published++;
      else failed++;
    }

    await updateStore((store) => {
      store.settings.lastRunAt = new Date().toISOString();
    });
    return { skipped: false, created, published, failed };
  } finally {
    agentState.__edyxAgentRunning = false;
  }
}
