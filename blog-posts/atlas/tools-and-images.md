---
title: Tools and images, without the leaks
date: 2026-05-09
---

Two features landed in Atlas around the same time: tool calls and image uploads. They look unrelated — one is "ask about the weather," the other is "drag a screenshot into the chat." But they shipped together because they share a design constraint. Both are ways for a message to touch the outside world, and both had to do it without leaking anything off the machine.

## The tools

Behind the TOOL route there are three tools: weather, places, and web search. A dispatcher takes the routed message, picks the tool, runs it, and streams the result back as part of the chat response — a tool summary, then a final structured payload the UI can render as a tool card.

Each tool declares its `REQUIRED_FIELDS`, so the dispatcher can tell whether a message actually has what the tool needs before calling it. And — this is the part I like — each tool has a **mock fallback for when its API key is absent**.

That mock fallback isn't a testing convenience. It's the default state. I built Atlas to be useful before I'd signed up for a single API key. Ask it for the weather with no weather key configured, and it returns a plausible mock result and says so, rather than erroring or nagging me to go get a key. The real provider slots in when I add the key; until then the feature *exists*, it's just honest about being stubbed.

Web search is the clearest example: it got a DuckDuckGo provider that needs no key at all, lazy-imported so it doesn't cost anything until a search actually happens, with the same mock fallback behind it. The places tool learned to handle "mosque near me," "hotel near X," "pharmacy near here" — the queries I actually type.

Tools are also individually toggleable. There's a `tool_toggles` table, a toggle endpoint, and enable/disable controls in the settings panel. If I don't want web search active, it's off, and the router won't route to it. A tool I'm not using shouldn't be a tool that can fire.

## The images

Image upload is the VISION route's input. The frontend handles it the way you'd expect — drag-and-drop, paste, an upload button, a thumbnail preview, a full-size modal, the ability to remove it before sending. There's type and size validation before anything happens.

The part that matters is where the image *goes*, which is: nowhere.

Image storage is `localStorage`-only on the frontend. There is no `fetch` that uploads the file anywhere. The browser holds it. When a message with an image is sent, the backend gets a *path*, not the bytes — and the backend is explicitly built to forward the path and never perform a cloud upload. A migration added a `messages.image_path` column precisely so that what's persisted is a reference, not the image itself. On reload, the message bubble re-renders the thumbnail from local storage.

The effect: I can paste a screenshot of something personal into Atlas, have a local multimodal model look at it, and know — by construction, not by policy — that the image never left the Studio. The only way it goes anywhere is if the VISION route hands it to Gemini, and that's a route, a logged decision, something I can see.

## The shared constraint

This is why the two features are one post. Atlas talks to the outside world in exactly two ways here — external tool APIs, and (optionally) a multimodal cloud model — and both were designed so the *default* is "nothing leaves."

Tools default to mock results with no keys, so the absence of configuration is a working feature, not a broken one. Images default to local-only storage with path-only forwarding, so the absence of an explicit VISION route means the bytes stay put. In both cases, sending data outward is the deliberate, visible path, and keeping it local is the one you get for free.

That's the same instinct as Jarvis's privacy gate, just expressed in a different shape. Jarvis filters the vault before it talks to Claude. Atlas makes "local" the floor that tools and images sit on, and makes reaching past it something the system has to *choose* to do.

## What I deliberately didn't build

A plugin system. It would have been natural to make "tools" into a real extensibility surface — a registry, a manifest format, third-party tool definitions. There are three tools. I wrote all three. A dispatcher with a `REQUIRED_FIELDS` convention and a mock fallback is the entire abstraction the current need supports. The day I want a tool that genuinely doesn't fit that shape, I'll grow the framework to fit it — and not one feature before.
