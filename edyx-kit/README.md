# Edyx agent kit

1. Create a Claude Code project folder and copy this whole folder into it. Keep `CLAUDE.md` at the project root so the agent reads it automatically.
2. `pip install -r kit/requirements.txt`
3. Put photos in `photos/<spec-name>/` (cover.jpg, bridge.jpg, v1.jpg, v2.jpg, v3.jpg, cta.jpg).
4. Test: `python kit/edyx_carousel_kit.py specs/reviews.json --photos photos --out out`  (works without photos: teal background).
5. For a new carousel paste `prompts/01_new_carousel.md` into Claude Code and fill the brackets.
Fonts (Inter, EB Garamond) download automatically on the first run (internet needed once).
