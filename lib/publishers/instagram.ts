import type { Post } from "../types";

const host = () => process.env.INSTAGRAM_GRAPH_HOST || "graph.instagram.com";
const version = () => process.env.INSTAGRAM_API_VERSION || "v21.0";

async function call(pathname: string, params: Record<string, string>, method: "GET" | "POST" = "POST") {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN!;
  const url = new URL(`https://${host()}/${version()}/${pathname}`);
  const body = new URLSearchParams({ ...params, access_token: token });
  const response = method === "GET"
    ? await fetch(`${url}?${body}`)
    : await fetch(url, { method: "POST", body });
  const json = (await response.json().catch(() => ({}))) as Record<string, any>;
  if (!response.ok || json.error) {
    throw new Error(`Instagram API: ${json.error?.message ?? `HTTP ${response.status}`}`);
  }
  return json;
}

/** Media containers are processed asynchronously; wait until Instagram reports them ready. */
async function waitUntilReady(containerId: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const { status_code: status } = await call(containerId, { fields: "status_code" }, "GET");
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") throw new Error(`Instagram could not process media (${status}).`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Instagram media processing timed out.");
}

async function publishContainer(userId: string, containerId: string) {
  await waitUntilReady(containerId);
  const { id } = await call(`${userId}/media_publish`, { creation_id: containerId });
  return id as string;
}

export function instagramConfigured() {
  return Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_USER_ID);
}

export async function publishToInstagram(post: Post, imageUrls: string[]): Promise<string> {
  const userId = process.env.INSTAGRAM_USER_ID!;
  const caption = [post.caption, post.hashtags.map((t) => `#${t}`).join(" ")].filter(Boolean).join("\n\n");

  if (post.format === "story") {
    // Each story frame is its own published story; captions aren't shown on stories.
    const ids: string[] = [];
    for (const image_url of imageUrls) {
      const { id } = await call(`${userId}/media`, { image_url, media_type: "STORIES" });
      ids.push(await publishContainer(userId, id));
    }
    return ids.join(",");
  }

  if (imageUrls.length < 2 || imageUrls.length > 10) throw new Error("Instagram carousels need 2–10 slides.");
  const children: string[] = [];
  for (const image_url of imageUrls) {
    const { id } = await call(`${userId}/media`, { image_url, is_carousel_item: "true" });
    children.push(id);
  }
  for (const child of children) await waitUntilReady(child);
  const { id } = await call(`${userId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption });
  return publishContainer(userId, id);
}
