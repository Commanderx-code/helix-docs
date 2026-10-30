# Helix Tech Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish Helix Tech Docs at `https://docs.helixtech.app`, built with Starlight from the four tool repositories' docs at their latest release, branded like helixtech.app and served by the VPS as strictly as the main site.

**Architecture:** A new public repo `Commanderx-code/helix-docs` holds the Starlight site, a source list, and a fetch step that downloads each tool repo at its release tag, picks the listed pages (or README sections), rewrites links and images, and writes them into `src/content/docs/<tool>/` (generated, git-ignored) before `astro build`. GitHub Actions publishes `dist` to the `deploy` branch; the VPS pulls it the same way as helixtech.app, and Caddy serves it with its own security headers.

**Tech Stack:** Node 22, Astro 7.4.4, `@astrojs/starlight` 0.42.8, fontsource (Fira Sans, Fira Sans Condensed, JetBrains Mono Variable), unified/remark (`remark-parse`, `remark-gfm`, `remark-stringify`, `unist-util-visit`) for Markdown rewriting, `tar` (system) for extraction, vitest for tests, Caddy 2.11 + systemd on Debian 13.

**Spec:** `docs/superpowers/specs/2026-10-30-helix-docs-design.md`

## Global Constraints

- Exact versions in `package.json` (no `^`/`~`), like helix-site: `astro` `7.4.4`, `@astrojs/starlight` `0.42.8`, fontsource versions as in helix-site (`@fontsource/fira-sans` `5.3.0`, `@fontsource/fira-sans-condensed` `5.3.0`, `@fontsource-variable/jetbrains-mono` `5.3.0`); other packages at their current release, pinned.
- Tools, repos, page lists, exclusions and refs exactly as in spec decisions 7, 8, 13 and 16; Touchdown's repo is `Commanderx-code/touchdown-cli`.
- Title "Helix Tech Docs"; copyright line "© {years} Helix Tech LLC. Helix Tech™ is a trademark of Helix Tech LLC." with years computed as helix-site does (`2026` or `2026–<year>`).
- Brand tokens from helix-site `src/styles/global.css` (dark and light sets), logos `src/assets/brand/logo-on-dark.png` / `logo-on-light.png`, `public/favicon.svg`.
- Built HTML: no inline `<script>` without `src` (JSON-LD excepted), no `<style>` elements, no `http(s)://` script, stylesheet, font or image URLs.
- Caddy CSP for the docs site: `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`. Add `data:` to `img-src` only if the browser check in Task 4 shows a `data:` image violation, and note why in the Caddyfile.
- Commits as the owner's git identity with plain messages and no attribution lines; no AI tool named in docs or comments; US English.
- Every helix-site change happens in a separate git worktree off `origin/main`, never in `~/github/projects/helix-site` (another session works there).
- VPS changes land through a homelab PR; the live files must match the PR when it is opened.

## Review Focus

1. A Markdown link inside a code block or inline code (`` `[x](GUIDE.md)` ``) must stay untouched: Task 2 test `leaves links in code alone`.
2. A link with an anchor to a listed page (`GUIDE.md#plans`) keeps the anchor on the site URL: Task 2 test `keeps anchors`.
3. A link to a file outside the page list or outside `docs/` (`ARCHITECTURE.md`, `../README.md`, `../src/main.rs`) goes to GitHub at the build's ref, never to a 404 on the docs site: Task 2 test `sends unlisted targets to GitHub`.
4. An image given as an HTML `<img>` with an absolute `raw.githubusercontent.com/<same repo>/main/...` URL (Toolbox `GUI.md`) is copied from the tarball at the build ref and served from the site: Task 2 test `localizes raw GitHub images`.
5. GitHub unreachable, rate-limited, or a listed page missing at the tag: the fetch exits non-zero before `astro build`, so nothing is pushed and the VPS keeps serving the last good release: Task 3 test `fails on a missing listed page`, and the workflow order in Task 5.

---

### Task 1: Scaffold the branded Starlight site

**Files:**
- Create: `package.json`, `package-lock.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`, `src/content.config.ts`, `src/content/docs/index.mdx`, `src/styles/theme.css`, `src/components/Footer.astro`, `src/assets/brand/logo-on-dark.png`, `src/assets/brand/logo-on-light.png`, `public/favicon.svg`, `public/.well-known/security.txt`, `README.md`, `LICENSE` (MIT, "Helix Tech LLC"), `SECURITY.md`, `docs/superpowers/specs/2026-10-30-helix-docs-design.md`, `docs/superpowers/plans/2026-10-30-helix-docs.md`, `.claude/` hookify rule (copied from helix-site's `.claude/`, listed in `.git/info/exclude`)
- Test: build output inspected in Step 4

**Interfaces:**
- Produces: content collection `docs` (Starlight's `docsLoader` + `docsSchema`); generated tool pages will live in `src/content/docs/{toolbox,boot,webos-launcher,touchdown}/` (git-ignored); `src/generated/` (git-ignored) for `versions.json`. Footer override registered as `components: { Footer: './src/components/Footer.astro' }`.

- [ ] **Step 1:** `git init` in `~/github/projects/helix-docs`, add the files above. Copy `security.txt` and `SECURITY.md` from helix-site, changing the site name. Starlight config: `title: 'Helix Tech Docs'`, `logo: { dark, light, replacesTitle: true }`, `favicon: '/favicon.svg'`, `social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/Commanderx-code' }]`, `customCss: ['./src/styles/theme.css', fontsource CSS imports]`, `sidebar` with one group per tool using `autogenerate: { directory: '<slug>' }` labeled Helix Toolbox, Helix Boot, webOS Launcher, Touchdown, `lastUpdated: false`, `pagefind: true`. Astro: `site: 'https://docs.helixtech.app'`, `build.inlineStylesheets: 'never'`, `vite.build.assetsInlineLimit: 0`.
- [ ] **Step 2:** `theme.css` maps the helix-site tokens to Starlight's variables for dark (`:root`) and light (`:root[data-theme='light']`): accent from `--mint`/`--violet`, grays from `--ink`…`--chrome`, `--sl-font: 'Fira Sans'`, `--sl-font-mono: 'JetBrains Mono Variable'`, headings in Fira Sans Condensed.
- [ ] **Step 3:** `Footer.astro` renders Starlight's default footer pieces (pagination, edit link) and then: logo, the copyright line from Global Constraints, links "helixtech.app" (`https://helixtech.app/`), "Tools" (`https://helixtech.app/#tools`), "GitHub" (`https://github.com/Commanderx-code`), "Privacy" (`https://helixtech.app/privacy/`). `index.mdx` uses `template: splash`, a one-line intro, Starlight's search is in the header; four `LinkCard`s (Helix Toolbox → `/toolbox/walkthrough/`, Helix Boot → `/boot/`, webOS Launcher → `/webos-launcher/`, Touchdown → `/touchdown/`) with each tool's pitch from helix-site `src/data/tools.ts`. Until Task 3 exists, create one placeholder page per tool so links resolve; delete them in Task 3.
- [ ] **Step 4:** Run `npm ci && npx astro check && npm run build`. Expected: build succeeds; `dist/index.html` contains "Helix Tech Docs"; `dist/pagefind/` exists.
- [ ] **Step 5:** Screenshot `npm run preview` with the nix Chromium (`/nix/store/ini1ifgvcsvw48x4mxawrv9jvbdwn70p-chromium-155.0.8059.79/bin/chromium --headless=new --screenshot`, dark with `--blink-settings=preferredColorScheme=0`, and light) at 1440×900 and 390×844; compare against helixtech.app; fix contrast or spacing problems seen.
- [ ] **Step 6:** Commit "Scaffold Helix Tech Docs with Starlight and the Helix Tech brand".

### Task 2: Markdown transform library

**Files:**
- Create: `scripts/sources.mjs`, `scripts/lib/markdown.mjs`
- Test: `scripts/lib/markdown.test.mjs` (vitest; `npm test` runs `vitest run`)

**Interfaces:**
- Produces:
  - `TOOLS: ToolSource[]` in `sources.mjs`, where `ToolSource = { slug, name, repo, kind: 'docs' | 'readme', docsDir?: 'docs', pages?: { file, slug, order }[], sections?: { heading, slug, label, order }[], introSlug?: string, excludeImages: string[], images: boolean }`. Page slugs: Toolbox `walkthrough, install, guide, gui, catalog, reference, json, events, migration, stability, security, reporting` (in that order); Boot `index` (README.md), `install, tools, look, theming, tool-icons, packs, engine, lazarus-pe, testing, code-signing`; webOS sections `Controls, Setup, Settings in config.json, Automatic updates, On a rooted TV, Keeping Developer Mode alive, What it can't do` (intro before the first `##` becomes `index`; `Layout` and `License` left out; `images: false`); Touchdown sections `Features, Quick start, Screenshots, Controls, Favorite team and theme, Command-line options, Data and refresh behavior` (intro → `index`; `Development`, `License` left out). Grouping of sections into pages is the implementer's call (one page per section is acceptable).
  - `extractTitle(markdown: string): { title: string, body: string }`: first `# ` heading becomes the title and is removed.
  - `splitReadme(markdown: string, sections): { intro: string, pages: { slug, label, order, body }[], skipped: string[] }`: `skipped` lists `##` headings not in `sections`.
  - `rewrite(markdown: string, ctx: RewriteContext): { markdown: string, images: { from: string, to: string }[] }` where `RewriteContext = { repo, ref, sourcePath (repo-relative posix path of the page), siteUrls: Map<string /*repo path*/, string /*site URL*/>, excludeImages: string[], images: boolean, imageDir: string }`. Works on the mdast (remark-parse + remark-gfm), including `html` nodes containing `<img>` (converted to Markdown images with the `alt`).

- [ ] **Step 1: Write failing tests** in `markdown.test.mjs`, one per behavior, with these assertions:
  - `extracts the title`: `extractTitle('# Installing Helix Toolbox\n\nText')` → `{ title: 'Installing Helix Toolbox', body: 'Text\n' }` (trimmed leading blank lines).
  - `rewrites listed pages`: `[guide](GUIDE.md)` from `docs/INSTALL.md` with `siteUrls` `docs/GUIDE.md → /toolbox/guide/` → `[guide](/toolbox/guide/)`.
  - `keeps anchors`: `GUIDE.md#plans` → `/toolbox/guide/#plans`.
  - `sends unlisted targets to GitHub`: `ARCHITECTURE.md` → `https://github.com/Commanderx-code/Helix-toolbox/blob/v1.25.8/docs/ARCHITECTURE.md`; `../README.md` → `.../blob/v1.25.8/README.md`; `../src` → `.../tree/v1.25.8/src`.
  - `leaves external and in-page links alone`: `https://example.com`, `#section`, `mailto:` unchanged.
  - `leaves links in code alone`: a fenced block and an inline code span containing `[x](GUIDE.md)` are byte-identical after `rewrite`.
  - `copies relative images`: `![a](themes.jpg)` from `docs/look.md` → `images` contains `{ from: 'docs/themes.jpg', to: '<imageDir>/themes.jpg' }` and the Markdown points to `./themes.jpg`.
  - `localizes raw GitHub images`: `<img src="https://raw.githubusercontent.com/Commanderx-code/Helix-toolbox/main/assets/screenshots/gui-doctor.png" width="820" alt="Doctor">` → `![Doctor](./gui-doctor.png)` and `{ from: 'assets/screenshots/gui-doctor.png', … }`.
  - `drops excluded images`: `<img src="boot-menu-folder.jpg" alt="…">` with `excludeImages: ['docs/boot-menu-folder.jpg']` → no image node, no `images` entry; surrounding text kept.
  - `drops all images when images is false`.
  - `splits a README`: input with intro, `## Controls`, `## Layout`, `## License` and sections `[Controls]` → `intro` has the intro text, `pages` one entry, `skipped` `['Layout', 'License']`.
- [ ] **Step 2:** Run `npm test`. Expected: all fail (module missing).
- [ ] **Step 3:** Implement `scripts/sources.mjs` and `scripts/lib/markdown.mjs` with the signatures above.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit "Rewrite tool docs for the site: titles, links, images and README sections".

### Task 3: Fetch step

**Files:**
- Create: `scripts/fetch-docs.mjs`
- Modify: `package.json` (`"fetch": "node scripts/fetch-docs.mjs"`, `"build": "npm run fetch && astro build"`), `src/content/docs/index.mdx` (show each tool's version from `src/generated/versions.json`, e.g. "v1.25.8" or "main"); delete Task 1's placeholder pages
- Test: `scripts/fetch-docs.test.mjs`

**Interfaces:**
- Consumes: `TOOLS`, `extractTitle`, `splitReadme`, `rewrite` (Task 2).
- Produces: `resolveRef(repo: string, fetchImpl = fetch): Promise<string>` (latest release `tag_name` via `https://api.github.com/repos/<repo>/releases/latest`, `Authorization: Bearer $GITHUB_TOKEN` when set; HTTP 404 → `'main'`; any other non-2xx → throws); `buildTool(tool, srcRoot: string, ref: string, outDir: string): Promise<{ written: string[], skipped: string[] }>` (reads from an extracted tarball at `srcRoot`, throws `Listed page missing: <path> at <ref>` when a listed file is absent); `main()` downloads `https://codeload.github.com/<repo>/tar.gz/<ref>` into a temp dir, extracts with `tar -xzf --strip-components=1`, calls `buildTool`, writes `src/generated/versions.json` `{ "<slug>": "<ref>" }`, prints skipped README sections, exits 1 on any error.
- Each written page has front matter `title`, `sidebar: { order, label? }`, `editUrl: https://github.com/<repo>/edit/main/<sourcePath>` (README-derived pages point to `README.md`).

- [ ] **Step 1: Write failing tests:** `resolves the latest release` (stub `fetchImpl` returning `{ tag_name: 'v1.25.8' }` → `'v1.25.8'`); `falls back to main without releases` (404 → `'main'`); `throws on rate limit` (403 → rejects); `fails on a missing listed page` (fixture tree under `scripts/fixtures/toolbox/` missing `docs/GUI.md` → rejects with `Listed page missing: docs/GUI.md at v1.25.8`); `writes front matter` (fixture with `docs/INSTALL.md` → output file starts with `---\ntitle: Installing Helix Toolbox\n` and contains `editUrl: https://github.com/Commanderx-code/Helix-toolbox/edit/main/docs/INSTALL.md`).
- [ ] **Step 2:** Run `npm test`; the new tests fail.
- [ ] **Step 3:** Implement `scripts/fetch-docs.mjs` as specified; add `src/content/docs/{toolbox,boot,webos-launcher,touchdown}/` and `src/generated/` to `.gitignore`.
- [ ] **Step 4:** Run `npm test` (pass), then `GITHUB_TOKEN=$(gh auth token) npm run build`. Expected: refs printed (Toolbox v1.25.8, Boot v0.7.7, Touchdown v0.1.0, webOS main), skipped sections printed (webOS Layout, License; Touchdown Development, License), build succeeds, `dist/toolbox/gui/index.html` references three local screenshots, `dist/boot/tools/` has no `boot-menu-folder`, no file under `dist/webos-launcher/` references an image from the repo.
- [ ] **Step 5:** Read through the built site in the browser (Chromium screenshots of one page per tool plus search results for "install"); fix broken formatting found (e.g. GitHub-only Markdown such as `> [!NOTE]` alerts → Starlight asides, `<details>`).
- [ ] **Step 6:** Commit "Build the docs from each tool's latest release".

### Task 4: Content-Security-Policy-safe output

**Files:**
- Create: `scripts/check-dist.mjs`, `scripts/check-dist.test.mjs`, component overrides or Astro/Starlight config changes needed to move Starlight's inline scripts into bundled files
- Modify: `package.json` (`"check:dist": "node scripts/check-dist.mjs dist"`)

**Interfaces:**
- Produces: `checkHtml(html: string, file: string): string[]` (problem descriptions, empty when clean) and a CLI that walks `dist/**/*.html` and exits 1 listing problems.

- [ ] **Step 1: Write failing tests:** `flags inline scripts` (`<script>x()</script>` → 1 problem; `<script src="/a.js"></script>` and `<script type="application/ld+json">{}</script>` → none); `flags style elements` (`<style>a{}</style>` → 1); `flags remote assets` (`<link rel="stylesheet" href="https://x/a.css">`, `<img src="https://x/a.png">`, `<script src="//x/a.js">` → 1 each).
- [ ] **Step 2:** Run `npm test`; fail.
- [ ] **Step 3:** Implement `checkHtml` and the CLI.
- [ ] **Step 4:** Run `npm run build && npm run check:dist`. Expected at first: problems listing Starlight's inline scripts. Move them into files (override the components that emit `is:inline` scripts, keeping their behavior: theme applied before paint, theme picker, sidebar state, search). Re-run until `check:dist` prints nothing and exits 0.
- [ ] **Step 5:** Serve `dist` locally with the Global Constraints CSP as a response header (a 20-line Python `http.server` subclass, as used for the GoAccess check) and drive Chromium over CDP: home, a Toolbox page with code blocks, a Boot page with images, search for "install" with results shown, theme toggled to light and back. Expected: no CSP violations in the console, search returns results, code blocks colored. If the only violations are `data:` images, add `data:` to `img-src` (Global Constraints).
- [ ] **Step 6:** Commit "Keep the built site inside a strict Content-Security-Policy".

### Task 5: Repository, CI and first publish

**Files:**
- Create: `.github/workflows/publish.yml` (from helix-site's, same pinned actions `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`, `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0`, Node 22, cron `'47 9 * * *'`, steps `npm ci` → `npm test` → `npm run build` (env `GITHUB_TOKEN`) → `npx astro check` → `npm run check:dist` → the same deploy-branch push block), `.github/dependabot.yml` (copy of helix-site's)

- [ ] **Step 1:** Add the files; run `nix run nixpkgs#actionlint` (expect no output).
- [ ] **Step 2:** Create the public repo: `gh repo create Commanderx-code/helix-docs --public --source . --push --description "Documentation for the Helix tools: docs.helixtech.app"`.
- [ ] **Step 3:** Apply helix-site's settings with `gh api`: secret scanning + push protection, private vulnerability reporting, Dependabot alerts and security updates, default workflow permissions read, allowed actions GitHub-owned only, wiki and projects off, homepage `https://docs.helixtech.app`, ruleset "Protect main" blocking deletion and non-fast-forward. Verify each with a `gh api` GET.
- [ ] **Step 4:** Watch the first run (`gh run watch`). Expected: success; `git ls-remote origin deploy` shows a commit.
- [ ] **Step 5:** Commit and push any fixes; nothing else to commit if green.

### Task 6: Serve it from the VPS (homelab PR)

**Files (homelab repo, worktree off `origin/main`, branch `helix-docs`):**
- Modify: `scripts/helix-vps/site/helix-site-deploy` (read `REPO`, `ROOT` from the environment, defaulting to today's helix-site values, so the existing unit is unchanged), `scripts/helix-vps/Caddyfile` (new `docs.helixtech.app` block), `docs/homelab/helix-vps.md` (Website section: docs site, its deploy unit and CSP)
- Create: `scripts/helix-vps/site/helix-docs-deploy.service`, `scripts/helix-vps/site/helix-docs-deploy.timer` (copies of the helix-site units with `Environment=REPO=https://github.com/Commanderx-code/helix-docs.git ROOT=/srv/helix-docs`, `ReadWritePaths=/srv/helix-docs`, same `helix-site` user)

- [ ] **Step 1:** Ask the owner to confirm the Cloudflare A record `docs` → `41.180.225.41` (DNS only); verify from the VPS with `dig +short docs.helixtech.app @1.1.1.1` → `41.180.225.41`.
- [ ] **Step 2:** On the VPS: create `/srv/helix-docs/releases` owned by `helix-site`, install the script and units, `systemctl enable --now helix-docs-deploy.timer`, run the service once. Expected: `/srv/helix-docs/current/index.html` exists; `systemctl start helix-site-deploy` still succeeds (unchanged behavior).
- [ ] **Step 3:** Caddy block `docs.helixtech.app`: `import access_log`, GET/HEAD only (405), `root * /srv/helix-docs/current`, `encode zstd gzip`, `file_server`, the same header set as `helixtech.app` but the CSP from Global Constraints, `/_astro/*` and `/pagefind/*` immutable caching only for `_astro`, `handle_errors 404` → `/404.html`. Back up the Caddyfile, `caddy validate`, install, `systemctl reload caddy`.
- [ ] **Step 4:** Verify: `curl -sI https://docs.helixtech.app/` → 200 with HSTS and the CSP; `curl -X POST` → 405; a missing page → 404 page; `http://` → 308; testssl.sh rating A+ (as for helixtech.app); the Task 4 browser check against the live URL with no CSP violations.
- [ ] **Step 5:** VPS Kuma keyword monitor "Docs site" (`https://docs.helixtech.app/`, keyword "Helix Tech Docs", 60 s, notification 1), added like earlier VPS monitors (DB backup, insert copying monitor 10's row, Kuma restart); confirm UP. Tell the owner the home Kuma monitor to add in its UI (same URL and keyword, parent "Helix VPS").
- [ ] **Step 6:** Commit, push, open the PR; check the live Caddyfile and units match the branch (`diff` over SSH). Owner merges.

### Task 7: Link helixtech.app to the docs (helix-site PR)

**Files (helix-site worktree off `origin/main`, branch `docs-links`):**
- Modify: `src/data/tools.ts` (`docs:` → `https://docs.helixtech.app/toolbox/walkthrough/`, `https://docs.helixtech.app/boot/`, and add `docs:` for webOS Launcher `https://docs.helixtech.app/webos-launcher/` and Touchdown `https://docs.helixtech.app/touchdown/`), `src/pages/privacy.astro` (cover `docs.helixtech.app`: Starlight keeps the theme choice and sidebar state in the browser's storage, no cookies, visits appear in the server access log used for security and a private traffic report; keep the page's existing tone)

- [ ] **Step 1:** Make the edits; `npx astro check && npm run build`. Expected: success; the four tool pages show a Documentation button to the docs URLs.
- [ ] **Step 2:** Commit "Point the Documentation buttons at docs.helixtech.app and cover it in the privacy page", push the branch, open the PR. The owner reviews the privacy wording and merges.
