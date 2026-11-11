import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sizes = { carousel: { width: 1080, height: 1350 }, story: { width: 1080, height: 1920 } };

export async function GET(_request: Request, { params }: { params: { id: string; index: string } }) {
  const { posts, settings } = await getStore();
  const post = posts.find((p) => p.id === params.id);
  const index = Number.parseInt(params.index, 10);
  const slide = post?.slides[index];
  if (!post || !slide) return new Response("Not found", { status: 404 });

  const { width, height } = sizes[post.format];
  const { background, text, accent } = settings.theme;
  const isStory = post.format === "story";
  const isFirst = index === 0;
  const total = post.slides.length;

  const png = new ImageResponse(
    (
      <div style={{ width, height, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: isStory ? "180px 90px" : "90px", background, color: text, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 30, opacity: 0.85 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: accent }} />
            <span>{settings.handle ? `@${settings.handle.replace(/^@/, "")}` : settings.brandName || " "}</span>
          </div>
          {!isStory && total > 1 && <span>{index + 1} / {total}</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          <div style={{ width: 120, height: 10, background: accent, borderRadius: 5 }} />
          <div style={{ fontSize: isFirst ? (isStory ? 104 : 96) : 76, fontWeight: 800, lineHeight: 1.08, letterSpacing: -2 }}>{slide.headline}</div>
          {slide.body && <div style={{ fontSize: isFirst ? 40 : 44, lineHeight: 1.4, opacity: 0.85 }}>{slide.body}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, opacity: 0.7 }}>
          <span>{settings.brandName}</span>
          {!isStory && index < total - 1 && <span style={{ color: accent }}>Swipe →</span>}
        </div>
      </div>
    ),
    { width, height },
  );
  // Instagram's publishing API only accepts JPEG images.
  const jpeg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 92 }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=60" } });
}
