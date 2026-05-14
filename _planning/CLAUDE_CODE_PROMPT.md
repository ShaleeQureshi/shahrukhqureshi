# Prompt for Claude Code

Paste this prompt into Claude Code from the root of your `Shahrukh` repo. Have `PLAN.md` in the repo root (or pass it via `--add-dir`) before running.

---

## The prompt

```
I'm adding a new /projects blog section to my existing Create React App + HashRouter personal site (deployed to GitHub Pages at shaleequreshi.github.io/Shahrukh). The full plan is in PLAN.md at the repo root — read it first.

The plan covers 9 stages: dependencies → content → CSS → 3 React pages → router wiring → polish → deploy. I want you to execute stages 1 through 7. Stages 8 (polish) and 9 (deploy) I'll do manually after reviewing your work.

Important constraints:
- This is an existing repo. Do NOT modify any file outside the scope of the plan unless you absolutely must to make the new pages work. If you do need to touch an existing file (the one with <HashRouter> — Stage 7), show me the diff before applying it and explain why.
- Match the existing project's code style. Before writing the new components, read 2-3 existing components in src/ to learn the conventions (functional vs class, named vs default exports, file naming, etc.) and follow them.
- Check package.json to determine the react-router-dom version. Stage 7 has different syntax for v5 vs v6 — pick the right one.
- Check package.json for "homepage" — confirm it's set correctly for the GitHub Pages deployment before relying on process.env.PUBLIC_URL.
- The plan says to skip gray-matter and use the inline frontmatter parser. Do that — don't install gray-matter.
- All markdown files go in public/posts/ (not src/), so GitHub Pages serves them as static assets. The components fetch them at runtime via fetch().

Workflow I want you to follow:
1. Start by reading PLAN.md, package.json, the existing App.js / index.js (whichever has the router), and a couple of existing components for style reference. Tell me what you found before writing any code: the router version, the homepage value, the code style observations, and which file you'll need to modify in Stage 7.
2. Work stage by stage. After each stage, summarize what you did in one or two sentences and pause for me to say "continue" before moving on. This is non-negotiable — don't batch stages.
3. After Stage 7, run `npm start` (or tell me to) and confirm the three routes load: /#/projects, /#/projects/jarvis, /#/projects/jarvis/picking-the-gpu.

If anything in the plan conflicts with what you find in the actual repo (different folder structure, different conventions, etc.), stop and ask before deviating. The plan is a strong recommendation, not a contract.

Begin with Stage 0: the reconnaissance pass. Don't write any code yet — just report back what you found.
```

---

## Why this prompt is shaped this way

- **"Read the plan first"** — the plan does a lot of the heavy lifting so the prompt itself stays short.
- **"Execute stages 1–7, not 8–9"** — polish needs your eyes on the live site; deploy is a one-button thing you should do yourself after reviewing.
- **"Read existing code first"** — prevents Claude Code from inventing conventions that don't match your codebase.
- **"Pause between stages"** — agentic coding tools work much better with checkpoints. You catch divergence early instead of unwinding 200 lines of bad work.
- **"Stop and ask if reality conflicts with the plan"** — repos always have surprises (an unusual folder layout, a custom build setup, a Sass setup instead of plain CSS). Better for Claude Code to flag it than guess.
- **"Begin with Stage 0: reconnaissance"** — forces an upfront read pass before any writing. This single instruction usually catches 80% of the silly mistakes that would otherwise need cleanup.

---

## After Claude Code finishes

Things to spot-check yourself:

1. **Router version mismatch** — if your site uses React Router v5 but Claude Code wrote v6 syntax (or vice versa), routes will silently not match. Symptom: `/#/projects` shows a blank page or your 404 component.
2. **`PUBLIC_URL` resolution** — if `manifest.json` 404s in dev but works in prod (or vice versa), it's a `homepage` field issue in `package.json`.
3. **Global CSS leaking in** — if the terminal background looks gray instead of `#0d1117`, the existing site has a `body` background rule winning over the page. Add `background: #0d1117` to the `.terminal` wrapper or scope it tighter.
4. **HashRouter quirks** — internal markdown links should use `#/projects/...` not `/projects/...` because of the hash routing.
