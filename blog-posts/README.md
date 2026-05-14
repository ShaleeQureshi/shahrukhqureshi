# Blog Posts — Jarvis + Atlas

16 markdown posts (10 Jarvis, 6 Atlas) documenting the "server" work on the Mac
Studio. `blog-posts/` is the source copy; `public/posts/` is the served copy.
`manifest.json` (in both places) is the content registry the site routes from.

## What's in here

```
manifest.json                          ← mirrored to public/posts/manifest.json

jarvis/
  why-the-mac-studio.md                (2026-04-22)
  what-jarvis-is.md                    (2026-04-30)
  building-the-orchestrator.md         (2026-05-01)
  the-judge-loop.md                    (2026-05-02)
  rag-over-personal-vault.md           (2026-05-03)
  the-discord-bot.md                   (2026-05-04)
  the-worker-framework.md              (2026-05-05)
  running-it-overnight.md              (2026-05-06)
  mcp-and-ingest.md                    (2026-05-07)
  ghost-os-integration.md              (2026-05-08)

atlas/
  hello-atlas.md                       (2026-05-05)
  the-router-and-gemini.md             (2026-05-06)
  model-manager.md                     (2026-05-08)
  tools-and-images.md                  (2026-05-09)
  tunnel-and-auth.md                   (2026-05-10)
  the-judge-feedback-loop.md           (2026-05-11)
```

These were rebuilt against the actual work logs in
`/Users/server-a/platform/history/` (daily logs, 2026-05-01 → 2026-05-07) rather
than from memory — every concrete number, model name, and bug traces to a log
entry. Two posts (`why-the-mac-studio`, `tunnel-and-auth`) fall outside the log
window and were fact-checked rather than rewritten.

## Tone & style

- First person, casual but technical. "I" not "we."
- Specific numbers wherever possible — but only numbers that show up in the logs.
- Each post has a "what I deliberately didn't build" / "what I'd change" beat.
- Light on emoji and bold. `##`/`###` headings only, inline `code` + fenced blocks.
- No author byline or sign-off.

## Adding a post

1. Create `blog-posts/<project>/<slug>.md` with `title` + `date` frontmatter; copy
   it to `public/posts/<project>/<slug>.md`.
2. Add an entry to `manifest.json` (in both locations) — `slug`, `title`, `date`,
   `summary` — with the slug matching the filename exactly.
3. No code changes needed; the router discovers posts via the manifest.
