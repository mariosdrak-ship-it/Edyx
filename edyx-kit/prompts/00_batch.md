# WORKFLOW: «Φτιάξε X carousels» (the owner's standard command)

1. PICK X niches: top of knowledge/niches_backlog.md, never anything in knowledge/carousels_made.md.
   Mix about 1 general topic per 4-5 job niches. Never two of the same family in one batch.
2. WRITE one spec per niche (specs/<name>.json, CLAUDE.md §6 formula) + Instagram caption (decorated layout)
   + TikTok caption, both with EXACTLY 5 hashtags incl. #edyx. Save captions in captions/batch_<date>.md.
3. BUILD: python kit/batch.py specs/<a>.json specs/<b>.json ...  (renders, TikTok copies, preview sheet)
   QA every slide (CLAUDE.md §13). Fix lone words on lines, overflow, readability. Rebuild.
4. SHOW the owner: preview sheet + hooks table + "must verify" list. WAIT for the OK.
   The owner may approve all, some ("1,3,5"), or ask for changes. Nothing is posted without the OK.
5. ON OK, for each approved post:
   a. Upload the 6 JPEGs to Higgsfield (media_upload → curl PUT → media_confirm) → public CDN URLs.
      Save them in captions/uploads.md.
   b. INSTAGRAM (automatic): Windsor execute_action create_carousel_post, connector instagram,
      account 17841429207712882 (edyx.gr), image_urls = the 6 URLs, caption = Instagram caption.
   c. TIKTOK: Higgsfield tiktok_prepare_publish works ONLY where the TikTok form widget shows
      (claude.ai in a browser). If the owner is not there, send him the 6 TikTok JPEGs (out/tiktok/)
      + the TikTok caption so he posts from the phone in 30 seconds.
   Location (τοποθεσία): the publishing API cannot set it. Default location is Athens: remind the owner to add it
      in the Instagram app (post → ⋯ → Edit → Add location) right after publishing.
   d. Space posts: max 2 per day per platform unless the owner says otherwise.
6. LOG: move niches to carousels_made.md + hooks to hooks_library.md; add a row per platform to posted_log.md.
