# Edyx — marketing agent for carousels & stories

Edyx is an AI marketing agent that **plans, writes, designs, and auto-publishes** Instagram carousels and stories (plus optional TikTok photo carousels) for your brand.

- **Create**: give a topic, get a full carousel (5–8 slides, 4:5) or story sequence (1–3 frames, 9:16) with caption and hashtags. Slides are rendered as on-brand JPEG images.
- **Autopilot**: describe your brand, content pillars, and cadence (e.g. 3 carousels/week, 1 story/day at 9:00, 13:00, 18:00). The agent keeps about 3 days of posts in the queue, rotating pillars and avoiding repeated topics, and publishes each post when it's due.
- **Queue**: preview every slide, then edit, approve, hold, reschedule, publish now, or retry. Turn off *Auto-publish* if you want every agent post to wait for your approval first.
- **Activity**: a log of everything the agent did.

## Run locally

1. Install Node.js 18.17+ and run `npm install`.
2. Copy `.env.example` to `.env.local` and fill it in (see below). To try it without posting anything, set `EDYX_DRY_RUN=true`.
3. `npm run build && npm start` (or `npm run dev`), then open <http://localhost:3000>.
4. Open **Autopilot**, describe your brand, and click **Turn on autopilot** → **Run agent now**.

When Edyx runs as a long-lived server (`npm start`, Docker, a VPS), a built-in scheduler runs the agent every 5 minutes (`EDYX_SCHEDULER_MINUTES`). You don't need anything else.

## Connecting accounts

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Writes the slides and captions (required). |
| `PUBLIC_BASE_URL` | Public URL of this app. Instagram/TikTok download slide images from `/api/render/...`, so it must be reachable from the internet. For local testing, use a tunnel (e.g. `ngrok http 3000`). |
| `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID` | An Instagram **professional** (Business/Creator) account connected through a Meta app using *Instagram API with Instagram Login*, with the `instagram_business_content_publish` permission. For a token from Facebook Login, also set `INSTAGRAM_GRAPH_HOST=graph.facebook.com`. Long-lived tokens expire after 60 days, so refresh them. |
| `TIKTOK_ACCESS_TOKEN` | Optional. A user token with `video.publish` from a TikTok developer app with the Content Posting API. The image domain must be verified in the app. Until TikTok audits your app, posts can only be `SELF_ONLY` (private). TikTok has no Stories API, so stories go to Instagram only. |
| `CRON_SECRET` | Protects `/api/cron`, the endpoint that runs the agent on a schedule. |
| `EDYX_ADMIN_PASSWORD` | Optional, but strongly recommended once deployed: Basic-auth password for the dashboard and API. |
| `EDYX_DRY_RUN` | `true` simulates publishing, so you can test the whole autopilot safely. |

Instagram limits: up to 10 slides per carousel, and up to 100 API-published posts per 24 hours.

## Deploying

- **VPS / Docker / Render / Railway (recommended)**: run `npm start`. The built-in scheduler and the JSON data file (`./data/edyx.json`, or `EDYX_DATA_DIR`) both work as-is. Put the data directory on a persistent volume.
- **Vercel**: `vercel.json` sets a cron that calls `/api/cron` every 15 minutes (Vercel sends `CRON_SECRET` automatically). Vercel's filesystem doesn't persist, so swap `lib/store.ts` for a database (e.g. Postgres or KV) before relying on it there.

## How it fits together

```
app/page.tsx                    Dashboard (Create / Queue / Autopilot / Activity)
app/api/posts                   List posts, create a post from a topic
app/api/posts/[id]              Edit / approve / hold / delete;  /publish = publish now
app/api/agent                   Get/save autopilot settings;  POST = run agent now
app/api/cron                    Scheduled agent run (Bearer CRON_SECRET)
app/api/render/[id]/[n].jpg     Renders slide n as a JPEG (public, platforms fetch it)
lib/agent.ts                    Planner (what to post when) + publishing orchestration
lib/generate.ts                 AI copywriting for carousels and stories
lib/publishers/*                Instagram Graph API and TikTok Content Posting API
lib/store.ts                    JSON file storage
instrumentation.ts              Starts the built-in scheduler
```

The agent only uses facts from your brand description and topics. It's told never to invent prices, discounts, stats, or testimonials. Still, keep an eye on the queue, especially when auto-publish is on.
