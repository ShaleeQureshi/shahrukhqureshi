---
title: Putting Jarvis in my Ray-Bans
date: 2026-05-21
---

I bought a pair of Ray-Ban Meta Gen 2 glasses with the intent of skipping the Meta AI assistant entirely and routing everything through my own stack instead. Same hardware, different brain.

This is the first post about that project. The codebase lives at `~/Glasses` and talks to the existing Jarvis server on the Mac Studio. The glasses themselves are unmodified — no jailbreak, no firmware patching. Everything happens in a companion iOS app and over the local network.

## Why not just use Meta AI

Three reasons, in order of weight.

**It doesn't know me.** Meta AI has no read access to my Obsidian vault, my calendar, my email, my projects, my running list of decisions. When I ask it something contextual, it answers like a stranger.

**It can't reach my tools.** I have an MCP-driven orchestrator that can read GCal, search Gmail, kick off a Claude Code run, file a brain intake, look up a person I met two weeks ago. None of that is available to Meta AI.

**I don't want my voice and camera streams on someone else's servers.** Open-loop voice into a cloud assistant is fine for "what's the weather" but worse for anything I'd actually like to ask. The glasses' camera and mic should be subject to the same privacy gate I've already built into Jarvis — local first, escalate only when needed, never for tagged-personal content.

So Jarvis-in-the-glasses isn't a wholly new product. It's the existing Jarvis brain wearing a new interface.

## The hard constraint

The Ray-Ban Meta SDK is called DAT (Developer Access Toolkit), and it's mobile-only. iOS or Android. The glasses cannot talk to a Mac directly, full stop — no Bluetooth pairing API on macOS, no LE GATT services we can read, no USB. If you want to move audio and images off the glasses to a Mac, you go through a phone.

That makes the architecture a three-hop pipeline:

```
Ray-Ban Meta  ─BT─►  iPhone  ─HTTP─►  Mac Studio (Jarvis)
```

The phone is dumb. It's a relay with a permission flow on top. The brain lives on the Mac.

I wanted to be wrong about this, so I spent the better part of a day reading the DAT iOS sample apps, the Android equivalents, and the L2CAP profile the glasses expose. The conclusion held: there is no first-party way to skip the phone. Even Meta's own AI assistant on the glasses uses your phone as the network egress.

Once I accepted that, the design got simple. The phone is a network adapter with a battery.

## What "Jarvis on glasses" actually means

A push-to-talk session looks like this:

1. I tap the glasses' touchpad. The iPhone app's PTT button fires.
2. The phone opens a BT HFP audio route to the glasses, captures the mic stream, and runs a local Whisper transcription as I speak. (Mac-side Whisper was the original plan; more on this in a later post.)
3. When I let go, the phone POSTs the transcript text — and a flag saying whether a recent photo should ride along — to a FastAPI endpoint on the Mac.
4. The Mac feeds the text into a long-lived Claude subprocess running on my Max plan, streams the tokens back chunk by chunk, pipes each chunk through Piper TTS, and returns audio as NDJSON.
5. The iPhone plays the audio chunks back through the glasses' speakers as they arrive.

Cold latency the first time was around 25 seconds. The current warm number is 2 to 4. The story of cutting that down 10× is its own post.

The "and a flag for a recent photo" bit is the multimodal hook. The glasses have a camera button. If I take a photo within 60 seconds of asking a question, the photo gets attached as a Claude image block. "What's this?" works.

## What I'm not building

A few things I'd like to but aren't on the roadmap yet.

- **Real-time conversational voice.** Push-to-talk is the v1 interaction. Wake-word ("Hey Jarvis") is designed and may ship; full duplex conversation is a research project.
- **Standalone glasses operation.** Phone has to be near. No offline mode.
- **Recording sessions for transcription.** The glasses have a long-press capture mode for video. I'm not wiring that yet. Privacy posture around continuous capture deserves a separate, deliberate decision.
- **Replacing Meta AI in the touch-and-hold flow.** The official Meta AI is still bound to long-press on the right temple, and that's untouchable from the DAT SDK. My Jarvis path lives next to it, not in place of it.

## What's next in these posts

The next three are about the parts that took the longest:

- **The phone in the middle.** How the iOS companion app and the Mac endpoint actually talk to each other. Why I picked HTTP and not a WebSocket, why I run a token through a local-only port, and the four-hour debugging session caused by an out-of-date firmware on the glasses.
- **Cutting 25 seconds to 2.** The latency campaign across five phases. Whisper on the phone, persistent Claude subprocesses, sentence-buffered TTS, NDJSON streaming.
- **Photos as context.** Multimodal Claude prompts, the recent-photo tracker, and the surprising failure mode where the glasses' wide-angle camera makes models hallucinate edges.

If you want a one-screen summary of where this lands: I can ask my AI assistant a question from the sidewalk, get an answer in two seconds that knows what I'm looking at, and never see a Meta logo. That's the bar.
