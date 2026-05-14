---
title: The router and the Gemini path
date: 2026-05-06
---

Every message in Atlas gets routed before it gets answered. The router decides whether a message goes to a local model, to Gemini, to a tool, to the vault, or to a multimodal path for images. This post is about how that decision gets made — and the bug that made the Gemini path silently not exist for a while.

## A pattern matcher, not a model

Jarvis routes with a local LLM. Atlas doesn't. Atlas's router is a pattern matcher — a set of rules that classify a message by what it looks like.

That sounds primitive next to "ask a model." It's deliberate. A web chat UI is interactive; the user is sitting there waiting. Spending a full model round-trip just to *decide where to send the message* adds latency to every single turn. A pattern matcher classifies in microseconds, and when it logs a decision it can say exactly *which* pattern matched — which makes it debuggable in a way an LLM classifier's "vibes" never are.

The routes:

- **LOCAL** — the default. Ollama answers it.
- **LOCAL_WITH_RAG** — the message touches my vault; retrieve notes, then answer locally.
- **GEMINI** — needs internet or current information.
- **TOOL** — weather, places, web search.
- **VISION** — there's an image attached; needs a multimodal model.
- **VAULT_WRITE** — save something into the vault.

The router was built against a few dozen parametrized test cases — "what's in the news today" → GEMINI, "what's the weather in London" → TOOL, "explain this code" → LOCAL, an image attachment → VISION — so its behavior is pinned by tests, not by hope.

## Logging the decision

Every routed message emits a structured `router.decision` log: the route, the reason, the pattern that matched, whether an image was present, a preview of the message. When the router *can't* cleanly decide and falls back, it emits `router.fallback` with an explicit reason — `tool_stub`, `gemini_unavailable_for_vision`, `gemini_unconfigured`, `gemini_rate_limited`.

Those fallback reasons exist because "the router sent it to LOCAL" is not, by itself, useful information. *Why* did it land on LOCAL? Because that's genuinely where it belonged, or because Gemini was unconfigured and LOCAL was the consolation prize? Those are completely different situations, and only one of them is a bug. The fallback reason is what tells them apart.

Hold onto that. It's the whole post.

## The Gemini client

The Gemini path goes through a client with one job beyond calling the API: tracking quota. Gemini's free tier has limits, and blowing past them mid-conversation is a bad experience. The client keeps a usage count in SQLite — it survives restarts, and the router can check it and fall back to LOCAL with reason `gemini_rate_limited` *before* making a doomed call.

The streaming function is dependency-injected, which sounds like over-engineering for a personal app but pays for itself in tests — the whole Gemini path can be exercised without a network call or an API key.

## The route indicator

On the frontend, every message bubble shows the route it took. A `route_taken` column rides along with each stored message, and the UI renders it — "Gemini · 2.0 Flash," "Local," and so on.

This started as a debugging aid and became something I rely on. When an answer is wrong, the first question is always *which model said this*. Showing the route inline means I never have to guess.

## The bug: a path that wasn't there

Here's where the fallback reasons earn their keep.

For a stretch, Gemini just... didn't work. Every message that should have gone to Gemini fell back to Ollama instead. The logs said `router.fallback`, reason `gemini_unconfigured`. The router was behaving correctly — it was being told Gemini wasn't configured, so it routed around it.

The root cause wasn't in the router, or the Gemini client, or the routing rules. It was that `backend/.env` — the file with the Gemini API key in it — was never being read. `load_dotenv()` wasn't called at startup, and `python-dotenv` wasn't even listed as a dependency. The key was sitting right there on disk, in the right file, and nothing loaded it. So the Gemini client initialized with no key, reported itself unconfigured, and the router dutifully fell back.

The fix was three lines: add the dependency, call `load_dotenv()` at the top of startup, and log whether the key loaded so this can never be a silent failure again. There's now a `/models/gemini-test` endpoint specifically so I can confirm the path is live without sending a real chat message.

What makes this worth a section: nothing *errored*. No exception, no red log line, no crash. The system degraded *gracefully* — exactly as designed — straight past the actual problem. The router's fallback machinery, which exists to make the system robust, also made the system robustly wrong. The only reason it was findable at all is that the fallback carried a *reason*: `gemini_unconfigured` pointed a finger at configuration, not code.

## What I'd change

I'd add a startup self-check that's louder than a log line. The dotenv fix means the key loads now, but the deeper lesson is that "configured" is a state the system should *assert* on boot, not discover on the first request that needs it. If Gemini is supposed to be available, the absence of its key should be a noisy startup warning — not a fallback reason I only see when I go looking.
