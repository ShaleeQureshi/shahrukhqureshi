---
title: One large model at a time
date: 2026-05-08
---

The Mac Studio has 96GB of unified memory. That sounds like a lot. It is — until you start loading 70B models.

A Llama 3.3 70B at Q4 is about 42GB. A Qwen 2.5 32B Coder is around 20GB. Plus the embedding model, plus Whisper occasionally, plus the OS and the browser and everything else. Two large models hot at once means swapping into system memory, and the moment that happens, token generation drops by an order of magnitude.

So Atlas has a constraint: one large model at a time. The model manager exists to enforce it. This post is about what it does — and the long stretch where it didn't actually do it.

## What the manager is for

The manager tracks which model is currently loaded, swaps to a different one when needed, and tells the UI what's happening during the swap. There's a `ModelSelector` in the chat UI and a `ModelsPanel` in settings; behind them, the manager owns the actual load/unload against Ollama so two parts of the app can't fight over the GPU.

That was the design from Stage 3. The selector existed, the panel existed, the manager existed. Clicking a model in the UI called `/models/load`, and `/models/load` correctly swapped what Ollama had resident.

And then the next message in the conversation used the wrong model anyway.

## The bug: a manager that didn't manage

This one took a while to see, because every individual piece was working.

Clicking "switch to the 70B" really did load the 70B. `/models/load` did its job. The manager's record of "currently loaded" updated. If you checked, the 70B was resident.

But the chat request that came next didn't *say* which model it wanted. The request body had no `model` field. So the chat handler did what it had always done — fell back to `config.ollama.default_model`. The user had switched models; the conversation hadn't heard about it.

Worse: the manager had methods for exactly this — `remember()` to record the user's choice, `remembered()` to read it back. They existed. They were just *dead code* in the chat path. Nothing called them. The manager could remember a preference and nobody ever asked it to.

So the picture was: a model selector that loaded models, a manager that could track preferences, and a chat path that ignored both and used the config default. Three correct components, zero correct behavior, because the `model` field never flowed from the click to the request.

## The fix: thread the field all the way through

The fix wasn't clever, it was just *complete* — wire the `model` field from one end to the other and give it a real resolution order.

The frontend lifts the selected model up into the chat root component, persists it to `localStorage` so it survives a reload, and forwards it on every request. The chat request gains an optional `model` field. And the backend resolves which model to actually use with an explicit precedence:

```
payload model  →  remembered model  →  currently loaded  →  config default
```

The request wins if it specified something. Failing that, the manager's *remembered* choice. Failing that, whatever's already loaded. Failing all of it, the config default — which is now genuinely a last resort instead of the silent first answer.

With the field flowing, the manager's other methods finally get called: `swap()` runs before the stream starts if a model change is needed, `remember()` runs after a successful response so the choice sticks. The dead code came alive because the data finally reached it.

## The UX cost

Model switching in Atlas is not free, and I want to be honest about that.

ChatGPT switches models instantly because it runs on infrastructure with effectively infinite memory. My machine does not. When the manager swaps from the 32B to the 70B, there's a real, visible pause — the old model unloads, the new one loads, the first token takes a beat longer because the prompt has to be processed cold. The UI shows the swap happening rather than hiding it behind a spinner that pretends nothing's wrong.

I keep it this way on purpose. The comparison is genuinely useful — when I want to know whether the 70B beats the 32B on a specific prompt, I switch and resend, and the friction is worth the answer. And the swap being *visible* is honest: it's a real constraint of the machine, and a slicker swap would just be hiding the seam.

## What I'd change

The thing I'd build is a louder contract between the frontend's idea of "the current model" and the backend's. The whole bug was a quiet disagreement — the UI thought one thing, the chat path assumed another, and nothing reconciled them until I went looking. I'd want the resolved model echoed back on every response and rendered in the UI, so a divergence is visible immediately instead of being something you only catch when an answer feels off.

The structured `chat.model_resolved` log was the first step toward that. Putting it on the screen is the next one.

## Why this isn't a Jarvis problem

Jarvis runs a fixed model set — a small router model always hot, a 32B judge mostly hot during overnight runs, Claude over the CLI with no local memory cost. The model choice is static; there's nothing to manage.

Atlas is the place where model choice is dynamic, which is the place where it can quietly go wrong. Same machine, same models, different access pattern — and the access pattern is what made the manager necessary, and what made its silence so easy to miss.
