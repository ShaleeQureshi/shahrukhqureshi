---
title: The phone in the middle
date: 2026-05-22
---

The Ray-Ban Meta glasses don't talk to my Mac. They talk to my phone, and my phone talks to my Mac. This post is about the seam in the middle.

Three machines, three different jobs, and exactly one of them is doing real work.

## The roles

- **The glasses** capture audio over a Bluetooth HFP route and capture photos over an SDK call. They expose neither directly to anything but a paired phone.
- **The iPhone** runs a Swift app I wrote against Meta's DAT SDK. It is a relay: it accepts the BT streams, transcribes audio locally, and POSTs to the Mac. It also holds the keychain entry for the bearer token that lets it call the Mac.
- **The Mac Studio** runs a FastAPI server (`src/jarvis/interfaces/glasses/`) that exposes a small protocol: `/health`, `/photo`, `/ask-text/stream`, `/ask-audio/stream`. Behind those endpoints sits the same Jarvis brain that the Discord bot uses.

The iPhone app is deliberately thin. The DAT SDK has a learning curve and a particular permission flow, and I wanted to keep the surface area there as small as possible — fewer iOS bugs, more leverage on the Mac side where I'm faster.

## Picking a transport

I went back and forth on three options before landing.

**WebSocket streaming.** Felt right at first — open one persistent socket, push audio frames up, get text frames back. The deal-breaker: the iOS app needs to survive backgrounding and screen lock, and persistent sockets in that regime require background audio mode plus a constant heartbeat or the system will tear the socket. Not impossible. More plumbing than the use case justifies.

**gRPC over HTTP/2.** Considered, dismissed for the same reason plus tooling drag. The Mac side is plain Python; bringing protobuf into a single-user side project is overcorrection.

**Plain HTTP with NDJSON for streamed responses.** What I picked. The iPhone POSTs the user's transcript to `/ask-text/stream`, opens an `URLSession.bytes` stream on the response, and parses one JSON line per chunk as they arrive. Each chunk has a base64 WAV payload that the iPhone plays through the glasses. When the body closes, the turn is over. This survives backgrounding because each request is short-lived (2–10 seconds), and the connection model is the dumbest possible thing that works.

The protocol on the wire ends up looking like:

```
POST /ask-text/stream HTTP/1.1
Authorization: Bearer <local-token>
Content-Type: application/json

{"text": "what's the weather", "attach_latest_photo": false}

HTTP/1.1 200 OK
Content-Type: application/x-ndjson

{"event": "transcript", "text": "...", "photo_used": false}
{"event": "audio_chunk", "wav_base64": "...", "seq": 0}
{"event": "audio_chunk", "wav_base64": "...", "seq": 1}
{"event": "done"}
```

Boring. Inspectable with `curl`. Survives every network glitch I've thrown at it.

## Auth on a LAN

Because the Mac and the phone are on the same Tailscale network and never on the open internet, my first instinct was to skip auth entirely. I talked myself out of that quickly.

A coffee-shop Wi-Fi network is not a friendly LAN. If I happen to be on the same network as a hostile device, an unauthenticated endpoint at `http://mac-studio.tailnet:8765/photo` is an upload-arbitrary-files-to-disk vulnerability. So there's a 32-byte bearer token, generated on first server boot, stored in the iOS keychain on pairing, and required on every endpoint. The server prints a one-time banner with the token when it generates one. `jarvis glasses token rotate` regenerates it.

The token is the only auth. There's no user account. The iPhone owns the key; if the phone is stolen and unlocked, the attacker has access to my Mac's Jarvis endpoint, and that's an acceptable risk to me because the attacker also has my phone, which is a worse problem.

## The Phase 2 firmware bug

The thing that took longest in Phase 2 wasn't anything in my code. It was the glasses being out of date.

I built the iOS app skeleton overnight, hit "run" in Xcode the next morning, and got a `MWDATCore.PermissionError 1` on the photo smoke test. The error message was useless. Logs in Xcode showed an `Unknown error: 436` and an `L2CAP channel not found`. I spent four hours instrumenting permissions, deep-linking into Meta AI, regenerating the pairing, walking through the LSApplicationQueriesSchemes plist entries.

What actually fixed it: opening the Meta AI app on my phone, letting it tell me the glasses had a firmware update available, accepting the update, and waiting fifteen minutes. The DAT SDK's permission protocol depends on a daemon that ships with the glasses' firmware. The daemon I had was too old to negotiate the camera grant.

I have very little to say about this except that it cost a morning, and the only mention of it in the docs is a single sentence buried in a release-notes PDF. Worth the documentation cost for the next person.

## The Mac endpoint, in short

There are four routes on the Mac side, and three of them are dull.

- `GET /health` — JSON status. Reports whether the persistent Claude subprocess is alive, whether Piper is warmed, and whether text-streaming is available.
- `POST /photo` — multipart upload. Photo is written to disk under `data/glasses/photos/<timestamp>.jpg` and a "latest photo" pointer is updated. No analysis on upload — just a fast write.
- `POST /ask-audio/stream` — accepts a WAV blob, runs Whisper on the Mac, then chains into the same pipeline as ask-text. This is the fallback path when iPhone WhisperKit fails to load.
- `POST /ask-text/stream` — the hot path. Accepts a pre-transcribed string, optionally attaches the latest photo, streams audio back as NDJSON.

The whole module is around 600 lines of Python plus 19 tests, and the only state it carries is the long-lived Claude subprocess. Everything else is per-request.

## What I'd change

The split between `/ask-audio/stream` and `/ask-text/stream` is a wart. Two routes, one chain of work, gated by a coin flip on whether the iPhone could transcribe. If I were rebuilding it, I'd unify them into one endpoint that accepts either-or and dispatches internally. The reason I haven't is that the test surface for each route is small and stable, and I'd rather spend the refactor budget on phase 6.

The token-in-keychain model is fine for one user. For more, I'd want short-lived JWTs and a tiny enrollment flow. The point at which more-than-one becomes a real need is the point at which this isn't a personal project anymore, so I'm not building it ahead of time.

## What's next

Phone-in-the-middle was the architecture. The next post is the latency campaign — how the round trip went from 25 seconds to 2.
