# Edyx

Edyx is an AI-assisted social content composer. Describe a product, offer, or campaign and get Instagram- and TikTok-specific post drafts with hooks, captions, hashtags, and creative ideas.

## Run locally

1. Install Node.js 18.17+.
2. Install dependencies: `npm install`.
3. Copy `.env.example` to `.env.local` and add an OpenAI API key as `OPENAI_API_KEY`.
4. Start the app: `npm run dev`.
5. Open [http://localhost:3000](http://localhost:3000).

The API key is used only by the server-side generation route; do not expose it in browser code.

## Current scope

- Generate reviewable drafts for Instagram and TikTok based on a brief, audience, and voice.
- Copy a caption to prepare it for publishing.
- No account connection, media upload, scheduling, or automatic publishing is implemented. Publishing requires separately configured official Meta/Instagram and TikTok developer applications, user consent, approved scopes, and secure token storage. Drafts are not posted automatically.

## Next steps

A production publishing workflow should add OAuth account connections, media handling, a persistent post queue and scheduler, platform-specific publishing adapters, token encryption/rotation, and explicit approval controls before enabling autopublishing. Platform API availability and permissions should be verified for each connected account before building those integrations.
