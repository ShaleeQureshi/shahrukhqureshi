---
title: The judge loop
date: 2026-05-02
---

The single most useful thing in the orchestrator is the judge. It's also the part that took the longest to make reliable.

The shape of it is simple: Claude Code does work, a local model reads what it did, and decides whether to accept it or send Claude back with feedback. The simplicity is the point. The interesting parts are everything around it.

## What the judge does

A local Qwen 2.5 32B Coder, running in JSON mode at temperature 0.2, gets three things per iteration:

1. The diff Claude Code just produced
2. The output of the project's test command
3. The acceptance criteria I wrote for this specific project

And returns:

```json
{
  "verdict": "pass" | "fail",
  "reasoning": "...",
  "feedback_for_next_iteration": "..."
}
```

If `pass`, the run is done. If `fail`, the feedback gets injected into the next Claude Code invocation and the loop continues. There are three caps:

- **Iteration cap** — usually 6–8, project-specific
- **Wallclock cap** — usually 30–60 minutes
- **Stuck detector** — if the diff stops changing meaningfully between iterations, abort

## Why a local model for the judge

The obvious question is: if Claude is doing the work, why use a different model to evaluate it? Why not have Claude check itself?

A few reasons.

**Cost.** A run with 6 iterations and a Claude self-check after each one doubles the API spend. With a local judge, the evaluation is free.

**Independence.** Models tend to be more forgiving of their own output than someone else's. The local judge has no skin in the game — it just reads the diff and the tests and forms an opinion.

**Speed.** A local 32B judge returns a verdict in 8–15 seconds. A Claude evaluation round-trip is 20–40s plus the prompt construction. Over 6 iterations that adds up.

**Capping.** The judge enforces a hard structural boundary. Claude Code is open-ended; it can spin on a problem for a long time. The judge says "this passes acceptance" or "here's specifically what's broken" and that becomes the next iteration's input. The loop has structure.

## The acceptance criteria

This is the part people don't talk about enough. The judge is only as good as what you tell it to look for.

Each project has a YAML config with an `acceptance` block. Bad criteria:

```yaml
acceptance:
  - "Code should be good"
  - "Tests should pass"
```

The judge will rubber-stamp almost anything against that. Better:

```yaml
acceptance:
  - "All tests in tests/ pass with no skipped or xfail markers"
  - "Public API in src/api.py is unchanged unless the task explicitly says otherwise"
  - "No new top-level dependencies in pyproject.toml without a comment justifying them"
  - "Diff is under 400 lines unless the task is a refactor"
```

Specific, machine-checkable-ish criteria turn the judge into a useful filter. Vague criteria turn it into a yes-man.

## The bugs that taught me things

Two bugs in particular were instructive.

**The JSON-fence problem.** Qwen wraps JSON output in markdown code fences a meaningful percentage of the time, even in JSON mode. A naive `json.loads(response)` blows up on `` ```json\n{...}\n``` ``. The fix was to extract a `parse_llm_json` utility that strips fences, finds the first `{`, walks to its matching `}`, and parses that. Now used in three places.

**The empty diff problem.** The original implementation captured the diff with `git diff <start_commit>..HEAD`. This always returned empty, because Claude Code doesn't commit anything — it just edits files. The fix was `git add -A` followed by `git diff --cached`, which captures all staged changes including new files. This sounds obvious in retrospect. It took an hour of "why is the judge always seeing an empty diff" to find.

The pattern in both cases: the integration points lie. Models lie about their output format. Tools have invisible defaults. The judge loop is mostly correct in design; the bugs were at the seams.

## Crash recovery

The orchestrator is supposed to run overnight unattended. That means it has to handle crashes — process kills, power flickers, OOMs, the machine deciding to install a Mac update.

The mechanism is unglamorous. When a run starts, the orchestrator writes a row to SQLite with status `running`. On clean completion, the status updates to `complete`, `failed`, or `blocked`. On crash, the row is orphaned.

On startup, the orchestrator scans for rows with status `running` whose process is no longer alive. Each one gets marked `failed` with a reason `crashed_during_run` and a notification gets posted to #status. The worktree is left intact so I can inspect it.

The thing I deliberately did **not** build is resumption. When a run crashes mid-iteration, the worktree state is unknown — Claude Code may have left partial changes, the test runner may have written half a result file, the judge may have already evaluated something I don't have a record of. Trying to resume is more dangerous than re-queueing. Mark it failed, log the reason, move on.

## The piece I'm still tuning

Calibration. The judge is biased toward `pass` for certain kinds of work (small refactors) and toward `fail` for others (anything touching tests). It's not catastrophic — I review what got accepted overnight — but I'd like the verdicts to be more uniformly trustworthy.

The current plan is to add structured logging of judge verdicts plus my override decisions. If I disagree with the judge on a meaningful percentage of runs, I should know which way it's biased and refine the acceptance criteria. If we agree most of the time, fine — leave it alone.

Either way, the judge loop is the part of Jarvis I'd extract first if I were doing this again. It's the most reusable piece. Almost any AI workflow that goes longer than one step benefits from a judge in the loop.
