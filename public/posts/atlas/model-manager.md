---
title: One large model at a time
date: 2026-05-08
---

The Mac Studio has 96GB of unified memory. That sounds like a lot. It is, until you start loading 70B models.

A Llama 3.3 70B at Q4 is about 42GB on disk. In memory it's a bit more once you account for KV cache and runtime overhead. A Qwen 2.5 32B Coder is around 20GB. Plus the embedding model. Plus Whisper, occasionally. Plus the OS and the apps and the browser tabs.

Two large models hot at once means swapping into system memory, and the moment that happens, token generation drops by an order of magnitude.

So Atlas has a constraint: one large model at a time. The model manager exists to enforce it without making the UX terrible.

## The shape of the problem

Without a manager, what happens is:

1. User starts a conversation with the 32B
2. User clicks "switch to 70B" mid-chat
3. App naively unloads the 32B and loads the 70B
4. Meanwhile, two other request queues are still trying to use the 32B
5. Errors everywhere, or — worse — both models partially loaded, swapping like crazy, every response taking 90 seconds

The naive approach assumes loading is atomic. It isn't. Ollama can hold multiple models warm if memory allows, and it can also evict them under pressure in ways that are hard to predict. You need a layer above Ollama that knows which models count as "large" and serializes access.

## What the manager does

The model manager has three jobs:

1. Track which large model is currently loaded
2. Queue requests during a model swap
3. Tell the UI what's happening

There's a registry of models, each tagged as `small` (under 8GB) or `large` (over 8GB). Small models can be loaded freely — multiple at a time, no contention. Large models go through the manager.

When a request comes in for a large model:

- If that model is already loaded, the request proceeds immediately.
- If a different large model is loaded, the request goes into a queue and the manager kicks off a swap.
- If no large model is loaded, it loads the requested one and proceeds.

Swaps look like: unload the current large model, wait for confirmation, load the new one, wait for the first token to confirm warmup, drain the queue.

## What goes wrong

Three things, in order of how often they happen.

**Requests pile up during a swap.** If five tabs are mid-conversation when I switch from 32B to 70B, those five conversations all want the new model the moment it's ready. The queue handles ordering, but if there are too many, the first conversation back online waits 8 seconds, and the fifth waits 30. Not great.

The fix was a per-conversation token cap during drain — each queued conversation gets up to N tokens of generation before yielding to the next one. The drain becomes round-robin instead of FIFO. No conversation waits forever for one long response to finish.

**Ollama gets confused about what's loaded.** Ollama has its own keep-alive logic, and sometimes it evicts a model the manager thinks is still warm. The manager catches this by checking before each request — if the model isn't actually loaded, force a load and continue. Costs a few extra seconds occasionally, but prevents the "I asked the 32B and got the 8B's response style" failure mode.

**Cold loads are slow.** First load of a 70B model is 12–18 seconds. The first token after that takes another 4–6 seconds because the prompt has to be processed. The UI shows both stages — "loading model" then "processing" — so the user knows what's happening.

## The UX cost

This is the part I want to be honest about: model switching in Atlas is not free.

ChatGPT can switch from GPT-4 to GPT-4o instantaneously because both are running on infrastructure with effectively infinite memory. My machine cannot. When I click "switch to 70B" mid-conversation, there is a visible 6–12 second pause. The UI is honest about it — a banner appears, a spinner runs, the timestamp on the next message shows the delay.

There are two reasons I keep it this way instead of, say, locking myself to one model.

First, the comparison is genuinely useful. When I want to know whether the 70B is actually better than the 32B on a specific prompt, I switch and resend. The friction is acceptable because the answer is informative.

Second, the swap is honest. A faster, more polished swap would hide a real constraint of the machine. I'd rather see the seam.

## What I'd change

The thing I'd build next is **predictive preloading**. If I'm typing a long message and the manager can guess from the conversation history that I'll want a particular model, it could start loading before I hit send. Most of the time the prediction would be wrong and it'd waste a load. But for the cases where it's right, the swap is invisible.

I haven't built it because the heuristics are tricky and the wrong prediction wastes 15 seconds. The current explicit-switch UX is honest and predictable. Worth more than a clever load that gets it wrong half the time.

## Why this isn't a Jarvis problem

Jarvis runs a fixed model set — Qwen3 8B router (small, always hot), Qwen 2.5 32B judge (large, mostly hot during overnight runs), Claude over the CLI (no local memory cost). Atlas is the place where model choice is dynamic.

Two services on the same machine, same models, different access patterns. The manager is what lets them coexist without fighting over the GPU.
