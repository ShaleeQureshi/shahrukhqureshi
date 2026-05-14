---
title: Why the Mac Studio
date: 2026-04-22
---

I bought a Mac Studio M3 Ultra with 96GB of unified memory and 1TB of storage. Then I spent a few weeks asking myself whether I should return it.

The honest answer to "should you keep this thing" depends on one question: are you actually going to run large local LLMs, or does it just feel cool to own a machine that can?

## What this machine is actually good at

96GB of unified memory is the headline. With that much memory you can run:

- Llama 3.3 70B at Q8 — high quality, fits comfortably
- Qwen 2.5 72B at Q4 with room to spare
- Multiple models loaded at the same time
- Long context windows without swapping

A 4090 has 24GB of VRAM and chokes the moment you ask it to run anything past ~30B at decent quants. For local LLM work, the Mac Studio is one of the few consumer machines that can actually do the job.

The other thing that matters — and that I underestimated at first — is **memory bandwidth**, not capacity. The M3 Ultra has 800 GB/s. An M4 Pro has 273 GB/s. An M4 base has 120 GB/s. Token generation speed scales with bandwidth, so for a 7B model at Q4 you'd see roughly:

- M3 Ultra: 80–100 tok/s
- M4 Pro: 50–60 tok/s
- M4 base: 25–30 tok/s

For interactive use those numbers all feel fine. Where bandwidth starts mattering is **prefill** — the cost of processing the prompt before generation starts. A 14B model with a 7K-token prompt prefills in 12–15s on the Ultra and 25–35s on the M4 Pro. For voice-rate interaction, that gap is the difference between "snappy" and "unusable."

## What it's overkill for

Almost everything else. Web dev, Express servers, normal coding — any laptop handles that. Video editing, a MacBook Pro M3 Max is fine. Gaming, it's a Mac. ML training, an Nvidia GPU is faster and the ecosystem is better. Even inference on small models works on cheaper hardware.

## What changed my mind

The thing that made me commit to keeping it was realizing the workload I actually wanted wasn't one model — it was several, concurrent, with a voice interface on top.

The plan I landed on:

- **Discord bot** with a local router model classifying every message
- **Orchestrator** spawning multiple Claude Code sessions in parallel against a project queue
- **Local judge model** evaluating each iteration before it loops or moves on
- **Background workers** doing vault re-embedding, voice memo transcription, conversation compaction, cost reporting, morning digests
- **Atlas** — a separate self-hosted ChatGPT-style web app — running on the same box

That's at minimum two models hot at all times (router + judge), plus periodic Whisper for voice, plus the embedding model, plus whatever Atlas is loaded into. Combined working set sits in the 24–30GB range, but spikes during model swaps. The headroom is what keeps it from feeling slow.

The four-concurrent-agents-plus-voice scenario is exactly the workload the Studio was designed for. If you're running a Discord assistant with occasional MCP calls, a Mini is sufficient. If you're running an agentic workstation that orchestrates multiple Claude Code sessions while you talk to it, the Studio earns its capacity.

## The other reason

Hosting servers. Once the Studio is on 24/7 anyway, it stops being a workstation and starts being personal infrastructure. Express servers, databases, reverse proxies, message queues, MCP servers — all of it runs comfortably on localhost with zero network latency and zero monthly cost. A GCP instance with comparable specs runs $300–800/month. A pile of small VPSes for personal projects adds up to $100/month before you notice.

The Studio's marginal cost is electricity.

## What I'd tell someone on the fence

If you're asking yourself the question, you probably don't need it. The Mini handles 90% of what people actually do with these machines.

But if you genuinely want to build the agentic workflow — not as a "maybe someday," as the actual plan — the Mini will be a constant low-grade frustration the moment you push past one or two concurrent agents. The Studio is right for the architecture I'm building. That doesn't make it right for everyone.
