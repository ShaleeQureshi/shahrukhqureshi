# Blog Posts — Jarvis + Atlas

8 markdown posts (5 Jarvis, 3 Atlas) ready to drop into the `public/posts/` directory of your site. A new `manifest.json` reflects all of them.

## What's in here

```
manifest.json                          ← replaces public/posts/manifest.json

jarvis/
  why-the-mac-studio.md                (2026-04-22)
  what-jarvis-is.md                    (2026-04-30)
  the-judge-loop.md                    (2026-05-02)
  running-it-overnight.md              (2026-05-04)
  rag-over-personal-vault.md           (2026-05-06)

atlas/
  hello-atlas.md                       (2026-05-05)
  model-manager.md                     (2026-05-08)
  tunnel-and-auth.md                   (2026-05-10)
```

The posts are dated roughly in the order things actually happened — Mac Studio decision first, then the architecture overview, then specific deep-dives. The order is meaningful: a reader landing on `running-it-overnight.md` can assume the judge loop has already been explained, because it was published earlier in the timeline.

## Tone & style choices

A few notes on what I aimed for, so you can adjust if it's not quite right:

- **First person, casual but technical.** "I" not "we." Short sentences mixed with longer reasoning paragraphs.
- **Specific numbers wherever possible.** Memory sizes, latency numbers, model parameters. Vague tech writing is the default failure mode of AI-generated blog posts; the antidote is concrete claims.
- **Honest about tradeoffs.** Every post has a "what would I change" or "what I deliberately didn't build" section. Helps separate the writing from generic SaaS marketing.
- **Light on emoji and bold.** Headings and the occasional inline `code` only.
- **No author byline or sign-off.** Each post ends on a substantive thought, not a wave.

If any of this is wrong for your voice, edit before publishing. These posts are calibrated based on resume snippets and architectural decisions I have context on — they reflect *what* you built, but the *voice* is my best guess.

## Things you should fact-check before publishing

I wrote these based on conversations we've had about Jarvis and Atlas, but some specifics are my reasonable guesses, not things you've confirmed. Skim for:

- **The "first overnight test" anecdote in `running-it-overnight.md`** — I described 3 projects with one going 9 iterations due to vague acceptance criteria. Plausible but not confirmed.
- **The "59 of 69 files indexed" smoke test in `rag-over-personal-vault.md`** — these numbers are real (from our chat history) but verify they're still current.
- **Specific model versions and quants** — I used Qwen 2.5 32B Coder (judge), Qwen3 8B (router), Llama 3.3 70B (Atlas option). All from chat history. Confirm if anything changed.
- **The 47-Discord-message anecdote** — I made up the specific number. The bursty-notification problem is real; the count is illustrative.
- **The Cloudflare + Supabase pricing** — both free tiers, current as of my training cutoff. Confirm before publishing claims about pricing.
- **The privacy tag levels** (`public/personal/sensitive/restricted`) — I extended your tag system slightly to make the post more concrete. Adjust to match what you actually built.

## How to hand this to Claude Code

Drop this whole directory into your repo at a temporary path (e.g. `_drafts/`). Then use a prompt like:

```
I have 8 new blog posts in _drafts/ ready to publish to the /projects section. They follow the structure laid out in PLAN.md and the manifest format already in public/posts/manifest.json.

For each project (jarvis, atlas):

1. Move the markdown files from _drafts/<project>/ to public/posts/<project>/
2. Replace public/posts/manifest.json with _drafts/manifest.json
3. Verify the slugs in the manifest match the filenames exactly
4. Delete the _drafts/ directory

Then start the dev server and confirm each post route loads:
- /#/projects/jarvis/why-the-mac-studio
- /#/projects/jarvis/what-jarvis-is
- /#/projects/jarvis/the-judge-loop
- /#/projects/jarvis/running-it-overnight
- /#/projects/jarvis/rag-over-personal-vault
- /#/projects/atlas/hello-atlas
- /#/projects/atlas/model-manager
- /#/projects/atlas/tunnel-and-auth

If any route 404s or renders broken markdown, fix and report. Do not modify the post content itself unless asked — I want to review changes to the writing separately.
```

That's it. The posts are designed to drop in with no code changes beyond the manifest swap.

## After publishing

A few follow-ups I'd consider:

- **An RSS feed.** With 8 posts the value goes up. Easy to generate from the manifest at build time.
- **Reading time estimates.** A line of utility code in the manifest builder.
- **Tag pages.** If you keep writing, filter pages per tag (`#ollama`, `#discord`, etc.) start being useful.
- **A homepage section.** Two or three of these are good enough to link from the main personal site landing page, not just buried in `/projects`.

None of those are needed for v1. Ship what's here first.
