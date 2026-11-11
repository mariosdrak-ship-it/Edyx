# PROMPT: new carousel (copy, fill the [brackets], paste to the agent)

Read CLAUDE.md first, then knowledge/hooks_library.md and knowledge/carousels_made.md (never repeat a job or a hook).

TASK
Create ONE Edyx Instagram carousel for: [JOB / TOPIC, e.g. "νύχια και ινστιτούτα ομορφιάς"]
Audience: [owner of ... in Greece]   Main problem: [e.g. "έχουν ωραία δουλειά αλλά κενά ραντεβού"]
Hook style: «Αν [πρόβλημα], κάνε αυτό.»   (or: [other hook type from the library])
Photos: [I will upload them / use the ones in photos/<name>/ / none yet, use the teal background]
CTA: standard («Επικοινώνησε μαζί μας για να δούμε μαζί τι να αλλάξεις στα βίντεό σου. edyx.gr»)  or DM keyword «[KEYWORD]»
Date-sensitive? [no / yes: search the news first and cite the source on the slide]

STEPS
1. Check that the job and hook are new. If news is involved, search first, verify, and keep only what the source says.
2. Write the copy in Greek: hook (≤12 words), bridge (reveals the «αυτό»), 3 value points (title, body, fix, optional note), CTA label.
   Value rules: one idea per slide, a concrete first step, no statistics unless verified, no promise of results.
3. Create specs/<name>.json (copy the shape of specs/reviews.json). Photo slots: cover, bridge, v1, v2, v3, cta.
   If photos are missing, leave the path: the kit falls back to the teal background and prints a warning.
4. Run: python kit/edyx_carousel_kit.py specs/<name>.json --photos photos --out out
5. QA: open out/<name>_sheet.png and check every item of the QUALITY CHECKLIST in CLAUDE.md. Fix and rebuild until clean.
6. Deliver the 6 jpgs + a short summary (hook, bridge, 3 points, CTA, which photo went where, anything the owner must verify)
   + the caption (prompts/02_caption.md).

OUTPUT LANGUAGE: Greek on the slides and in the caption. Talk to the owner in the language he writes in.
