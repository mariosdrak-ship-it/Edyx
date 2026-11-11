import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const allowedPlatforms = new Set(["Instagram", "TikTok"]);

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Draft generation is not configured yet. Add OPENAI_API_KEY to your environment and restart the app." }, { status: 503 });
  }

  let body: { brief?: unknown; audience?: unknown; tone?: unknown; platforms?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const brief = typeof body.brief === "string" ? body.brief.trim() : "";
  const audience = typeof body.audience === "string" ? body.audience.trim().slice(0, 160) : "Not specified";
  const tone = typeof body.tone === "string" ? body.tone.trim().slice(0, 100) : "Friendly and confident";
  const platforms = Array.isArray(body.platforms)
    ? [...new Set(body.platforms.filter((item): item is string => typeof item === "string" && allowedPlatforms.has(item)))]
    : [];

  if (!brief || brief.length > 3000) {
    return NextResponse.json({ error: "Add a brief between 1 and 3,000 characters." }, { status: 400 });
  }
  if (platforms.length === 0) {
    return NextResponse.json({ error: "Select Instagram, TikTok, or both." }, { status: 400 });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are Edyx, a thoughtful social media copywriter. Turn the user's marketing brief into one useful, truthful draft per requested platform. Do not invent product facts, discounts, testimonials, or claims. Instagram captions can be polished and save/share-friendly; TikTok should sound native, conversational, and have a strong spoken/video hook. Return only a JSON object with a 'drafts' array. Each entry must have: platform (string), hook (string), caption (string), hashtags (array of 3-6 plain tag strings without #), creativeIdea (string describing an image/video concept). Keep captions concise and do not claim the content was posted.",
        },
        {
          role: "user",
          content: JSON.stringify({ brief, audience, tone, platforms }),
        },
      ],
      temperature: 0.8,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("The model returned an empty response.");
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { drafts?: unknown }).drafts)) {
      throw new Error("The model returned an invalid draft format.");
    }
    const drafts = (parsed as { drafts: unknown[] }).drafts.filter((item): item is Record<string, unknown> => !!item && typeof item === "object").map((item) => ({
      platform: typeof item.platform === "string" && allowedPlatforms.has(item.platform) ? item.platform : "Social",
      hook: typeof item.hook === "string" ? item.hook.slice(0, 240) : "A post idea for your brand",
      caption: typeof item.caption === "string" ? item.caption.slice(0, 2200) : "",
      hashtags: Array.isArray(item.hashtags) ? item.hashtags.filter((tag): tag is string => typeof tag === "string").slice(0, 8) : [],
      creativeIdea: typeof item.creativeIdea === "string" ? item.creativeIdea.slice(0, 500) : "",
    }));

    return NextResponse.json({ drafts });
  } catch (error) {
    console.error("Draft generation failed:", error);
    return NextResponse.json({ error: "Draft generation failed. Check your API configuration and try again." }, { status: 502 });
  }
}
