import { NextResponse } from "next/server";
import { logLine, updateStore } from "@/lib/store";
import { parseHashtags, parseSlides } from "@/lib/validate";

export const runtime = "nodejs";

type Params = { params: { id: string } };

/** Edit a post, approve it (status "scheduled") or move it back to "pending_approval". */
export async function PATCH(request: Request, { params }: Params) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  try {
    const post = await updateStore((store) => {
      const post = store.posts.find((p) => p.id === params.id);
      if (!post) throw new Error("Post not found.");
      if (post.status === "publishing" || post.status === "published") throw new Error("Published posts can't be edited.");
      const slides = parseSlides(body.slides);
      if (slides) {
        if (slides.length === 0 || (post.format === "carousel" && slides.length < 2)) throw new Error("Carousels need at least 2 slides.");
        post.slides = post.format === "story" ? slides.slice(0, 3) : slides;
      }
      if (typeof body.caption === "string") post.caption = body.caption.slice(0, 2000);
      const hashtags = parseHashtags(body.hashtags);
      if (hashtags) post.hashtags = hashtags;
      if (typeof body.scheduledFor === "string" && !Number.isNaN(Date.parse(body.scheduledFor))) post.scheduledFor = new Date(body.scheduledFor).toISOString();
      if (body.status === "scheduled" || body.status === "pending_approval") {
        if (body.status === "scheduled" && post.status !== "scheduled") logLine(store, `Approved ${post.format} “${post.topic}”`);
        post.status = body.status;
        delete post.error;
      }
      return { ...post };
    });
    return NextResponse.json({ post });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  await updateStore((store) => {
    store.posts = store.posts.filter((p) => p.id !== params.id || p.status === "publishing");
  });
  return NextResponse.json({ ok: true });
}
