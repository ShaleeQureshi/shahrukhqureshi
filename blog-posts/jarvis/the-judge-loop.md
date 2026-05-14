---
title: The judge loop
date: 2026-05-02
---

The single most useful thing in the orchestrator is the judge. It's also the part I've had to go back and fix the most times.

The shape of it is simple: Claude Code does work, a local model reads what it did, and decides whether to accept it or send Claude back with feedback. The simplicity is the point. The interesting parts are everything around it.

## What the judge does

A local Qwen 2.5 32B Coder, running in JSON mode, gets three things per iteration:

1. The diff Claude Code just produced
2. The output of the project's test command
3. The acceptance criteria written for this specific project

And returns:

```json
{
  "verdict": "pass" | "fail",
  "reasoning": "...",
  "feedback_for_next_iteration": "..."
}
```

If `pass`, the run is done. If `fail`, the feedback gets injected into the next Claude Code invocation and the loop continues. The judge module is pure — it doesn't touch the database — and it retries exactly once on a JSON parse failure before giving up.

## Why a local model for the judge

The obvious question: if Claude is doing the work, why use a different model to evaluate it? Why not have Claude check itself?

A few reasons.

**Cost.** A run with six iterations and a Claude self-check after each one doubles the API spend. With a local judge, the evaluation is free.

**Independence.** Models tend to be more forgiving of their own output than someone else's. The local judge has no skin in the game — it reads the diff and the tests and forms an opinion.

**Capping.** The judge enforces a hard structural boundary. Claude Code is open-ended; it can spin on a problem for a long time. The judge says "this passes acceptance" or "here's specifically what's broken," and that becomes the next iteration's input. The loop has structure because the judge gives it structure.

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
  - "No new top-level dependencies without a comment justifying them"
  - "Diff is under 400 lines unless the task is a refactor"
```

Specific, machine-checkable-ish criteria turn the judge into a useful filter. Vague criteria turn it into a yes-man.

## The bugs that taught me things

Two bugs surfaced the first time I ran live acceptance tests against real projects.

**The JSON-fence problem.** Qwen wraps JSON output in markdown code fences a meaningful percentage of the time, even in JSON mode. A naive `json.loads(response)` blows up on `` ```json\n{...}\n``` ``. The fix was a `strip_markdown_fences` helper, later pulled out into its own `json_parse` module so the orchestrator and the judge share one parser. It strips fences, finds the first `{`, and parses from there.

**The empty-diff problem.** The original implementation captured the diff with `git diff <start_commit>..HEAD`. This always returned empty, because Claude Code doesn't commit anything — it just edits files. The fix was `git add -A` followed by `git diff --cached`, which captures all staged changes including new files. This sounds obvious in retrospect. It was an hour of "why is the judge always seeing an empty diff."

The pattern in both cases: the integration points lie. Models lie about their output format. Tools have invisible defaults. The judge loop was correct in design; the bugs were at the seams.

## The loop that wouldn't converge

The most expensive failure mode showed up later, and it wasn't a crash — it was a loop that kept giving the *same feedback* iteration after iteration without ever passing.

The root cause: the judge only ever saw `prior_feedback` as a string. It never saw its own prior *checks* — which acceptance criteria it had already marked as passing. So on iteration four, looking at a diff that had only grown since iteration one, it would re-litigate criteria it had already accepted. Each pass through, the cumulative diff got bigger and the judge's attention got thinner.

The fix was to thread `prior_verdict_checks` through the judge and the iteration runner — the judge now sees its own per-criterion verdicts from previous iterations, with a system rule that says to treat a prior `pass` as a strong prior. The carry-forward survives non-judge iteration failures too, so a transient test-runner error doesn't wipe the judge's memory of what it already accepted.

There was a related dead-wire bug. Projects can set a `judge_extra_context` field in their YAML — a place to put project-specific judging rules. The field was being loaded into the project config and snapshotted into the database, and then never actually passed to the judge. Every project's carefully written judging rules were being silently ignored. Wiring it through — a `# Project Context` section at the top of the judge's prompt that frames everything after it — was a five-line change that should have been there from the start.

Both of these are the same lesson as the JSON fences and the empty diff, one level up: the data was *almost* flowing correctly. It got loaded, it got stored, it just didn't make the last hop into the prompt.

## What I'm still tuning

Calibration. The judge is biased toward `pass` for certain kinds of work and toward `fail` for anything touching tests. It's not catastrophic — I review what got accepted overnight — but I'd like the verdicts to be more uniformly trustworthy. The plan is structured logging of judge verdicts against my own override decisions, so I can see which way it leans and refine the criteria rather than the model.

Either way, the judge loop is the part of Jarvis I'd extract first if I were doing this again. It's the most reusable piece. Almost any AI workflow that goes longer than one step benefits from a judge in the loop — and, it turns out, from a judge that remembers what it already decided.
