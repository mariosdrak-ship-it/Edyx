import { runAgent } from "./agent";

export function startScheduler() {
  if (process.env.VERCEL || process.env.EDYX_SCHEDULER === "off") return;
  const state = globalThis as typeof globalThis & { __edyxScheduler?: NodeJS.Timeout };
  if (state.__edyxScheduler) return;

  const minutes = Math.max(1, Number(process.env.EDYX_SCHEDULER_MINUTES) || 5);
  const tick = () =>
    runAgent()
      .then((r) => { if (r.created || r.published || r.failed) console.log("[edyx agent]", JSON.stringify(r)); })
      .catch((error) => console.error("[edyx agent] run failed:", error));
  state.__edyxScheduler = setInterval(tick, minutes * 60_000);
  setTimeout(tick, 10_000);
  console.log(`[edyx agent] scheduler running every ${minutes} min`);
}
