---
title: The Discord bot
date: 2026-05-04
---

Discord is the entire user interface for Jarvis. There's no web app, no native client, no chat box I had to design. A message goes into a channel, and a few seconds later a reply comes back — and underneath that simple surface is the part of the system that decides what *kind* of question it just got.

This post is about the bot: the channel model, the five paths a message can take, and how the reply tells you where its answer came from.

## Channels are structure

The bot is scoped to specific channels by ID, not by name. That's a small decision with a real reason behind it — channel names can be renamed by anyone with permissions, IDs can't, and a personal assistant that can be socially engineered by renaming a channel is not a personal assistant I want. Configuration references channels by ID throughout.

The channels aren't cosmetic. They're context. There's a channel for project status, a channel for filing things into the brain, channels for ordinary conversation. The router prompt is **channel-aware**: the exact same sentence routes differently depending on where it landed. "Look into the new pricing" in the intake channel is a note to file; in a conversation channel it's a question to answer. The channel is a cheap, reliable signal about intent, so the router uses it.

## The five paths

Every message hits the router first — a local Qwen3 8B in JSON mode. The router doesn't *do* anything; it classifies. The path executor takes the router's `intent` and `complexity` and dispatches to one of five paths:

- **Local response** — answerable from the vault or with a small local model. A vault-flavored question goes through RAG; a casual one goes straight to Ollama. Fast, free, private.
- **Claude escalation** — hard reasoning, or anything that needs an MCP tool. Goes out to Claude over the CLI.
- **Orchestrator queue** — this is project work. Queue it for an overnight run.
- **Brain intake** — file this as a structured note in the vault.
- **Status** — show me what's running.

The path executor handles a handful of intent/complexity combinations and folds them onto those five paths. The router's job is speed and rough accuracy; the path executor's job is to make the actual decision and own the consequences.

## The privacy gate

Before a message can take the Claude path, it goes through a privacy gate. The gate blocks escalation if the router tagged the message with a sensitive category, if it came from the intake channel, or if it contains substrings that look private. The point is to make leaking personal context to an external service something that requires *getting past a check*, not something that happens by default.

This gate is upstream of the RAG-level privacy filter — the one that strips privacy-tagged chunks out of the vector-store query. Two independent checks, either one sufficient. A privacy leak shouldn't be one missed `if` statement away.

## Telling you where the answer came from

Here's the feature I didn't plan and wouldn't give up now: every reply has a footer saying where it came from.

Each dispatch result carries a `source`, and the bot appends a small italic line to the message — "local RAG (brain)", "Claude (with brain context)", "local (privacy gate fired)", and so on. When the privacy gate blocks a Claude escalation and falls back to a local answer, the footer *says so*. I'm not left wondering whether that answer went to an external service. I can see it.

The truncation logic is footer-aware — when a reply is long enough to need splitting, the splitter accounts for the footer so it never gets cut off. The footer is load-bearing, so it's protected.

## Streaming Claude replies

The Claude path streams. `ClaudeClient` has a streaming mode, and before it's invoked the path executor assembles context: a RAG pass over the vault for relevant notes, the last few conversation turns for continuity, and the question itself.

The streaming reply manager handles the cadence — it posts updates on a timed/token-count interval rather than on every token, splits at Discord's character limit, retries on rate limits, and appends the source footer at the end. The naive version of this ("edit the message on every token") gets you rate-limited within seconds. The cadence is the whole trick.

## Conversation, persisted

The bot saves the user's turn *before* it dispatches, not after. If a dispatch crashes, there's still a record that the message arrived and an error turn recording what went wrong — rather than a message that vanished into a stack trace. Conversation turns carry the role, the intent, and the path taken, which later lets the compactor and the digest workers reason about history without re-deriving any of it.

## What I deliberately didn't build

A command grammar. It would have been easy to make Jarvis respond to `!run`, `!status`, `!ask` — a parser, a help text, the whole thing. I didn't, because the router *is* the interface. The entire point is that I type a normal sentence and the system figures out what I meant. A slash-command grammar would be a second, redundant interface that slowly accumulates its own quirks. The router earns its keep precisely by letting me not think about syntax.
