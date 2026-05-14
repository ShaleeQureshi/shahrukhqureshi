---
title: Running it overnight
date: 2026-05-06
---

The whole point of Jarvis was to have something work while I sleep. Getting from "the orchestrator runs once" to "I can queue a few projects, go to bed, and trust the results in the morning" was a stage of its own.

This is what went into making it actually unattended.

## The shape of an overnight session

What I want from an overnight run:

1. I queue a few projects before going to bed.
2. The orchestrator works through them with controlled parallelism.
3. Resource limits keep the machine from melting.
4. A daily API budget cap keeps it from burning through my quota.
5. If anything crashes, the next run still happens.
6. In the morning, I get a single Discord message summarizing what got done.

Everything below is what each of those bullets actually required.

## The queue

The queue is a SQLite table — priority, project name, timestamps, status. `jarvis run myproject` doesn't execute anything anymore; it enqueues. A separate runner process consumes the queue. (`--now` keeps the old synchronous path when I want to watch a single run live.)

This sounds like minor refactoring. It isn't. The split lets me queue runs at any time, from anywhere, without the runner needing to be alive yet. "Queue before bed, let the runner pick them up, sleep" only works if enqueue and execute are separate.

Dequeue is atomic — the queue grabs its next item inside a `BEGIN IMMEDIATE` transaction, so two consumers can't pick the same run. Ordering is priority first, then FIFO within a priority. No clever scheduling, no project weights, no fairness — just a priority field I can set per project. Projects are validated at enqueue time, not at execute time, so a typo'd project name fails immediately instead of at 3am.

## The resource gate

Before starting any run, the runner checks, cheapest check first so it can short-circuit:

- Concurrent run count (capped, configurable)
- Daily Claude API invocation budget
- Free memory — refuse to start a new run under ~4GB free
- Free disk — refuse under ~2GB free

These checks happen *at start*. Once a run is in flight, the gate doesn't kill it — killing a live process is how you lose data. There's also a separate disk warning: when `data/runs/` grows past 5GB, the runner posts a throttled heads-up so the artifact directory doesn't quietly fill the disk.

The budget cap is the most important one. It's a per-day counter of Claude CLI invocations that survives restarts. The default is conservative. When I want to push more work on a specific night, `jarvis budget override` lifts the cap for 24 hours — and typing the number is deliberate friction, a moment to actually think about it.

## Concurrent runs

The default is 2. The Mac Studio can technically run more Claude Code sessions in parallel, but with the judge model also resident, memory pressure climbs, parallel test runners contend on the SSD, and you give back most of the time you thought you gained. Two is the sweet spot — and it matches how I think about projects anyway. I'd rather two get all the way through than four limp along.

## Memory monitoring

The resource gate is a *start-time* check. It says nothing about what happens once runs are in flight. So there's a separate memory monitor: a 60-second `psutil` poll that warns when free memory drops past ~2GB and panic-pauses the queue at ~1GB. Panic-pause stops *new* starts; in-flight runs keep going. Resuming is manual — if the machine got that tight, I want to know why before it picks back up.

## Notification coalescing

The first overnight run taught me that parallel runs finish in bursts, and every iteration of every run wanted to post a status update. I woke up to a wall of text.

The fix is a 5-second coalescing window — the same batching pattern the vault watcher already used for filesystem events. When a run completes, its notification is held briefly; if another completion lands in that window, they merge into one message. The bursty completion pattern gets smoothed into a couple of morning notifications instead of a scroll.

A longer window would coalesce more but feels sluggish when I'm watching live. 5 seconds was the compromise.

## Crash recovery

The orchestrator can crash. The Mac can reboot. macOS can decide to update at 3am. Whatever the cause, on startup the runner does one thing: it scans for runs still marked `running` whose process is no longer alive, marks each one `failed`, and posts a notification. Queued runs are untouched — they just get picked up. The orphaned worktrees stay where they are so I can inspect them in the morning; cleanup is manual.

I deliberately did not build resumption. If a run crashes mid-iteration, the worktree state is unknown, the judge may have evaluated something there's no record of, and Claude Code may have left partial changes. Resuming from that is more dangerous than re-queueing. Mark it failed, log the reason, let me decide.

## Claude CLI timeouts

The other failure mode was the `claude` CLI hanging — the process alive but no longer producing output. The wallclock cap eventually kills it, but I was seeing the same project hang twice in a row before the queue moved on.

The fix was tracking *consecutive* timeouts per run. After two consecutive Claude CLI timeouts in the same run, the run is marked `blocked` with reason `repeated_claude_timeouts` and the queue moves on. No more retries on a run that's clearly stuck.

This caught a real problem — a project whose prompt sent Claude into a tool-calling loop. Without consecutive-timeout tracking, it would have eaten a whole night's budget on one project.

## The morning summary

A worker fires at 6am. It pulls the overnight runs and posts a single Discord message — something like:

```
Overnight summary — 4 runs

✓ project-a (3 iters, 14m)
✓ project-b (5 iters, 28m)
✗ project-c (blocked: repeated_claude_timeouts)
✓ project-d (2 iters, 9m)

Costs: 23 Claude invocations
```

If the overnight window was empty, it skips the post entirely — no "nothing happened" message. It tracks a watermark so it doesn't double-report. And it's deliberately separate from the daily digest: the run summary is "what the orchestrator did," the digest is "everything about today." Different focus, different channel. I considered merging them after a week. Didn't.

## What the first acceptance run actually looked like

The Stage 5 acceptance test ran three toy projects against real Claude under `max_concurrent=2`. End state: all three completed, 2:17 wallclock.

But that clean number is the *second* run. The first attempt surfaced three bugs in a row. One was a bad test fixture — a toy project's requirements file was missing its acceptance-criteria header, so there was nothing for the judge to grade against. The other two were real: `execute_run` was allocating a second run row for queue-started runs, and the pre-loop setup code had no error handler, so a setup failure left a row stuck at `running` and wedged the resource gate.

Fixing those is its own story. The point here is that "queue three projects and walk away" only became trustworthy *after* the acceptance test broke it three different ways first. That's what the test was for.

Going to sleep and waking up to a Discord message with a list of green checkmarks is what makes this whole thing worth building. Getting there meant first making it safe to be wrong.
