---
title: Cutting 25 seconds to 2
date: 2026-05-23
---

The first end-to-end voice query through the glasses took 25 seconds.

I held the touchpad, said "what time is it," let go, and counted Mississippis until a reply came back through the temple speakers. Twenty-five. With a cold start, closer to 34. Unusable. The whole point of a wearable assistant is that asking it something is faster than pulling out your phone.

This post is the four-week campaign to get that number into the 2-to-4-second range. It's organized as five phases because that's how I shipped them, each one trimming a different chunk.

## Where the time was going

Before optimizing anything, I measured. The 25-second baseline broke down roughly:

- **Audio capture → upload (1s)** — fast enough.
- **Whisper on the Mac (4s)** — `faster-whisper` large-v3, float16, no preloaded model in memory.
- **Routing decision in Jarvis (2s)** — local Qwen3 8B classifier deciding if this is a tool-call, a brain question, etc.
- **Claude CLI startup + auth + reply (15s)** — every query spawned a fresh `claude --print` subprocess.
- **Piper TTS synthesis (3s)** — synthesizing the full reply before sending any audio.

The Claude bar was the giant. Each phase took one of these bars and crushed it.

## Phase 4.1: stop spawning Claude per query

The first thing I cut was the easiest in retrospect and the one I was most resistant to: the per-query routing.

The original design said _every_ query goes through Jarvis's local router. The router decides whether to answer from the brain, run a tool, or escalate to Claude. That's the right design for Discord. It's the wrong design for a voice query that's almost always going to need Claude anyway.

A new config flag — `routing_mode: claude_only` — bypasses the local router for the glasses path. Every query goes straight to Claude.

In tandem, I wrote a `ClaudeSessionManager` that captures a Claude session ID at server boot and reuses it on every query via `--resume <id>`. The auth flow runs once, on startup. Per-query, we spawn `claude --print --resume <id>` and read JSON output.

Warm latency dropped from 25 seconds to about 13.

The thing I'd flag to my past self: this looked like a downgrade. Bypassing the router means giving up Jarvis's brain-aware routing for voice queries, including the privacy gate that keeps tagged-personal content out of Claude's context. I'm fine with it for now because the things I ask the glasses are short and public ("how do I spell" / "what time" / "convert 80 fahrenheit"). The brain-aware path is restored later — see phase 6.5 in the roadmap doc.

## Phase 4.1.1: switch the default to Haiku

Sonnet was overkill for these queries. I added a `claude_model` field that defaults to `haiku`. Replies are noticeably terser ("It's 10:26 PM. Need help?") which is what you want from a voice assistant.

Warm latency was about the same as Sonnet — within 1 second. The bottleneck after phase 4.1 isn't model inference, it's CLI startup. Saving the model swap is a UX win, not a latency win.

## Phase 4.2: don't wait for the whole reply before speaking

A 15-word reply took Piper around 3 seconds to synthesize. A 50-word reply took 8 to 10. Waiting for the full reply before sending any audio adds the full TTS time to time-to-first-audio.

I added a streaming endpoint, `POST /ask-audio/stream`, that:

1. Spawns the Claude subprocess with `--output-format stream-json --verbose`, which emits tokens as they're generated.
2. Buffers tokens in Python until a sentence boundary (`.!?` followed by space) or 120 characters, whichever comes first.
3. Synthesizes each chunk through Piper and emits an NDJSON event with a base64 WAV.
4. On the iOS side, a new `StreamingAudioPlayer` uses `AVAudioPlayerNode` to play chunks back-to-back without gaps.

Piper is also pre-warmed at server boot — the first synthesis through a cold Piper takes about a second of voice-model loading.

Time-to-first-audio after Whisper finished: 3–5 seconds. The Whisper step itself was now the dominant cost.

## Phase 4.3: move Whisper to the phone

This was a directional decision. The Mac was running `faster-whisper` large-v3, which is accurate but takes 4 seconds for a typical 5-second query. There were two ways to go faster:

- **Whisper-turbo on the Mac** — same architecture, distilled model, ~3× faster but a real accuracy regression on short clips.
- **WhisperKit on the iPhone** — Apple's CoreML port of Whisper, runs on the Neural Engine. Transcription happens before any network call.

I picked WhisperKit. The reasoning: transcription on the phone is _parallelizable_ with the user releasing the touchpad. By the time the iPhone is ready to POST, the transcript is already done. The Mac round-trip is now text-only, which is dramatically cheaper than uploading a WAV.

This required refactoring the Mac side to expose `/ask-text/stream` as a separate route that skips Whisper. The original `/ask-audio/stream` route stayed as a fallback for when WhisperKit fails to load (model download timing, mainly).

On iOS, I added a `WhisperKitTranscriber` using the `openai_whisper-small.en` model (~244 MB, kicks off downloading on first launch via a loading badge in the UI).

Warm time-to-first-audio: 4.7 seconds. Whisper was no longer the dominant cost — CLI startup for Claude was.

## Phase 4.4: keep Claude running

`ClaudeSessionManager` was reusing the same session ID, but it was still spawning a fresh `claude --print` subprocess on every query. Each spawn paid for process startup, auth handshake, and reloading the conversation context from disk. Easy four to six seconds.

`claude --input-format stream-json` is a real flag. It accepts realtime streaming input over stdin: write JSON event lines, get JSON event lines back on stdout. Combined with `--output-format stream-json --verbose`, one subprocess can serve an unbounded number of queries.

The implementation is a class called `PersistentClaudeSession`:

- Spawned once at server boot.
- A lock serializes `stream_query` calls so two queries can't interleave on stdin/stdout.
- On any crash (broken pipe, dropped subprocess), it auto-respawns and the next query waits for the new session.
- On clean shutdown, it closes stdin so Claude exits gracefully.

Toggling between phase-4.1 spawn-per-query and phase-4.4 persistent is a single config flag (`glasses.claude_persistent`).

Live smoke test: three sequential queries on the glasses.

| Query | Time to first audio |
|-------|---------------------|
| Q1    | 3.36s               |
| Q2    | 3.94s               |
| Q3 (with continuity from Q1+Q2) | 2.34s |

Sub-three-second warm latency on the third turn was the first moment the glasses felt like a real assistant. The continuity matters too — Q3 referenced both prior turns ("the second thing I asked, what was the answer") and Claude pulled it correctly from the in-process subprocess context.

## The campaign in one table

| Phase | What changed | Warm latency to first audio |
|-------|--------------|-----------------------------|
| baseline | Spawn-per-query, Mac Whisper, full-reply TTS | ~25s |
| 4.1 | Bypass router, session reuse via `--resume` | ~13s |
| 4.2 | Sentence-buffered streaming TTS | Whisper-bound, ~7–9s |
| 4.3 | WhisperKit on iPhone, `/ask-text/stream` | 4.7s |
| 4.4 | Persistent Claude subprocess, stream-json input | 2–4s |

A 10× drop without changing models or buying hardware. Almost all of it came from removing per-query overhead — process startup, model loading, full-utterance buffering — none from making the actual inference faster.

## What I didn't optimize

A few obvious things I left on the table.

- **Pre-warming Whisper on Mac.** The fallback path still pays the cold-Whisper cost. Could load it at boot. Haven't, because the fallback is rare.
- **Caching common queries.** "What time is it" could be answered from Python in milliseconds without involving Claude at all. I don't do this because the muscle memory of "ask Jarvis" routing through Claude lets me change the answer ("what time is it, and is the gym open") without changing the wiring. Caching it would create a forking decision per query that I'd then have to maintain.
- **Speculative TTS.** While Claude is still generating, you could TTS-synthesize predicted next tokens speculatively and throw them away if Claude diverges. The complexity is way out of proportion to the savings, given that streaming already covers most of the gap.

## What's actually slow now

Network and Bluetooth, in that order.

The Mac round-trip on Tailscale is sub-100ms, but the BT audio route to the glasses adds variable latency on the playback side — sometimes the first chunk of audio takes an extra half-second to start playing after I have the data in hand on the phone. There's nothing I can do about that at the application layer.

I'm calling 2–4 seconds the floor for this design. Going below that means changing the design — bigger phone-side models, smaller cloud hops, or wake-word always-on rather than push-to-talk. Those are phase 6 problems.
