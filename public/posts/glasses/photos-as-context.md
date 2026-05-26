---
title: Photos as context
date: 2026-05-24
---

The Ray-Ban Meta glasses have a camera on the right temple and a hardware button that triggers a capture. The DAT SDK exposes that capture to my iOS app: I press the button on the glasses, a JPEG lands in my app's photo handler about a second later.

The interesting question is what to do with it once the photo arrives. This post is about wiring those photos in as context for the assistant — without making the assistant constantly think about photos that aren't relevant.

## The two-call shape

The pattern I landed on is two endpoints, not one.

`POST /photo` accepts a multipart upload, writes the JPEG to `data/glasses/photos/<timestamp>.jpg` on the Mac, and updates a "latest photo" pointer. It returns 200 immediately. No analysis. No model call. Just disk.

`POST /ask-text/stream` — the voice query endpoint — gains a new boolean: `attach_latest_photo`. When set, the server resolves the latest-photo pointer, base64-encodes the JPEG, and attaches it as a Claude image block in the user message.

The split matters because the upload and the question almost never happen at the same instant. I take a photo of a wine label. Five seconds later, I PTT-ask "what should I pair this with." The photo upload should not block the voice round trip, and the voice round trip should not have to wait for a model to look at the photo unless I'm actually asking about it.

Two calls. The first is fire-and-forget; the second is the hot path that may or may not pull the first along for the ride.

## The recent-photo window

The simplest version of "attach the latest photo" attaches whatever photo is on disk. That's wrong. If I took a photo this morning and then asked Jarvis at lunch about something unrelated, the morning photo would smuggle into the prompt.

The model is a 60-second window. On the iOS side there's a `RecentPhotoTracker` that timestamps every successful upload. When a voice query starts, the tracker checks: "is there a photo from within the last 60 seconds?" If yes, the POST sets `attach_latest_photo: true`. If no, it doesn't.

That's the entire logic on the iPhone:

```swift
let attach = recentPhotoTracker.hasPhotoWithin(60)
let body: [String: Any] = [
    "text": transcript,
    "attach_latest_photo": attach,
]
```

I considered alternatives — a manual toggle in the app, a hotword like "this," letting the user say "with the photo" — and they all felt worse. The 60-second window is a reasonable proxy for "the user has just looked at something they want to ask about," and it's invisible UX. No buttons, no incantations.

Latest-photo-only. There's no queue. If I take three photos in 30 seconds and then ask a question, the model sees the third one. The first two are still on disk for later but they don't enter the conversation. This matches the way I actually use it: the photo I just took is the one I'm asking about.

## What the model sees

Claude's CLI accepts image blocks in the same JSON event format it uses for text. With the persistent subprocess from phase 4.4, the prompt looks like this on the wire:

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {"type": "image", "source": {"type": "base64",
       "media_type": "image/jpeg", "data": "..."}},
      {"type": "text", "text": "what should i pair this with"}
    ]
  }
}
```

Image first, text second. I tested both orderings and Claude is meaningfully more grounded when the image precedes the question — the text reads as a follow-up rather than a free-floating prompt.

On the wire this added about a second to the round trip on a typical glasses photo (~150 KB JPEG, 2592×1944). End-to-end warm latency for a photo-attached query: 4.4s, versus 3.4s for text-only.

## The transcript event carries a flag

I added a debug field to the streamed transcript event:

```json
{"event": "transcript", "text": "...", "photo_used": true}
```

This was for me, not for the model. The iOS app displays a tiny indicator in the transcript view when `photo_used` is true. Without that signal, I had no way to tell — from the reply alone — whether the model had seen the photo or had just generated something plausible about wine. Once the signal was there, I caught two bugs in an hour: a stale-pointer bug where photos older than 60 seconds were sneaking in, and a write race where the photo upload was still in-flight when the question hit.

The debug field stayed in production. It costs nothing and saves a lot of "is this hallucinating" doubt.

## What surprises me

A few things I didn't expect.

**The glasses' camera is wide-angle, and Claude does badly with edges.** A photo of a person across a room is fine. A photo of a sign on a wall, taken at an oblique angle from a few feet away, often gets misread — the model fills in plausible characters for ones that are stretched or out of frame. Centering the subject matters more on the glasses than on a phone camera because there's no viewfinder.

**Verbal "this" works better than expected.** Phrasing like "what's this," "what does this say," "tell me about this" reliably triggers Claude to use the image. I expected to need stricter language. I didn't.

**Asking about photos I haven't taken yet doesn't work.** Obvious in retrospect. If I PTT-ask "what's that over there" and then take the photo, the photo arrives after the question is already in flight. The 60-second window only looks backward. The fix would be a deferred-completion pattern where the question waits up to N seconds for a photo, but in practice I just learned to take the photo first.

## What's not in here

A few things I deliberately don't do.

- **No always-on camera.** The glasses' camera is on only when I press the button. No timelapse, no rolling buffer, no background capture. The privacy posture is "I deliberately captured this."
- **No photo OCR pre-pass.** Some pipelines OCR the image and pass the text to the model alongside the image. I send raw JPEG and let Claude do its own visual reasoning. Adds latency for marginal accuracy gain on the kinds of photos I take.
- **No video.** The glasses can capture short video. I haven't wired it. Multimodal video through Claude is technically supported and operationally a different beast — I'm leaving it for a phase that's about ambient capture rather than punctual query.

## Where this lands

Phase 5 was the last big multimodal piece and it's the one that makes the glasses feel like a fundamentally different assistant than the one in my phone. The phone always knows what I typed. The glasses know what I'm looking at. The 60-second window is a quiet, dumb mechanism that gets the join between those two streams right almost all the time.

There's a phase 6 that's about wake-word and background mode — letting me say "Jarvis" without holding a button down. That's the next chunk. The latency floor is mostly already in; the remaining work is about removing the last manual gesture.
