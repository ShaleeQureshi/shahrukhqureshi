---
title: Building the orchestrator
date: 2026-05-01
---

The orchestrator is the part of Jarvis that does actual project work. You queue a project, and it spawns a Claude Code session to work on it, checks the result, and loops until the work passes or it hits a cap.

This post is about the machinery underneath that — the worktrees, the loop, the test runner, and the one bug that taught me the loop had a seam in it.

## Worktrees, not branches

The first decision was isolation. If the orchestrator is going to run Claude Code against a project unattended, that session needs its own copy of the repo. It can't be editing files in the directory I'm also working in.

Git worktrees are the right primitive for this. A `WorktreeManager` creates a fresh worktree for each run, hands the path to the Claude Code session, captures the diff when the session finishes, and cleans the worktree up afterward. All of it runs through async git subprocesses so it never blocks the event loop.

One bug surfaced immediately: `git worktree remove` has to run with the working directory set to the *parent* repo, not the worktree being removed. Run it from inside the worktree and git refuses. Obvious once you've hit it, invisible until you do.

## The data layer

Every run is a row in SQLite. There's a `runs` table, an `iterations` table, a `verdicts` table, and a `run_artifacts` table, all created through a small migration runner so the schema is versioned rather than ad hoc.

The Python side is a set of frozen dataclasses — `RunStatus` as an enum, immutable run/iteration/verdict records, a sync repository class with the obvious CRUD methods. Nothing clever. The orchestrator does enough genuinely hard things that the persistence layer earns its keep by being boring.

## The test runner

Each project declares a test command in its config. The runner executes it as a shell command, async, with a hard wallclock timeout — and when that timeout fires, it sends `SIGKILL` to the whole process group, not just the immediate child. Test runners spawn workers; killing only the parent leaves orphans holding the SSD.

The other half of the test runner is parsing. Different projects emit different formats, so there are per-format parsers — jest, pytest's JSON output, JUnit XML, and a plain-text fallback that just captures pass/fail counts from the tail. The judge needs structured test results, not a wall of stdout, so the parsing happens here rather than being punted downstream.

## Capturing what Claude did

The Claude Code runner is an async wrapper over the `claude` CLI. It builds the iteration prompt — a different prompt for the first iteration than for subsequent ones — runs the session in the worktree, and persists the full stdout to `data/runs/{run_id}/iteration-{n}/`. When something goes wrong overnight, that directory is the record of what happened.

## The loop

The loop coordinator ties it together. For each run it drives: set up the worktree, run Claude Code, run the tests, send everything to the judge, read the verdict. On a pass, the run is done. On a fail, the judge's feedback becomes the next iteration's prompt.

Three things end the loop besides a pass:

- **Iteration cap** — a `for/else` over a bounded range; the `else` branch is the "ran out of iterations" path.
- **Wallclock cap** — checked against `time.monotonic()` at the top of each iteration, so a long Claude session can't blow past it unnoticed.
- **Stuck detector** — if the diff stops changing meaningfully between iterations, the loop gives up. A judge that keeps saying "fail" against an unchanging diff is not going to converge.

Each iteration wraps its body in error handling for the specific orchestrator exceptions — a worktree failure, a test-runner failure, a Claude failure, a judge failure all get caught and recorded rather than crashing the run.

## The bug at the seam

Here's the one that was instructive.

`execute_run` always started by writing a new run row. That was fine when runs were started one at a time from the CLI. But once a queue sat in front of the orchestrator, the queue *also* created a run row when you enqueued — so every queued run got two rows. One from the enqueue, one from `execute_run`.

The first symptom wasn't "duplicate rows." It was a run that looked stuck. The pre-loop setup — resolving acceptance criteria, creating the worktree — had no error handler around it. When it threw, the row was left at status `running` forever, and because the resource gate counts `running` rows, one bad run could wedge the whole queue.

The fix was two changes. `execute_run` got an optional `existing_run_id` argument: passed in, it adopts the row the queue already made; left out, it keeps the old single-shot behavior. And the pre-loop body got wrapped in a try/except that marks the run `failed` before re-raising, so a setup failure releases the gate instead of jamming it.

The pattern, again: the design was fine. The bug was at the seam between two components that were each individually correct — the CLI path and the queue path made different assumptions about who owns the run row.

## What I deliberately didn't build

Resumption. When a run crashes mid-iteration, the worktree state is genuinely unknown — Claude Code may have left partial edits, the test runner may have written half a result, the judge may have evaluated something there's no record of. Trying to resume from that is more dangerous than starting over. A crashed run gets marked failed, the worktree is left intact for me to inspect, and the project goes back in the queue if I still want it. The orchestrator's job is to be safe to leave alone, not to be clever about recovery.
