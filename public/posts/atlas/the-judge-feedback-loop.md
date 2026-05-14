---
title: Watching the judge loop fail
date: 2026-05-11
---

Almost every line of Atlas was built by Jarvis's orchestrator — Claude Code does the work, a local judge model reads the result, and the loop runs until it passes. I wrote about that loop from the Jarvis side. This post is the Atlas side: what it looked like to watch the loop fail, over and over, in every way a judge loop can fail.

None of these were failures of the judge's *reasoning*. They were almost all failures of what the judge could *see*.

## Failure one: the diff drowned the judge

Early on, the judge kept asking for things that were right in front of it — "please provide the requirements," "include the diff" — when the requirements file and the diff were both already in the prompt.

The cause was `uv.lock`. The lockfile was 72% of the diff — about 101KB of a 139KB diff — and the judge model's context window is roughly 16K tokens. The actual code changes were getting pushed out of the window by a wall of dependency hashes. The judge wasn't being dense; it genuinely couldn't see the code.

The fix was a `.gitattributes` entry marking lockfiles as binary, so they collapse to a one-line "binary file changed" in the diff. The diff dropped to 38KB, the code came back into view, and the judge started grading the actual work.

## Failure two: it hallucinated evidence

Sometimes the judge didn't ask for missing information — it invented it.

On one Stage 8 run, the judge marked 10 of 13 acceptance criteria as failed or unclear, despite every feature being shipped and every test green. Reading its reasoning, it cited specific evidence — a `+import { cn }` line — that *did not exist in the diff*. It was a 1049-line diff, again past the context budget, and the judge had filled the gap with a plausible hallucination instead of an honest "I can't tell."

There was a related version where the judge returned empty criterion checks with text lifted verbatim from the orchestrator's own correction-prompt template — it had pattern-matched its way to an output shape without doing any grading at all.

The workaround was almost stupid: add a per-criterion evidence file at the repo root — `STAGE8.md` — that maps each acceptance criterion to the exact file and line that satisfies it. The trick is the filename. An uppercase `S` sorts before lowercase letters in `git diff`, so the evidence file appears *first* in the diff the judge reads. The judge sees the map before it sees the territory.

## Failure three: it couldn't read the test output

Another recurring one: the judge couldn't map tests to acceptance criteria, so it kept asking for "test output covering different input types" — when the tests existed and passed.

The cause was a `-q` flag. The backend's test config ran pytest in quiet mode, which suppresses individual test *names*. All the judge saw in the truncated stdout tail was a count — "115 passed" — with no way to connect `test_router_classifies_news_as_gemini` to the acceptance criterion about news routing.

The fix was to run the tests verbose, so every test name is visible and the judge can match `test_chat_local_with_rag_returns_citations` to the criterion it proves. Same tests, same results — just legible.

## Failure four: the loop with no memory

The most maddening one wasn't a misread. It was amnesia.

On a Stage 4 run, the judge gave the same feedback on iteration 3, then iteration 4, then 5, then 6 — "confirm the npm scripts and tsconfig are configured." Each time, they *were* configured; each time, I verified and resubmitted with no code change; each time, the judge asked again. It had no memory that it had already accepted this on the previous pass. And because the cumulative diff kept growing with each iteration, every pass through gave the judge *less* attention budget for a question it had already answered.

This is the one that drove a real fix back on the Jarvis side. The judge had only ever seen `prior_feedback` as a string — never its own prior per-criterion *verdicts*. So the orchestrator started threading `prior_verdict_checks` through: the judge now sees which criteria it already passed, with an instruction to treat a prior pass as a strong prior. The loop stopped re-litigating settled questions.

(There was a smaller-scale echo of all this in a string of `CodeBlock` re-verifications — the judge asking, six times running, for syntax highlighting that was already implemented and unchanged. Same root: a judge with no memory of its own last verdict, re-asking a settled question.)

## The actual lesson

Line these up and the pattern is unmistakable. The diff was too big to see. The evidence wasn't where the judge looked first. The test names were suppressed. The prior verdicts weren't carried forward. **Not one of these was the judge being bad at judging.** Every single one was about the judge's *inputs* — context budget, evidence ordering, output legibility, memory.

I'd built the judge loop thinking the hard part would be the judging. It wasn't. The hard part was *information design* — making sure the right things were inside the context window, near the top, legible, and remembered. The model was fine. The pipeline feeding it was where all the work turned out to be.

## What I'd change

I'd build the context budget in as a first-class concern, not a thing I discover when a lockfile eats the window. A judge prompt should be *assembled* deliberately — evidence first, code second, generated noise stripped or summarized, prior verdicts always included — with a hard token budget enforced before the prompt is ever sent. Every fix in this post was me retrofitting one piece of that discipline after the loop had already failed for the lack of it. Next time it's the design, not the patch.
