import { NextResponse } from "next/server";
import { platformsFor, publishingStatus } from "@/lib/agent";
import { ConfigError, generateContent } from "@/lib/generate";
import { getStore, logLine, newId, updateStore } from "@/lib/store";
import type { PostFormat } from "@/lib/types";
import { parsePlatforms } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { posts, log, settings } = await getStore();
  const sorted = [...posts].sort((a, b) => Date.parse(b.scheduledFor) - Date.parse(a.scheduledFor));
  return NextResponse.json({ posts: sorted, log: log.slice(-40).reverse(), settings, status: publishingStatus() });
}

/** Create a carousel or story from a topic. It lands in the queue awaiting approval. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });

  const format: PostFormat = body.format === "story" ? "story" : "carousel";
  const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 1000) : "";
  const platforms = platformsFor(format, parsePlatforms(body.platforms));
  const scheduledFor = typeof body.scheduledFor === "string" && !Number.isNaN(Date.parse(body.scheduledFor))
    ? new Date(body.scheduledFor).toISOString()
    : new Date(Date.now() + 3_600_000).toISOString();

  if (!topic) return NextResponse.json({ error: "Tell Edyx what the post should be about." }, { status: 400 });
  if (!platforms.length) {
    return NextResponse.json({ error: format === "story" ? "Stories can only be posted to Instagram — select Instagram." : "Select at least one platform." }, { status: 400 });
  }

  try {
    const { settings } = await getStore();
    const content = await generateContent({ format, settings, topic });
    const post = await updateStore((store) => {
      const created = {
        id: newId(),
        format,
        platforms,
        ...content,
        status: "pending_approval" as const,
        scheduledFor,
        createdAt: new Date().toISOString(),
        createdBy: "user" as const,
      };
      store.posts.push(created);
      logLine(store, `You created ${format} “${content.topic}”`);
      return created;
    });
    return NextResponse.json({ post });
  } catch (error) {
    console.error("Post generation failed:", error);
    const message = error instanceof ConfigError ? error.message : "Content generation failed. Check your API configuration and try again.";
    return NextResponse.json({ error: message }, { status: error instanceof ConfigError ? 503 : 502 });
  }
}
