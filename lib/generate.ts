import OpenAI from "openai";
import type { AgentSettings, PostFormat, Slide } from "./types";

export type GeneratedContent = { topic: string; slides: Slide[]; caption: string; hashtags: string[] };

export class ConfigError extends Error {}

const formatRules: Record<PostFormat, string> = {
  carousel:
    "Write an Instagram-style carousel of 5 to 8 slides. Slide 1 is a scroll-stopping hook. Middle slides each deliver one clear, specific point. The last slide is a call to action (save, share, follow, or visit). Headlines max 8 words; body max 30 words.",
  story:
    "Write a story sequence of 1 to 3 vertical frames meant to be viewed in a few seconds each. Frame 1 grabs attention; the final frame has a simple call to action. Headlines max 6 words; body max 18 words.",
};

export async function generateContent(params: {
  format: PostFormat;
  settings: AgentSettings;
  topic?: string;
  pillar?: string;
  avoidTopics?: string[];
}): Promise<GeneratedContent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new ConfigError("Add OPENAI_API_KEY to your environment and restart the app.");
  const { format, settings, topic, pillar, avoidTopics = [] } = params;

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.85,
    messages: [
      {
        role: "system",
        content: [
          "You are Edyx, a marketing agent that creates social media content for a brand.",
          "Only use facts present in the brand description or topic. Never invent discounts, prices, statistics, testimonials, or claims.",
          formatRules[format],
          "Return only a JSON object with: topic (string, the specific angle you chose), slides (array of {headline, body}), caption (string, under 1,500 characters, no hashtags in it), hashtags (array of exactly 5 plain tags without #).",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          brand: settings.brandName || "Unnamed brand",
          handle: settings.handle,
          brandDescription: settings.description,
          audience: settings.audience,
          voice: settings.tone,
          requestedTopic: topic || null,
          contentPillar: topic ? null : pillar || null,
          recentTopicsToAvoid: avoidTopics.slice(-20),
        }),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("The model returned an empty response.");
  const parsed = JSON.parse(content) as Record<string, unknown>;
  const maxSlides = format === "carousel" ? 10 : 3;
  const slides = (Array.isArray(parsed.slides) ? parsed.slides : [])
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      headline: typeof s.headline === "string" ? s.headline.slice(0, 90) : "",
      body: typeof s.body === "string" ? s.body.slice(0, 260) : "",
    }))
    .filter((s) => s.headline || s.body)
    .slice(0, maxSlides);
  if (slides.length === 0 || (format === "carousel" && slides.length < 2)) {
    throw new Error("The model returned too few slides.");
  }
  // Owner's rule: exactly 5 hashtags, and the brand hashtag is always one of them.
  const brandTag = (process.env.EDYX_REQUIRED_HASHTAG ?? "edyx").replace(/^#/, "");
  const tags = (Array.isArray(parsed.hashtags) ? parsed.hashtags : [])
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.replace(/^#/, "").replace(/\s+/g, ""))
    .filter((t) => t && t.toLowerCase() !== brandTag.toLowerCase());
  const hashtags = brandTag ? [brandTag, ...tags].slice(0, 5) : tags.slice(0, 5);

  return {
    topic: typeof parsed.topic === "string" ? parsed.topic.slice(0, 160) : topic || pillar || "Untitled",
    slides,
    caption: typeof parsed.caption === "string" ? parsed.caption.slice(0, 2000) : "",
    hashtags,
  };
}
