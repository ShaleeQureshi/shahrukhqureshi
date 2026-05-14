---
title: Running it overnight
date: 2026-05-04
---

The whole point of Jarvis was to have something work while I sleep. Getting from "the orchestrator runs once" to "I can queue five projects, go to bed, and trust the results in the morning" was a stage of its own.

This is what went into making it actually unattended.

## The shape of an overnight session

What I want from an overnight run:

1. I queue 3–5 projects before going to bed.
2. The orchestrator works through them sequentially or with controlled parallelism.
3. Resource limits keep the machine from melting.
4. Daily API budget caps keep it from burning through my Max plan quota.
5. If anything crashes, the next run still happens.
6. At 6am, I get a single Discord message summarizing what got done.

Everything below is what each of those bullets actually required.

## The queue

Behind the scenes the queue is a SQLite table with priority, project name, timestamps, and status. `jarvis run myproject` doesn't execute anything anymore — it just enqueues. A separate runner process consumes the queue.

This sounds like minor refactoring. It isn't. The split lets me queue runs at any time, from anywhere, without the bot needing to be alive. "Queue before bed, start the bot, sleep" only works if these are separate.

Priority matters more than you'd think. If I queue five projects and two are time-sensitive, those two should finish first. The runner picks by `(priority DESC, created_at ASC)` and that's it. No clever scheduling, no project weights, no fairness — just a priority field I can set per project in its config.

## The resource gate

Before starting any run, the runner checks:

- Available memory (refuse to start if under 8GB free)
- Concurrent run count (cap at 2 by default, configurable)
- Daily Claude API invocation budget (refuse to start if today's count is at the cap)
- Disk space in `data/runs/` (warn at 5GB, hard-block at 20GB)

These checks happen at start. Once a run is in flight, the gate doesn't kill it — if memory drops mid-run, the queue pauses new starts but the in-flight run keeps going. Killing live processes is how you lose data.

The budget cap is the most important one. It's a per-day counter of Claude CLI invocations that survives restarts. Default is conservative (30–40 per day). When I want to burn through more work on a specific night, I run `jarvis budget override 100` and it lifts the cap for 24 hours. The override is a deliberate friction — typing the number forces me to think about it.

## Concurrent runs

The default is 2. I tried 4. The Mac Studio can technically run 4 Claude Code sessions in parallel, but:

- Memory pressure goes from "comfortable" to "ehh" with the judge model loaded
- Discord notifications start arriving in storms, which is annoying
- Test runners contend on the SSD enough that you lose any time you gained

2 is the sweet spot. It also matches how I think about projects — I'd rather two get all the way through than four limp along.

## Notification coalescing

The first overnight run produced 47 Discord messages between 1am and 6am. Every iteration of every run sent a status update. I woke up to a wall of text.

The fix was a 5-second buffer. When a run completes, the notification is held for 5 seconds before posting. If another completion arrives in that window, they're combined into one message. The bursty completion pattern of parallel runs gets smoothed into 2–3 morning notifications instead of 47.

A 30-second buffer would coalesce more, but felt too slow when I was watching live. 5 seconds was a good compromise.

## Crash recovery

The orchestrator can crash. The Mac can reboot. macOS can decide to update at 3am. Whatever the cause, on startup the runner does one thing:

```python
# any 'running' rows whose process is dead get marked failed
SELECT id, pid FROM runs WHERE status = 'running';
# for each, check if pid is alive; if not, mark failed
```

The orphaned worktrees stay where they are. I can inspect them in the morning. No automatic cleanup — that's manual via `jarvis runs cleanup`.

I deliberately did not build resumption. If a run crashes mid-iteration, the worktree state is unknown, the judge may have already evaluated something I don't have a record of, and Claude Code may have left partial changes. Trying to resume is more dangerous than re-queueing. Mark it failed, log the reason, let me decide.

## Claude CLI timeouts

The other failure mode was Claude CLI hanging. Sometimes a session just stops producing output — the process is alive, but it's not doing anything useful. The wallclock cap eventually kills it, but I was seeing the same project hang twice in a row before the next one started.

The fix was tracking consecutive timeouts per run. After 2 consecutive Claude CLI timeouts in the same run, the run is marked `blocked` with reason `repeated_claude_timeouts`. No more retries. The queue moves on.

This caught a real bug — one of my projects had a prompt that consistently sent Claude into an infinite tool-calling loop. Without the timeout tracking, it would have eaten an entire night's budget on one project.

## The morning summary

A worker fires at 6am every day. It pulls all runs from the last 12 hours and posts a single Discord message:

```
Overnight summary — 5 runs

✓ laurier-flow (3 iters, 14m)
✓ atlas (5 iters, 28m) 
✗ jarvis (blocked: repeated_claude_timeouts)
✓ northhacks (2 iters, 9m)
✗ astar-visualizer (failed acceptance, 8 iters)

Costs: 23 Claude invocations, 0/40 budget remaining
```

This and the regular daily digest are deliberately separate. Run summary is "what the orchestrator did." Daily digest is "everything about today" — runs plus calendar plus vault changes plus intakes. Different channels, different focus. I considered merging them after a week. Didn't.

## What the first real overnight test was like

I queued 3 projects. Two had decent acceptance criteria. The third had vague criteria — "tests should pass" — which I knew was a problem and wanted to see how the system handled it.

Morning summary: 2 passes, 1 in 9 iterations (yes — over the iteration cap, the loop should have stopped it, that was a bug), 1 actual cleanup needed. The 9-iteration run was the one with vague acceptance criteria. The judge kept finding new things to complain about because nothing was definitionally "done."

Fixed the iteration cap enforcement that night. Tightened the acceptance criteria for the third project the next morning. The system worked the way it should have on the second overnight test.

Going to sleep and waking up to a Discord message with a list of green checkmarks is what makes this whole thing worth building.
