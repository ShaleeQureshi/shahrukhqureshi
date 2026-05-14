---
title: The worker framework
date: 2026-05-05
---

A chunk of what Jarvis does isn't triggered by a message at all. The vault gets re-embedded when files change. Voice memos get transcribed when they land. Old conversations get compacted on a timer. None of that is a request — it's background work that has to keep happening whether or not I'm talking to the bot.

This post is about the worker framework: the supervisor that keeps the workers alive, and the six workers themselves.

## The supervisor

Every background job is a `Worker` — a small abstract base class with a run loop and a status. The interesting part isn't the workers, it's the thing watching them.

The `WorkerSupervisor` does two jobs. First, it restarts a worker that crashes, with exponential backoff — 1, 2, 4, 8, 16, 32, then capped at 60 seconds. A worker that fails because Ollama is briefly unreachable shouldn't hammer it; a worker that fails once and recovers shouldn't be punished for an hour.

Second, it gives up intelligently. There's a sliding-window failure cutoff: if a worker fails 5 times within 10 minutes, the supervisor stops restarting it and posts a Discord alert. A worker that's genuinely broken should stop thrashing and *tell me*, not silently retry forever. The alert is the point — a background system that fails quietly is worse than one that fails loudly.

Each worker writes its state to a small JSON file, atomically, so `jarvis workers status` can report what's running without the workers and the CLI needing to share memory.

## The two watchers

Two of the workers watch the filesystem, and they share a shape.

The **vault watcher** subscribes to filesystem events on the brain directory and re-embeds files when they change. The **voice memo processor** watches a folder for new audio files and runs them through Whisper.

Both bridge `watchdog` — which is callback-based and synchronous — to the async world through an `asyncio.Queue`. The filesystem callback just drops a path on the queue; an async consumer does the actual work. And both debounce, because the systems writing those files are bursty: Obsidian fires a noisy burst of save events per edit, and a phone syncing an audio file writes it in chunks. A few seconds of debounce collapses the burst into one unit of work.

The vault watcher also does catch-up. When it starts, it compares file modification times against a watermark it persisted last time it ran, and re-embeds anything that changed while it was down. A watcher that only sees *live* events silently goes stale every time the process restarts.

## The voice memo pipeline

The voice memo processor is the longest pipeline of the six. A new audio file triggers: transcribe with Whisper, summarize the transcript, generate a slug, save it into the vault's voice-memo directory, and — only if the memo is long enough and a classifier agrees it's worth keeping — also file it as a structured intake. Then the audio gets moved into a `processed/` folder so it isn't transcribed twice.

The "long enough and a classifier agrees" gate matters. Not every voice memo is a note worth filing. A ten-second "remind me to call the barber" doesn't need a full intake template; a three-minute think-out-loud about a project design does.

## The clock-driven workers

The other workers run on a schedule rather than a trigger.

The **conversation compactor** runs every 6 hours. Once a conversation passes a turn-count threshold, it summarizes the oldest turns and replaces them with the summary — transactionally, insert-then-update, and the originals are *never deleted*, just marked as summarized. Context can't grow without bound, but nothing is actually lost.

The **daily digest** runs on a clock and posts a morning summary: calendar, overnight runs, vault changes, intakes, costs. The **cost reporter** reads the `llm_calls` table and renders an end-of-day spend breakdown — by caller, slowest calls, error rate. The **run summary** posts a 6am briefing of what the orchestrator did overnight.

The digest and the run summary overlap enough that I kept almost merging them. I didn't — the digest is "everything about today," the run summary is "what the orchestrator did," and they go to different places for different reasons. Resisting that merge was the right call.

## The bug: Whisper on Apple Silicon

The framework came together cleanly. The thing that bit me was a dependency detail.

`faster-whisper` was configured with `compute_type=float16`. It loaded fine, it passed tests with mocked audio, and then the first real `.m4a` file hit it during smoke testing and it fell over. The reason: `faster-whisper` runs on CTranslate2, and CTranslate2 has no Metal backend on Apple Silicon. `float16` wasn't actually accelerated — it was a configuration that looked right and wasn't.

The fix was `compute_type=int8` and pre-downloading the large-v3 model so the first transcription wasn't also a 3GB download. Two-line change. But it's the same lesson the orchestrator kept teaching: the integration points lie. The library accepted `float16` without complaint and only the real workload exposed that the hardware path underneath didn't exist.

## What I deliberately didn't build

A general task queue. It would have been tempting to make "the worker framework" into a proper job system — priorities, retries, a dashboard, dynamic worker registration. There are six workers. I know all six. A registry function that constructs them and a supervisor that watches them is the entire need. The day there's a seventh worker that genuinely doesn't fit, I'll reconsider — but building the abstraction before the second hard case is just building the wrong abstraction early.
