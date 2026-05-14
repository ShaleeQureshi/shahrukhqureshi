---
title: What Jarvis actually is
date: 2026-04-30
---

Jarvis is the AI orchestrator running on my Mac Studio. The name does a lot of work — when I tell people "I built an AI assistant," they usually picture a chat box. Jarvis is closer to personal infrastructure that happens to have a chat interface on it.

This post is the high-level map. Future posts will get into the bits that were actually hard to build.

## The one-paragraph version

A Discord bot receives a message. A local router model (Qwen3 8B in non-thinking mode) classifies it into one of five paths in under a second. From there it either answers from a personal Obsidian vault using RAG, escalates to Claude for hard reasoning, kicks off an orchestrator run that spawns Claude Code sessions to work on a project, files an "intake" note into the brain, or just reports status. Underneath all of that, six background workers handle the slow stuff — re-embedding the vault when files change, transcribing voice memos, compacting old conversations, generating cost reports, and pushing a morning digest.

## Why Discord is the UI

The original instinct was to build a chat UI. Then I realized I was about to spend three weeks building something that already exists, doesn't sync across devices, and has no mobile app.

Discord is the chat UI. The mobile app gives me Jarvis on my phone for free. Slash commands give me typed inputs for free. Voice messages are a built-in attachment type, which means voice memos are just another message with a different content type to route. Channels give me structure: one for project status, one for the brain, one for ad-hoc conversations.

Discord is also the only thing on this list I didn't have to build.

## The router

Every message hits the router first. It's a Qwen3 8B running locally, prompted to emit structured JSON:

```json
{
  "intent": "tool_use",
  "confidence": 0.6,
  "vault_checked": true,
  "tools_hint": ["gmail", "calendar"]
}
```

There are five intents:

- **local_response** — answerable from the vault, return immediately
- **claude_path** — escalate to Claude over the CLI, optionally with MCP tools attached
- **orchestrator_queue** — this is a project task, queue it for the orchestrator
- **brain_intake** — file this as a note into the vault
- **status** — show me what's running

The thing I learned the hard way is that confidence matters as much as classification. If the router says "tool_use, confidence 0.92" I trust it and route directly. If it says "tool_use, confidence 0.55" I send it to a bigger model with instructions to answer from the vault if possible and only reach for tools if it has to. The cost is ~2–3s of extra latency on borderline cases. The benefit is no silent miscategorizations.

Sub-85% confidence is the threshold I landed on. It's loose enough that the router still does most of the work, tight enough that the bad routes get caught.

## The orchestrator

This is the part that runs overnight. The orchestrator's job is to take a queued project, spawn a Claude Code session in an isolated git worktree, run the project's test command, send the diff and the test output to a local judge model (Qwen 2.5 32B), get a verdict, and either accept the result or loop with feedback.

The judge is a JSON-mode prompt: given the diff, the tests, and the per-project acceptance criteria, return `{"verdict": "pass" | "fail", "reasoning": "...", "feedback_for_next_iteration": "..."}`. If it fails, the feedback gets injected into the next Claude Code prompt and the loop runs again. Caps are iteration count, wallclock time, and a "stuck" detector that gives up if the diff stops changing.

The pieces that took the longest weren't the obvious ones. Parsing Qwen's JSON output reliably was a multi-day problem because it kept wrapping JSON in markdown fences. Capturing the diff was the second — Claude Code never commits anything, so `git diff` between commits is always empty. The fix was `git add -A` followed by `git diff --cached`, which captures the staged work without actually committing.

## Background workers

Six of them, all running independently with a worker supervisor on top:

1. **Vault watcher** — filesystem events on the brain directory trigger re-embedding. Auto-tags new files in the inbox.
2. **Voice memo processor** — a folder watcher that runs Whisper on new audio files, summarizes them, files them into the vault.
3. **Daily digest** — a morning summary in #digest. Calendar events via MCP, overnight runs, wiki changes, intakes, costs.
4. **Conversation compactor** — periodic summarization of old Discord turns so context doesn't grow without bound.
5. **Cost reporter** — end-of-day API spend summary in #status.
6. **Run summary** — 6am briefing of overnight orchestrator results in #status.

Run summary and daily digest sound like the same thing — they aren't. Run summary is "what the orchestrator did overnight." Daily digest is "everything about today" — runs plus calendar plus vault changes plus intakes. Different channels, different audiences. I considered merging them after a week. Didn't.

## What's deliberately not in here

- **No real-time voice.** Voice memos work async — record, transcribe, route through the regular pipeline. Real-time conversational voice is genuinely hard and not necessary for the workflow I actually use.
- **No multi-user support.** This is a single-user system. Adding auth and isolation would triple the scope for no real benefit.
- **No web UI for Jarvis itself.** Discord is the UI. The web UI is a different project — that's Atlas.
- **No training, only inference.** I run open-weight models. I don't fine-tune them.

## What's next

The next few posts will probably be about specific things that were harder than expected: the crash recovery story for orphaned overnight runs, the privacy tag system that keeps personal stuff from leaving the machine, and why the model manager exists.
