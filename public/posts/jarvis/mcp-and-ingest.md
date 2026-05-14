---
title: Reaching outside the box — MCP and ingest
date: 2026-05-07
---

Up to this point, everything Jarvis did happened inside its own process. It read the vault, it ran the orchestrator, it talked to local models. This stage was about the two ways it reaches *outside* itself — into the brain's own ingest workflow, and into external services through MCP.

Both turned out to be the same idea: delegation. Don't reimplement; hand off to the thing that already knows how.

## Ingest: don't reimplement the brain

My Obsidian vault has its own discipline. There's a workflow for taking a raw intake note — something Jarvis filed from a Discord message — and properly ingesting it into the permanent wiki: checking links, placing it in the right category, updating the index. That workflow is documented in the brain's own instructions, and it's the brain's spec, not Jarvis's.

The wrong move would be to reimplement that workflow inside Jarvis. It would drift out of sync with the brain's actual rules the first time I changed one.

So Jarvis doesn't reimplement it. `request_ingest` spawns a Claude Code session with its working directory set to the brain repo. That session loads the brain's own instructions and runs the ingest workflow exactly as specified — Jarvis just kicks it off and waits. The ingest runner builds the prompt, runs the session with a generous timeout, and parses a structured summary block out of the result. If the block is missing, that's a failure with the raw output preserved, rather than a crash. Unknown keys in the block are ignored, so the brain can evolve its summary format without breaking Jarvis.

There's a hard safety check: the ingest runner refuses to operate on anything outside the intake directory. And on success, it triggers a vault re-index, so a freshly ingested page is immediately searchable by RAG instead of waiting for the next watcher pass.

This is the payoff of the rule that *all* brain mutation goes through one bridge. Because Jarvis never writes to the wiki directly, "ingest" can just be "a special kind of orchestrator run that happens to target the brain repo." Same machinery, different target.

On the Discord side, this surfaces as `ingest` and `ingest <slug>` commands, plus an optional debounced auto-ingest — file enough intakes and it'll schedule one itself.

## MCP: tools that aren't mine to build

The other half of the stage was MCP — letting Claude reach my calendar, my email, my drive.

The thing I expected to be hard turned out to already be solved. The `claude` CLI loads user-scoped MCP servers automatically in print mode. I didn't need a config system, a per-call server registry, or any of the machinery I'd sketched out. The calendar, email, and drive tools were just *there* when Claude ran.

What Jarvis needed was much smaller. `ClaudeClient` got two new behaviors:

- **`mcp_aware`** — a longer timeout and a distinct cost tag, used when a message is expected to make a tool call. MCP round-trips are slower than plain reasoning; the timeout has to know that.
- **`isolate_mcp`** — passes the strict-config flags with an empty MCP config, producing a session with *no* tools at all. This is what orchestrator runs use. A Claude Code session grinding on a code project has no business touching my email, and isolating it is both a privacy boundary and a speed win.

The two are mutually exclusive — asking for both is a programming error, so it raises one.

The daily digest picked up the obvious benefit: a calendar section at the top, an opt-in email summary. When MCP is unavailable, those sections just say "unavailable" rather than failing the whole digest.

## The two regressions

MCP shipped, and then live smoke testing immediately found two routing bugs — both the same shape.

I asked "what's on my calendar today?" and got "I can't access your calendar." The router had correctly tagged the message as needing the calendar MCP — but it had *also* classified it as trivial, and the trivial classification won, sending it to a local model that obviously has no calendar. The fix: a non-empty `needs_mcp` short-circuits straight to the Claude path, regardless of how trivial the message looks.

Then the second one: "what was on my calendar next week?" got blocked by the privacy gate, because the router flagged it as personal. And it *is* personal — but the privacy gate exists to stop my **brain wiki** from leaking to an external service, not to stop Claude from reading **my own calendar** through a tool I explicitly connected. Those are different things. The fix: a non-empty `needs_mcp` also tells the privacy gate to stand down. The RAG-stage filter still strips privacy-tagged wiki chunks — defense in depth is intact — but the upfront gate no longer confuses "my private notes" with "my own services."

Both bugs were the router being *right* about one signal and a downstream rule not knowing that signal should win. The lesson tracks with everything else in this build: the components were individually correct, and the bug lived in which one's opinion took priority.

## What I deliberately didn't build

A general tool framework inside Jarvis. It would have been easy to start wrapping each MCP server in a Jarvis-side abstraction — typed clients, a tool registry, retry policies. I didn't, because the `claude` CLI already *is* the tool framework. Jarvis's job is to decide *whether* a message needs tools and *which* session should or shouldn't have them. The actual tool-calling is Claude's. Delegation again: the smallest possible layer on top of something that already works.
