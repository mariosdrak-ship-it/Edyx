import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Called on a schedule (Vercel Cron, system cron, or `npm run agent`). Requires CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Set CRON_SECRET to enable scheduled runs." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runAgent());
  } catch (error) {
    console.error("Scheduled agent run failed:", error);
    return NextResponse.json({ error: "Agent run failed." }, { status: 500 });
  }
}
