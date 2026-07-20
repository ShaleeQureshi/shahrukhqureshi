---
title: The router comes back
date: 2026-06-25
---

Back in the latency post I wrote that bypassing Jarvis's router was a tradeoff I was consciously taking: every glasses query went straight to Claude, including the privacy gate that was supposed to keep tagged-personal content local. "The brain-aware path is restored later — see phase 6.5."

This is phase 6.5. The router is back, the privacy gate is enforced again, and roughly 60% of my voice queries now never leave the Mac. This post is how that works and what it cost.

## The debt, stated plainly

`claude_only` mode was the right call for getting latency down, but it carried a correctness bug, not just a philosophical one: Jarvis's whole design says brain content tagged `personal`, `financial`, or `health` never goes to a cloud model. The Discord path enforces that in the router. The glasses path — the one where I'm literally wearing a microphone — skipped the router entirely.

For a month that was fine because I knew about it and asked the glasses accordingly. But "the user self-censors" is not an architecture, and the moment anyone else wears the glasses it's not even a mitigation.

## The hybrid pipeline

Phase 6.5 adds a second routing mode, `hybrid`, that puts the layers back in a shape tuned for voice latency:

1. **Router.** Qwen3 8B classifies the transcript: trivial or personal versus genuinely hard.
2. **Privacy gate.** The same `_should_block_claude` check the Discord path uses — reused, not reimplemented, because two privacy implementations means one of them is wrong. If the query touches tagged content, the Claude branch is off the table regardless of what the router thought.
3. **Brain RAG.** ChromaDB with BGE-large embeddings over the wiki, so local answers can actually cite what I know, not just what a 7B model remembers.
4. **Two backends.** Trivial and privacy-blocked queries stream from a local Qwen 2.5 7B responder through Ollama. Hard, public queries still go to the persistent Claude subprocess from phase 4.4, MCPs and all.

The stream protocol grew a `routing` event — the first NDJSON line after the transcript now says which backend got the query and why, including a `privacy_blocked` flag. The iOS app renders it as a small diagnostic strip, so when a reply feels off I can see at a glance whether I'm talking to Qwen or Claude.

The smoke test that matters: say "show me my medical history" into the glasses. The routing event comes back `target: local, privacy_blocked: true`, and Anthropic's servers never hear about it.

## What it cost in latency

Nothing on the Claude branch is free — hybrid mode inserts a router classification (~300ms) in front of queries that end up going to Claude anyway. On the local branch, the economics flip: a 7B model on the Studio's unified memory streams first tokens fast enough that trivial queries land at or below the Claude path's warm floor, without the network hop.

There's a design on the shelf — speculative routing, firing the router and a tentative Claude stream in parallel and cancelling the loser — that would hide the router cost entirely. I haven't built it. The 300ms is real but not felt, and the machinery to remove it would be the most complex code in the pipeline. Written down as phase 6.5.2, which is where clever ideas go to wait until they've earned their complexity.

## The gap I shipped anyway

Hybrid routing created a real hole: conversation memory is now split across two brains. The persistent Claude subprocess remembers the turns it handled. The local responder gets recent turns from the conversation store. But when a locally-handled turn is followed by an escalated one, Claude never saw the local turn — ask "what did you just tell me?" across a backend switch and Claude honestly doesn't know.

I shipped with the gap documented rather than holding the release, because the fix (re-priming Claude's session with recent turns from the store before an escalated query) is additive and the failure mode is a confused answer, not a privacy leak. Wrong answers are bugs; leaks are betrayals. Only one of them justifies blocking a correctness fix that's otherwise ready.

## Twenty-seven tests and a config flag

The whole thing lands behind one line of YAML — `routing_mode: hybrid` — with `claude_only` still the ship-safe default. Activation is: pull the responder model with Ollama, flip the flag, restart, and check that three banners print (persistent Claude, brain RAG warm, routing hybrid).

The test suite grew from 85 to 112: router classification, privacy-gate decisions, the local responder's streaming, and the Ollama client's new streaming path all got covered. The judge-loop discipline from the main Jarvis build paid off here — every routing decision is a pure function of the classification and the tags, so the tests don't need a model loaded to prove the gate holds.

## v1.0.0

With 6.5 in, I tagged the whole thing v1.0.0 and pushed both repos — the iOS companion app and the Mac-side platform code. That number is a statement of shape, not completeness: three-hop architecture, on-device speech in both directions, hybrid local/cloud routing with the privacy gate enforced, photos as context, 112 tests green.

The roadmap past it, in order of likelihood: wake word ("Hey Jarvis" via an on-device hotword detector, so the phone stays in the pocket entirely — deliberately sequenced after 6.5, because a wake word that makes it *easier* to talk to a pipeline with a privacy hole would have been backwards), cross-backend memory parity, speculative routing.

A year ago the pitch — say something to your glasses, a router on your own hardware decides whether the cloud gets to hear it, and either way you get an answer through your temples in a few seconds — would have sounded like a demo. It's now just how I check the weather.
