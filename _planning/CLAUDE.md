# CLAUDE.md

Repo-level guidance for Claude Code working on the `Shahrukh` personal site.

---

## What this repo is

A personal website for Shahrukh Qureshi, deployed to GitHub Pages at **https://shaleequreshi.github.io/Shahrukh**. Built with Create React App and `react-router-dom`'s `HashRouter` (URLs use the `/#/path` pattern because GitHub Pages doesn't support history-mode routing without workarounds).

The site is being extended with a `/projects` blog section covering two ongoing projects:
- **Jarvis** — self-hosted AI server (LLM rig on consumer hardware)
- **Atlas** — catch-all for misc projects, scripts, and experiments

Posts are authored as markdown files served as static assets from `public/posts/`.

---

## Stack & conventions

- **Framework:** Create React App (CRA 5.x assumed — verify with `package.json`)
- **Router:** `react-router-dom` with `HashRouter`. Check the version in `package.json` before writing routes — v5 and v6 have different APIs:
  - v6: `<Route path="..." element={<Component />} />`
  - v5: `<Route exact path="..." component={Component} />`
- **Styling:** Plain CSS files imported per-component (no CSS-in-JS, no Tailwind unless `package.json` says otherwise — verify before assuming)
- **Markdown rendering:** `react-markdown` + `remark-gfm`. Do **not** install `gray-matter` — it has Node polyfill issues in CRA 5. Use the inline frontmatter regex parser shown in `PLAN.md` instead.
- **Deployment:** GitHub Pages via the `gh-pages` package (verify with `package.json` scripts). The `homepage` field in `package.json` must match the deployed URL or `process.env.PUBLIC_URL` resolution will break.

---

## Critical rules

### Do not break the existing site
This is a live personal site. When adding new code:
- Read 2–3 existing components before writing new ones to learn the conventions (functional vs class, default vs named exports, file naming, prop patterns).
- Do not modify existing components unless explicitly asked.
- The one exception is the router file (probably `App.js` or `index.js`) — adding new routes there is expected, but **show the diff before applying** and explain what you're changing.
- Do not change `package.json` beyond adding listed dependencies. Do not bump versions of existing packages without asking.

### Content is data, not code
- Posts live in `public/posts/<project>/<slug>.md`, not in `src/`. They're served as static files at runtime.
- The single source of truth for what posts exist is `public/posts/manifest.json`. Adding a post means adding a markdown file **and** adding an entry to the manifest.
- Do not import markdown files into JS modules (no `import md from './post.md'`). Fetch them at runtime via `fetch(`${process.env.PUBLIC_URL}/posts/...`)`.

### HashRouter quirks
- Internal links in markdown that point to other pages on the site must use the hash form: `[link](#/projects/jarvis/foo)`, not `[link](/projects/jarvis/foo)`.
- External links work normally.
- When testing locally, URLs look like `http://localhost:3000/#/projects` — the `/#/` is correct, not a bug.

### Aesthetic is locked in
The `/projects` section uses a terminal / dev-log aesthetic:
- Background `#0d1117`, elevated surfaces `#161b22`
- Borders `#21262d`, text `#c9d1d9`, muted `#8b949e`
- Mono font stack: `'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace`
- Accent colors per project (orange `#f0883e` for Jarvis, purple `#d2a8ff` for Atlas)
- ASCII headers, `$ ` prompts, blinking cursor

Don't introduce gradients, shadows, or color schemes that fight this. The rest of the site may have a different aesthetic — that's fine, the `.terminal` wrapper class scopes the new styles.

---

## Repo layout (relevant parts)

```
public/
  posts/
    manifest.json              ← source of truth for content
    jarvis/                    ← markdown posts
    atlas/                     ← markdown posts
src/
  pages/
    Projects/
      Projects.js              ← /projects index
      ProjectDetail.js         ← /projects/:project
      Post.js                  ← /projects/:project/:slug
      Projects.css             ← shared terminal theme
  App.js (or similar)          ← router setup lives here
package.json                   ← check "homepage" and react-router-dom version
PLAN.md                        ← full implementation plan
CLAUDE.md                      ← this file
```

---

## Workflow expectations

When asked to implement something multi-step:

1. **Reconnaissance first.** Before writing code, read the relevant existing files and report what you found. Mention the router version, code style observations, and any surprises in the repo layout.

2. **Work in stages.** If there's a `PLAN.md` or staged task list, follow it. After each stage, summarize what you did in 1–2 sentences and pause for explicit "continue" before moving on. Do not batch stages.

3. **Flag deviations.** If reality in the repo conflicts with the plan (different folder structure, missing dependency, version mismatch), stop and ask. Don't silently work around it.

4. **Test what you can.** After meaningful changes, run `npm start` and confirm the routes load. If a build fails, fix it before saying you're done.

---

## Common commands

```bash
# Install deps
npm install

# Dev server (defaults to localhost:3000)
npm start

# Production build
npm run build

# Deploy to GitHub Pages (assumes gh-pages script is set up)
npm run deploy
```

---

## Adding content after the section ships

This is what Shahrukh will do himself, but document it for context:

**Add a post:**
1. Create `public/posts/<project>/<slug>.md` with frontmatter (`title`, `date`)
2. Add an entry to that project's `posts` array in `manifest.json`
3. Commit, push, deploy

**Add a new project (beyond Jarvis + Atlas):**
1. Add a top-level key to `manifest.json` with `name`, `subtitle`, `description`, `tags`, `accent`, `posts: []`
2. Create `public/posts/<newproject>/` directory
3. Deploy — the index page picks it up automatically, no code changes

---

## Things to never do

- Don't install `gray-matter` (CRA polyfill issues — use the inline parser)
- Don't switch to `BrowserRouter` (breaks GitHub Pages deep linking)
- Don't put posts in `src/` (defeats the manifest-driven model)
- Don't hardcode the GitHub Pages path (`/Shahrukh/...`) anywhere — use `process.env.PUBLIC_URL` so the site works locally too
- Don't add a state management library (Redux, Zustand, etc.) for this — `useState` + `fetch` is sufficient
- Don't add TypeScript to the existing JS codebase unless explicitly asked
- Don't reformat existing files with a different style (no Prettier-on-save unless the repo already uses it)
