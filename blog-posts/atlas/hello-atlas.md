---
title: Hello, Atlas
date: 2026-05-05
---

Atlas is the second thing I'm building on the Mac Studio. It's a self-hosted ChatGPT — a web app I can hit from anywhere, with my own models running underneath.

This post is the why. The next ones are the how.

## Why this isn't part of Jarvis

Jarvis is a Discord bot. The interface is text messages in a channel. That works great for "remind me to look at this later" and "kick off an overnight run on a project," but it's bad at the things ChatGPT is good at — long-form back-and-forth, image uploads, switching models mid-conversation.

I tried to make Discord do this. It can't. Discord's message format is hostile to long replies, code blocks render poorly on mobile, image uploads have limits, and there's no concept of a conversation you can navigate.

So Atlas is a separate codebase. Same machine, same models, same vault on disk — different interface, different shape.

## What it does

The short version: a ChatGPT-like web app where every message gets routed to the best place to handle it.

- **Local model** — most messages. Whatever's loaded in Ollama. Free, fast, private.
- **Gemini API** — anything that needs internet access or current information.
- **Vault RAG** — questions that touch my Obsidian notes.
- **Tool calls** — weather, places, web search.

I don't pick the route. A classifier in front of every message does, and the chat UI shows me which route it chose after the fact.

## What's different about it

A few things matter to me that ChatGPT and Claude don't do:

**My models, not theirs.** Whatever's running in Ollama is available. When I want to compare two models on the same prompt, I can — they're on the same machine.

**My vault, accessible.** Atlas reads the same Obsidian vault Jarvis does. It's not the *same code* — Atlas has its own indexer, retriever, and file watcher, with its own privacy filter on the Gemini path — but it's the same notes on disk. Two services, one knowledge base, parallel implementations. (Whether that duplication was the right call is a question I keep poking at; for now, the isolation is worth more than the DRY.)

**Self-hosted but reachable.** It runs on the Studio in my apartment and I can use it from my phone. The tunnel-and-auth setup gets its own post.

**One large model at a time.** This is a hardware constraint, not a feature, but it shapes the UX. A 70B model is ~42GB; loading two large models starts swapping into system memory and kills throughput. So Atlas has a model manager that enforces one-large-model-at-a-time. That, too, gets its own post — and it turned out to be more broken than I realized for longer than I'd like to admit.

## The stack

For posterity:

- **Frontend** — Next.js 14, App Router
- **Backend** — FastAPI, a Python sidecar for the heavy lifting
- **Streaming** — Ollama over server-sent events
- **Storage** — SQLite locally; conversations stay on the machine. Rows are ordered by a rowid plus a monotonic clock, so message order is stable even when timestamps collide.
- **Auth** — Supabase
- **Models** — Ollama for local, Gemini API for external

The Python sidecar is the thing I'd push back on if I were starting fresh — Next.js can technically do everything, and the cross-process boundary adds latency. But the things that touch models, embeddings, and file watching are all Python-ecosystem. Letting FastAPI do the heavy lifting and Next.js be a thin proxy keeps each side doing what it's good at.

## What I'm not building

- **A team product.** Single-user.
- **A mobile app.** The web app on mobile is fine.
- **Image generation.** Not a priority.
- **Long-running agents.** That's what Jarvis is for. Atlas is interactive, short-turn chat.

## Where this is going

The next posts cover the per-message router and the Gemini integration, the model manager and why it didn't actually manage anything until late, the tools and image-upload layer, the judge loop that built all of this and the ways it kept fighting itself, and the auth setup.
