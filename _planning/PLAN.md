# Jarvis + Atlas — Blog Section Implementation Plan

A staged plan for adding a `/projects` blog section to the existing personal site at [shaleequreshi.github.io/Shahrukh](https://shaleequreshi.github.io/Shahrukh/#/).

---

## Context

**Existing site:**
- Create React App (CRA) project
- Uses `HashRouter` (URLs look like `site.com/#/path`)
- Deployed to GitHub Pages at `shaleequreshi.github.io/Shahrukh`
- Repo: `github.com/ShaleeQureshi/Shahrukh`

**What we're adding:**
- A new `/projects` section showing two projects: **Jarvis** (AI server) and **Atlas** (misc projects)
- Each project has its own blog of markdown-authored posts
- Terminal / dev-log aesthetic (GitHub dark palette, mono font)
- Manifest-driven content: add a post = drop an `.md` file + one JSON entry

**Design decisions already locked in:**
- Posts authored as markdown files in `public/posts/<project>/<slug>.md`
- A single `manifest.json` is the source of truth for what posts exist
- GitHub dark palette: `#0d1117` bg, `#c9d1d9` text, accent oranges/blues/purples
- Per-project accent colors (orange for Jarvis, purple for Atlas)

---

## Stage 1 — Dependencies & project scaffold

**Goal:** Get the new packages installed and create the directory structure.

**Tasks:**
1. Install the markdown rendering dependencies:
   ```bash
   npm install react-markdown remark-gfm
   ```
   (Skipping `gray-matter` — we'll use a 10-line inline frontmatter parser to avoid CRA polyfill issues.)

2. Create directories:
   - `src/pages/Projects/`
   - `public/posts/jarvis/`
   - `public/posts/atlas/`

3. Verify `package.json` has `"homepage": "https://shaleequreshi.github.io/Shahrukh"` (or whatever the actual deployed path is). The `process.env.PUBLIC_URL` references depend on this.

**Done when:** `npm install` succeeds and the new directories exist.

---

## Stage 2 — Content manifest & sample posts

**Goal:** Set up the content layer first so the UI has real data to render.

**Tasks:**
1. Create `public/posts/manifest.json` with two projects (Jarvis + Atlas), each with their metadata (name, subtitle, description, tags, accent color) and an array of posts (slug, title, date, summary).

2. Create three sample markdown files with frontmatter:
   - `public/posts/jarvis/picking-the-gpu.md`
   - `public/posts/jarvis/first-boot.md`
   - `public/posts/atlas/hello-atlas.md`

   Each starts with:
   ```markdown
   ---
   title: Post Title
   date: 2026-05-10
   ---

   Body in markdown.
   ```

**Done when:** Hitting `<site>/posts/manifest.json` in the browser returns the JSON; the `.md` files are present.

---

## Stage 3 — Shared CSS theme

**Goal:** Build the terminal / dev-log visual system once, reuse across all three pages.

**Tasks:**
1. Create `src/pages/Projects/Projects.css` with:
   - GitHub dark palette as CSS variables on `.terminal`
   - Top bar / nav styling (`shahrukh@home:~$` prompt look)
   - ASCII header block
   - Project card styles (border, hover lift, badge, tags)
   - Post entry styles (left-border accent on hover)
   - Markdown body styles (`.markdown-body` — headings prefixed with `##`/`###`, code blocks with dark bg, blockquotes with orange accent border)
   - Blinking cursor animation
   - Mobile breakpoint at 600px

**Palette reference:**
- Background: `#0d1117` / elevated `#161b22`
- Borders: `#21262d` / hover `#30363d`
- Text: `#c9d1d9` / muted `#8b949e` / dim `#6e7681`
- Accents: blue `#58a6ff`, green `#7ee787`, orange `#f0883e`, purple `#d2a8ff`, red `#ff7b72`

**Done when:** The CSS file exists and is importable.

---

## Stage 4 — Projects index page (`/projects`)

**Goal:** Build the landing page that shows Jarvis + Atlas as cards.

**Tasks:**
1. Create `src/pages/Projects/Projects.js` which:
   - Fetches `manifest.json` from `${process.env.PUBLIC_URL}/posts/manifest.json` on mount
   - Renders top bar with `shahrukh@home:~$ cat ./projects` prompt
   - Renders ASCII header block
   - Renders one `<Link>` card per project (linking to `/projects/<name>`)
   - Each card shows: name with `▸` prefix and accent color, subtitle, description, tags, post count
   - Shows loading state (with blinking cursor) and error state

2. Export a reusable `TopBar` component from this file (since it's also used on the other two pages). It takes an `active` prop to highlight the current nav item.

**Routes used:** none yet — that comes in Stage 7.

**Done when:** The component renders without errors when imported and given access to React Router context.

---

## Stage 5 — Project detail page (`/projects/:project`)

**Goal:** Build the per-project page listing all posts for Jarvis or Atlas.

**Tasks:**
1. Create `src/pages/Projects/ProjectDetail.js` which:
   - Reads `:project` from URL params via `useParams`
   - Fetches the same `manifest.json`
   - Looks up the project; if not found, shows a "no such project" message
   - Renders top bar + a "back to /projects" link
   - Renders project name (with `▸` and accent color) + description
   - Renders post list sorted newest-first: each entry shows date, `<slug>.md` filename in blue, and the summary

2. Import and reuse `TopBar` from `Projects.js`.

**Done when:** Hitting `/projects/jarvis` would (once wired) show two posts; `/projects/atlas` would show one.

---

## Stage 6 — Post page (`/projects/:project/:slug`)

**Goal:** Build the individual post view that renders the markdown file.

**Tasks:**
1. Create `src/pages/Projects/Post.js` which:
   - Reads `:project` and `:slug` from URL params
   - Fetches `manifest.json` to validate the post exists and pull metadata
   - Fetches the markdown file from `${process.env.PUBLIC_URL}/posts/<project>/<slug>.md`
   - Parses frontmatter using a simple inline regex parser (no `gray-matter` dependency)
   - Renders with `<ReactMarkdown remarkPlugins={[remarkGfm]}>` inside a `.markdown-body` wrapper
   - Header shows date · `~/<project>/<slug>.md` (in the project's accent color), then the post title
   - "back to /<project>" link
   - Error state if the file is missing or unknown project/slug

2. Inline frontmatter parser:
   ```js
   function parseFrontmatter(raw) {
     const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
     if (!match) return { data: {}, content: raw };
     const data = {};
     match[1].split("\n").forEach((line) => {
       const [key, ...rest] = line.split(":");
       if (key) data[key.trim()] = rest.join(":").trim();
     });
     return { data, content: match[2] };
   }
   ```

**Done when:** Hitting a post URL renders the markdown with all styling applied.

---

## Stage 7 — Router wiring

**Goal:** Connect the three new pages to the existing `HashRouter`.

**Tasks:**
1. Find the file that currently sets up `<HashRouter>` and `<Routes>` (likely `App.js` or `index.js`).

2. Add three imports:
   ```jsx
   import Projects from "./pages/Projects/Projects";
   import ProjectDetail from "./pages/Projects/ProjectDetail";
   import Post from "./pages/Projects/Post";
   ```

3. Add three routes inside the existing `<Routes>` (order doesn't matter — React Router matches by specificity):
   ```jsx
   <Route path="/projects" element={<Projects />} />
   <Route path="/projects/:project" element={<ProjectDetail />} />
   <Route path="/projects/:project/:slug" element={<Post />} />
   ```

   **If the site uses React Router v5 (older API):**
   ```jsx
   <Route exact path="/projects" component={Projects} />
   <Route exact path="/projects/:project" component={ProjectDetail} />
   <Route exact path="/projects/:project/:slug" component={Post} />
   ```
   Check `package.json` for the `react-router-dom` version to determine which.

4. Update the `TopBar` component in `Projects.js` to match the existing site's actual nav structure (about, work, contact, etc.). Currently it has placeholder `/` and `/projects` links.

**Done when:**
- `npm start` runs cleanly
- `/#/projects` loads the landing
- `/#/projects/jarvis` loads the project page
- `/#/projects/jarvis/picking-the-gpu` loads the post

---

## Stage 8 — Visual polish & integration

**Goal:** Make the new section feel native to the existing site.

**Tasks:**
1. Compare the new section's `TopBar` against the actual site's nav. Adjust the nav items, ordering, and styling so they match. If the existing site has a header component that should appear on these pages, replace the `TopBar` with it.

2. Verify the existing site's global CSS doesn't conflict (e.g. a global `body { background: white }` would fight the terminal `bg`). The `.terminal` wrapper class scopes most things, but the outer `<body>` may need attention.

3. Test responsive behavior on a phone-width viewport (320–414px). The CSS has a `@media (max-width: 600px)` block that tightens padding and shrinks the ASCII header.

4. Optional: add a link to `/projects` from the site's main nav / homepage.

**Done when:** Navigating between the new and existing pages feels seamless.

---

## Stage 9 — Deploy

**Goal:** Ship it to GitHub Pages.

**Tasks:**
1. Run `npm run build` and verify no errors.

2. Deploy with the existing GitHub Pages flow (likely `npm run deploy` if `gh-pages` is set up, otherwise the existing CI/CD).

3. Verify the live URLs work:
   - `https://shaleequreshi.github.io/Shahrukh/#/projects`
   - `https://shaleequreshi.github.io/Shahrukh/#/projects/jarvis`
   - `https://shaleequreshi.github.io/Shahrukh/#/projects/jarvis/picking-the-gpu`
   - Same for `atlas`

4. Check that the markdown files are accessible at:
   - `https://shaleequreshi.github.io/Shahrukh/posts/manifest.json`
   - `https://shaleequreshi.github.io/Shahrukh/posts/jarvis/picking-the-gpu.md`

   If they 404, the `homepage` in `package.json` is wrong or GitHub Pages isn't serving `public/` correctly.

**Done when:** All routes work in production.

---

## Future enhancements (out of scope for v1)

- Syntax highlighting for code blocks (add `rehype-highlight` + a theme)
- RSS feed generated from the manifest at build time
- Tags as filter chips on the project pages
- Search across all posts
- "Recent posts" widget on the homepage
- Reading time estimates on each post
- Dark/light mode toggle (currently dark-only, which matches the aesthetic)

---

## How to add new content after launch

**Add a post to an existing project:**
1. Create `public/posts/<project>/<slug>.md` with frontmatter
2. Add an entry to that project's `posts` array in `manifest.json`
3. Commit, push, deploy

**Add a new project:**
1. Add a top-level key in `manifest.json` (copy the Jarvis/Atlas structure)
2. Create `public/posts/<newproject>/` directory
3. Commit, push, deploy
4. The index page picks it up automatically — no code changes
