---
title: Hello, Atlas
date: 2026-05-05
---

Atlas is the second thing I'm building on the Mac Studio. It's a self-hosted ChatGPT — a web app I can hit from anywhere with my own LLMs running underneath.

This post is the why. The next ones will be the how.

## Why this isn't part of Jarvis

Jarvis is a Discord bot. The interface is text messages in a channel. That works great for "remind me to look at this later" and "kick off an overnight run on the laurier-flow project," but it's bad for the things ChatGPT is good at — long-form back and forth, image uploads, model switching, side-by-side comparisons.

I tried to make Discord do this. It can't. Discord's message format is hostile to long replies, code blocks render poorly on mobile, image uploads have size limits, and there's no concept of editing a conversation tree.

So Atlas is a separate codebase. Same machine, same models, different interface.

## What it does

The short version: a ChatGPT-like web app where every message routes to the best place to handle it.

- **Local model** — most messages. Whatever I have loaded in Ollama. Free, fast, private.
- **Gemini API** — anything needing internet access or real-time information.
- **Vault RAG** — questions that touch my Obsidian notes.
- **Tool calls** — weather, places, web search, simple integrations.

The routing happens per-message. If I ask it "what's the weather in Toronto," that's a tool call. If I ask it to explain a piece of code I paste in, that's the local model. If I ask "what did I write about the Mac Studio decision," that's vault RAG. If I ask "what happened with the Anthropic API rate limit changes last week," that's Gemini.

I don't pick the route. The app does, based on a classifier in front of every message.

## What's different about it

A few things matter to me that ChatGPT and Claude don't do:

**My models, not theirs.** Whatever I have running in Ollama is available. Right now that includes Qwen 2.5 32B Coder, Llama 3.3 70B, and a few smaller specialists. When I want to compare models on the same prompt, I can — they're all hot on the same machine.

**My vault, accessible.** The RAG index Jarvis already maintains is shared with Atlas. When I ask a question that touches my notes, Atlas can answer with citations back to the source files. It's the same brain bridge.

**Self-hosted but accessible anywhere.** Cloudflare Tunnel exposes the web app at a public URL with no port forwarding. Supabase handles auth — only my account can log in. From my phone, from a friend's laptop, from a hotel TV in a pinch, the URL just works.

**One large model at a time.** This is a hardware constraint, not a feature, but it shapes the UX. A 70B model takes 40+ GB. A 32B takes ~20 GB. Loading two simultaneously starts swapping into system memory and kills throughput. So Atlas has a **model manager** that enforces one-large-model-at-a-time and queues requests during swaps. When I switch from the 32B to the 70B mid-conversation, there's a 6–10 second swap. The chat UI shows a "switching to llama 3.3 70B" indicator. Honest about the constraint.

## The stack

For posterity:

- **Frontend** — Next.js (App Router), React, Tailwind, shadcn/ui
- **Backend** — FastAPI (Python sidecar for the heavy lifting)
- **Auth** — Supabase
- **Storage** — SQLite locally (conversations stay on the machine), Supabase Postgres for auth only
- **Models** — Ollama for local, Gemini API for external
- **Vector DB** — ChromaDB, shared with Jarvis
- **Tunnel** — Cloudflare Tunnel for public access

The Python sidecar is the thing I'd push back on if I were starting fresh — Next.js can technically do everything, and the cross-process boundary adds latency. But the things that touch models, embeddings, file watching — that's all Python ecosystem. Routing the heavy lifting to FastAPI and letting Next.js be a thin proxy keeps each side doing what it's good at.

## What I'm not building

- **A team product.** Single-user.
- **Mobile app.** The web app on mobile is fine. PWAs exist if I really want it.
- **Image generation.** Not a priority. Maybe later.
- **Long-running agents.** That's what Jarvis is for. Atlas is interactive, single-turn (or short-turn) chat.

## Where this is going

The next posts will cover the per-message router (how it picks between local, Gemini, vault, and tools), the model manager (how the swapping actually works without making the UX terrible), and the auth setup (why Supabase is overkill for a single user and why I picked it anyway).
