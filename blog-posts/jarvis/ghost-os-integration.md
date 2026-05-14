---
title: Giving Jarvis a screen — Ghost OS
date: 2026-05-08
---

Everything Jarvis did so far was text in, text out. It could read files, run models, orchestrate code — but it couldn't *see* anything. This stage wired in Ghost OS, a macOS GUI automation layer, so Jarvis could look at the screen and operate apps.

The interesting part wasn't the automation. It was keeping a capability that powerful strictly optional, strictly serialized, and strictly out of the parts of the system where it doesn't belong.

## Ghost OS is a tool, not a dependency

The first decision: Ghost OS is an MCP tool server. It is never embedded code inside Jarvis. Jarvis reaches it the same way it reaches the calendar or email — through MCP, and only through MCP.

That matters because it makes the capability *removable*. Jarvis runs completely without Ghost OS. The daemon can be stopped, uninstalled, or never set up at all, and nothing core breaks. Everything that touches the screen degrades gracefully when it's gone.

The capability is opt-in per request. The router has a few examples that teach it to recognize a GUI task and set `needs_mcp` to include `ghost-os`. If a message doesn't ask for the screen, the screen never enters the picture — there's no GUI guidance in the prompt, no daemon call, nothing. A capability that's always available is a capability that's always a risk; this one is only present when something explicitly asked for it.

## One screen, one workflow

There is exactly one screen on this machine, and GUI automation is inherently stateful — you can't have two workflows both clicking around at once. So every GUI workflow serializes on a single semaphore. Orchestrator visual verification, the brain audit's GUI step, recipe runs, recipe learning — all of them share one lock. Only one thing drives the screen at a time, by construction.

Layered on top of that is a runtime health probe. `jarvis doctor` catches a *missing* Ghost OS registration, but it can't catch a daemon that was running and stopped. The health probe does — a fast `ghost status` check, cached for a minute so it isn't hammered, that every GUI verb consults before it tries anything. If Ghost OS isn't actually up, the verb says so cleanly instead of timing out.

## Visual verification

The first real use was closing a gap in the orchestrator. The judge reads diffs and test output — but for a project with a UI, "the tests pass" and "the screen looks right" are different claims.

So a project config can declare visual verification: a set of checks that run *between* the judge's pass and the database write. Claude takes a screenshot, a verifier evaluates it against the declared checks, and — if the project marked verification as blocking — a failed visual check moves the run to `BLOCKED` even though the judge passed it. The screenshot gets uploaded straight into the Discord status channel, so the morning summary can show me the actual pixels, not just a verdict.

## The brain auditor

The second use was auditing the wiki — and it's where the "Ghost OS is optional" rule got its sharpest test.

Auditing the brain has two halves. One is pure static analysis: parsing the wiki's markdown, walking its wikilinks, finding the ones that point at nothing. That half is plain Python — no screen, no Ghost OS, always available. The other half is visual: actually opening a note in Obsidian and looking at how it renders.

The static half is the default. The visual half is opt-in. An auditor that *required* a running GUI daemon to tell me a link was broken would be an auditor I'd stop using the first week. The static analysis runs after every ingest, blocking, before the result is even announced — and the first time it ran against the real wiki, it found six genuinely broken wikilinks.

One more invariant here: the auditor *observes* the brain through a screenshot. It never *edits* the brain through Obsidian's UI. Brain mutations go through the bridge, full stop — Ghost OS is read-only with respect to the wiki. A tool that can click anything is exactly the tool you don't let near your knowledge base's write path.

## Recipes are operational, not knowledge

Ghost OS can record a workflow — watch me do a thing once, save it, replay it. Those saved workflows are recipes, and the question was where they live.

Not in the brain. The brain is curated knowledge with a strict schema and write rules. A recipe is operational state — a sequence of clicks. It lives in Ghost OS's own recipe directory, where the daemon looks it up by name. Jarvis ships a handful of recipe templates in the repo that can be installed into that directory, but they're code-adjacent artifacts, not wiki content. Keeping that line clear means the brain's write invariants never have to bend to accommodate automation.

## Optional, all the way down

The through-line of the whole integration: Ghost OS never gets to be load-bearing.

- `jarvis doctor` *warns* about a missing Ghost OS. It never fails on it.
- The runtime probe gates every verb — unavailable means "skip cleanly," not "crash."
- The orchestrator skips visual verification silently when the daemon is down.
- The brain auditor treats an unavailable daemon as a warning and returns its static-only result as a success.

The cost reporter even grew a line for Ghost OS time, because GUI automation is slow and I wanted that cost visible.

## What I deliberately didn't build

Autonomy. Ghost OS *can* click anything on the screen, and it would have been tempting to let Jarvis just... operate the machine — open apps, file things, drive workflows on its own initiative. I didn't. Every GUI action traces back to an explicit request: a verb I typed, a verification a project config declared, an audit I asked for. The screen is the most powerful and most dangerous thing Jarvis can touch, so it only touches it when told. The capability is real; the leash is the design.
