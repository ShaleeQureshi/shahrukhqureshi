---
title: Owning the whole voice loop
date: 2026-05-27
---

After the latency campaign, the glasses worked. Push the touchpad, ask a question, get an answer in two to four seconds. But "works" and "feels finished" are different claims, and the gap between them turned out to be three phases of work — all on the iPhone side, almost none of it about the Mac.

This post covers phases 4.5 through 4.7: moving text-to-speech onto the phone, letting the user pick their own speech models, and replacing push-to-talk with a hands-free conversation mode.

## Phase 4.5: the last server-side dependency

At the end of phase 4.4, the pipeline was: WhisperKit transcribes on the phone, the Mac streams Claude's reply as text, and Piper on the Mac synthesizes each sentence into WAV chunks that get base64-shipped back over NDJSON.

That last part bothered me. Speech synthesis was the only stage left that ran on the Mac but produced output for the phone. Every reply paid to ship audio over the network that the phone could have generated itself — and iOS has a perfectly good synthesizer sitting in `AVSpeechSynthesizer`, with system voices the user already knows.

So phase 4.5 added a `tts_target` field to the stream request. When it's `client`, the Mac skips Piper entirely and the NDJSON stream carries only text events. On the phone, a new `LocalTtsPlayer` queues sentence chunks into `AVSpeechSynthesizer` as they arrive.

The wins stack up nicely:

- **Less network.** Text events are tiny; base64 WAV chunks are not.
- **Tighter sentence-boundary lag.** The phone starts speaking a sentence the moment its text arrives, instead of waiting for the Mac to synthesize and ship it.
- **Voice choice for free.** Every voice installed on the phone — including the Premium and Enhanced neural ones Apple ships — is now available to Jarvis.

The Mac-side Piper path stayed, behind the same flag, because a fallback that costs nothing to keep is a fallback you keep.

## The Bluetooth speaker ate my phonemes

Then the bug reports started — from me, the only user. Replies through the glasses' speakers were clipping the first syllable and sometimes the last one. "It's 10:26 PM" came out as "...s 10:26 P."

The cause is Bluetooth A2DP wake-up latency. When the audio route has been idle, the glasses' speakers take somewhere between 150 and 300 milliseconds to actually start rendering after iOS begins playback. The synthesizer doesn't know that. It starts speaking into a pipe that isn't open yet, and those phonemes are just gone. The trailing clip was the same story in reverse — the audio engine winding down too aggressively at utterance end.

The fix is embarrassingly analog: padding. The first utterance of each queue cycle gets `preUtteranceDelay = 0.25s` — a quarter second of silence for the speaker to wake up in. Every utterance gets `postUtteranceDelay = 0.08s` as a trailing pad. And the default speech rate came down to 0.92×, because at 1.0 the system voices read like they're late for something.

None of this is detectable in the simulator or through wired headphones. You only find it wearing the actual glasses.

## Phase 4.5.3: kill the silent fallbacks

While testing, I noticed some queries were still hitting the old `/ask-audio/stream` endpoint — the one that runs Whisper on the Mac. Three fallback branches on the iOS side (model not ready, transcription threw, empty transcript) were silently diverting to the server path.

Silent fallbacks are how you end up debugging the wrong pipeline. All three got removed. The view model now routes 100% of queries through `/ask-text/stream`; transcription errors surface as a visible failed state instead of a quiet detour; and the PTT button simply disables until WhisperKit reports ready. The server-side audio route still exists — for curl smoke tests and the simulator — but the phone never uses it.

## Phase 4.6: let the user pick the tradeoff

WhisperKit was hardcoded to `small.en`. Fine for me in a quiet room; not a decision the code should be making for every device.

Phase 4.6 added a model picker with a catalog of seven Whisper variants, from `tiny` up to `large-v3`, each annotated with disk size, RAM footprint, and rough accuracy/latency notes. The interesting part is the safety badge: the picker reads `ProcessInfo.physicalMemory` and labels each model **Safe**, **Tight**, or **OOM Risk** for the specific phone it's running on. A 4 GB iPhone 13 sees different warnings than a 8 GB Pro. Picking a new model shows download size and an ETA, then hot-swaps the transcription pipeline.

The default changed too: `small.en` gave way to `distil-large-v3` — 750 MB, roughly 95% of large-v3's accuracy, and still Safe on a 4 GB device. Anyone who had already picked a model keeps their choice.

The follow-up patch fixed the load UI, which had been showing a progress badge stuck at 10% while a 1.5 GB model downloaded behind it. The all-in-one WhisperKit init call gave no progress between "started" and "done," so the fix was splitting the load into three observable phases — download (with real percentages), compile for the Neural Engine, prewarm — each with its own status line. Same work, but now the badge tells the truth.

## Phase 4.7: hands-free

Push-to-talk means the phone is in your hand, which undercuts the entire premise of glasses. Phase 4.7 replaced tap-per-query with a conversation mode: one tap to enter, then open dialogue.

The pieces:

- **A voice activity detector** — RMS energy over the mic stream, with a configurable silence window that decides when you've finished a sentence. No ML model; thresholding is enough when the mic is on your face.
- **Continuous capture with a pre-roll buffer.** The recorder is always running inside a conversation, keeping the last fraction of a second in memory, so the first phonemes of an utterance aren't lost while the VAD is still deciding you've started talking. Same class of bug as the Bluetooth clipping, solved the same way: keep audio you might need before you know you need it.
- **A five-phase state machine** — idle, listening, user speaking, processing, Jarvis speaking. The mic is muted while Jarvis talks, because otherwise the VAD hears the glasses' own speakers and the assistant starts responding to itself.
- **A 60-second auto-exit timer**, so a conversation you walked away from doesn't leave the mic hot.

The cost of the mic-mute is that there's no barge-in — you can't interrupt Jarvis mid-reply, you wait it out. Fixing that properly means echo cancellation against the TTS output rather than a blunt mute, and that's a later problem.

## Where this leaves the pipeline

Everything the user experiences — speech recognition, speech synthesis, turn-taking — now runs on the phone. The Mac contributes exactly one thing: intelligence. Audio never crosses the network in either direction; the entire Mac round-trip is text.

That division of labor wasn't the plan at the start. The plan was "the Mac does everything, the phone is a dumb pipe." Five phases of latency work and three phases of polish later, the phone does everything except think. It's a better architecture than the one I designed.
