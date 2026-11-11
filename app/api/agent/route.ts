import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { getStore, logLine, updateStore } from "@/lib/store";
import { mergeSettings } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({ settings: (await getStore()).settings });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  const settings = await updateStore((store) => {
    const wasEnabled = store.settings.enabled;
    store.settings = mergeSettings(store.settings, body);
    if (wasEnabled !== store.settings.enabled) logLine(store, `Autopilot ${store.settings.enabled ? "turned on" : "paused"}`);
    return store.settings;
  });
  return NextResponse.json({ settings });
}

/** Run the agent now (plan upcoming content + publish anything due). */
export async function POST() {
  try {
    return NextResponse.json(await runAgent());
  } catch (error) {
    console.error("Agent run failed:", error);
    return NextResponse.json({ error: "Agent run failed." }, { status: 500 });
  }
}
