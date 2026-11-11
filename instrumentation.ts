/**
 * Built-in scheduler: when Edyx runs as a long-lived server (`npm start`, Docker, a VPS),
 * the agent wakes up every few minutes on its own. On serverless hosts such as Vercel,
 * use the cron in vercel.json instead (it calls /api/cron).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
