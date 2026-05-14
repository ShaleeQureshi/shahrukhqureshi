---
title: What Jarvis actually is
date: 2026-04-30
---

Jarvis is the AI orchestrator running on my Mac Studio. The name does a lot of work — when I tell people "I built an AI assistant," they usually picture a chat box. Jarvis is closer to personal infrastructure that happens to have a chat interface on it.

This post is the high-level map. Future posts get into the bits that were actually hard to build.

## The one-paragraph version

A Discord bot receives a message. A local router model (Qwen3 8B, JSON mode, no thinking) classifies it in under a second. From there a path executor picks one of five paths: answer locally from a personal Obsidian vault using RAG, escalate to Claude for hard reasoning, queue an orchestrator run that spawns Claude Code sessions against a project, file an "intake" note into the vault, or just report status. Underneath all of that, six background workers handle the slow stuff — re-embedding the vault when files change, transcribing voice memos, compacting old conversations, generating cost reports, and pushing a morning digest.

## Why Discord is the UI

The original instinct was to build a chat UI. Then I realized I was about to spend three weeks building something that already exists, doesn't sync across devices, and has no mobile app.

Discord is the chat UI. The mobile app gives me Jarvis on my phone for free. Voice messages are a built-in attachment type, which means voice memos are just another message with a different content type to route. Channels give me structure: a channel for project status, a channel for the brain, a channel for ad-hoc conversation. The router prompt is even channel-aware — the same sentence gets classified differently depending on which channel it landed in.

Discord is also the only thing on this list I didn't have to build.

## The router

Every message hits the router first. It's a Qwen3 8B running locally in JSON mode, prompted to emit a small structured object:

```json
{
  "intent": "general_reasoning",
  "complexity": "hard",
  "needs_mcp": ["google-calendar"],
  "privacy_tags_likely": []
}
```

`intent` and `complexity` together decide the path — the path executor maps the intent/complexity pairs onto the five paths. `needs_mcp` flags when a message wants an external tool (calendar, email, drive), which forces escalation to Claude even when the message looks trivial. `privacy_tags_likely` is the router's guess at whether the message touches sensitive personal context, which feeds the privacy gate.

The router does not retry on a parse failure. If the JSON comes back malformed, that's a routing miss and it's handled downstream — chasing a clean re-roll inside the hot path just adds latency. The thing I learned building it: the router's job isn't to be perfect, it's to be fast and mostly right, and to make the *expensive* paths opt-in rather than opt-out.

## The orchestrator

This is the part that runs overnight. The orchestrator takes a queued project, spawns a Claude Code session in an isolated git worktree, runs the project's test command, sends the diff and the test output to a local judge model (Qwen 2.5 32B Coder), gets a verdict, and either accepts the result or loops with feedback.

The judge is a JSON-mode prompt: given the diff, the tests, and the per-project acceptance criteria, return `{"verdict": "pass" | "fail", "reasoning": "...", "feedback_for_next_iteration": "..."}`. If it fails, the feedback gets injected into the next Claude Code prompt and the loop runs again. Caps are an iteration count, a wallclock timeout, and a "stuck" detector that gives up if the diff stops changing between iterations.

The pieces that took the longest weren't the obvious ones. Parsing Qwen's JSON output reliably was a multi-day problem because it kept wrapping JSON in markdown fences. Capturing the diff was the second — Claude Code never commits anything, so a `git diff` between commits is always empty. Both got their own post.

## Background workers

Six of them, all running independently under a worker supervisor that restarts them with exponential backoff and alerts Discord if one keeps failing:

1. **Vault watcher** — filesystem events on the brain directory trigger re-embedding.
2. **Voice memo processor** — a folder watcher that runs Whisper on new audio files, summarizes them, files them into the vault.
3. **Conversation compactor** — every 6 hours, summarizes old Discord turns so context doesn't grow without bound.
4. **Daily digest** — a morning summary: calendar events via MCP, overnight runs, vault changes, intakes, costs.
5. **Cost reporter** — end-of-day API spend summary.
6. **Run summary** — a 6am briefing of overnight orchestrator results.

Run summary and daily digest sound like the same thing — they aren't. Run summary is "what the orchestrator did overnight." Daily digest is "everything about today" — runs plus calendar plus vault changes plus intakes. Different channels, different audiences. I considered merging them after a week. Didn't.

## What's deliberately not in here

- **No real-time voice.** Voice memos work async — record, transcribe, route through the regular pipeline. Real-time conversational voice is genuinely hard and not necessary for the workflow I actually use.
- **No multi-user support.** This is a single-user system. Adding auth and isolation would triple the scope for no real benefit.
- **No web UI for Jarvis itself.** Discord is the UI. The web UI is a different project — that's Atlas.
- **No training, only inference.** I run open-weight models. I don't fine-tune them.

## What's next

The next few posts are about specific things that were harder than expected: the orchestrator's worktree-and-loop machinery, the judge loop and the bugs that broke it twice, the privacy tag system that keeps personal stuff from leaving the machine, and what it took to make overnight runs actually unattended.
