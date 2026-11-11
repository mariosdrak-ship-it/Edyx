import type { Post } from "../types";

export function tiktokConfigured() {
  return Boolean(process.env.TIKTOK_ACCESS_TOKEN);
}

/**
 * Posts a photo carousel through TikTok's Content Posting API (Direct Post).
 * Image URLs must be on a domain verified in your TikTok developer app.
 * Unaudited TikTok apps can only post with privacy level SELF_ONLY.
 */
export async function publishToTikTok(post: Post, imageUrls: string[]): Promise<string> {
  if (post.format !== "carousel") throw new Error("TikTok has no Stories API; only carousels are posted to TikTok.");
  const description = [post.caption, post.hashtags.map((t) => `#${t}`).join(" ")].filter(Boolean).join("\n\n");
  const response = await fetch("https://open.tiktokapis.com/v2/post/publish/content/init/", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.TIKTOK_ACCESS_TOKEN}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      post_mode: "DIRECT_POST",
      media_type: "PHOTO",
      post_info: {
        title: post.slides[0]?.headline.slice(0, 90) ?? "",
        description: description.slice(0, 4000),
        privacy_level: process.env.TIKTOK_PRIVACY_LEVEL || "SELF_ONLY",
        disable_comment: false,
        auto_add_music: true,
      },
      source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: imageUrls.slice(0, 35) },
    }),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, any>;
  if (!response.ok || (json.error?.code && json.error.code !== "ok")) {
    throw new Error(`TikTok API: ${json.error?.message || json.error?.code || `HTTP ${response.status}`}`);
  }
  return json.data?.publish_id as string;
}
