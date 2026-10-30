# Helix Tech Docs: design

Date: 2026-10-30. Status: agreed in conversation; this document is the written form.

## Intent

helixtech.app introduces the Helix tools; the detailed documentation lives in `docs/` folders on GitHub, where it reads like a repository rather than a product. Helix Tech Docs at `https://docs.helixtech.app` gives people who **use** the tools one branded place to install them, learn them and fix problems, without the writing moving out of the tool repositories.

Success: a visitor gets from helixtech.app to the right "start here" page for a tool in one click, can search across every tool, and the docs update themselves when a tool is released, with no second copy to keep in sync.

## Goals

- One site covering Helix Toolbox, Helix Boot, webOS Launcher and Touchdown.
- Each tool repository stays the only source of its docs. The site is built from them.
- Readers see the docs for the version they can install: the latest release tag, or `main` for a tool with no release (webOS Launcher today).
- It looks like part of helixtech.app.
- Built-in search that runs in the browser, with no outside service.

## Non-goals

- Contributor and internal documentation (architecture, releasing, roadmaps, testing internals, agent notes). It stays on GitHub.
- Config Bible (private until it is public) and anything from the homelab repository (it describes the home network).
- Versioned docs (a page per release), translations, comments, analytics beyond the existing GoAccess report.

## Anti-goals (failure even if it works)

- An internal page appears on the public site because someone added it to a tool's `docs/` folder. Pages are an explicit list.
- A page is edited in two places, or the site drifts from the repositories.
- The docs site is weaker than helixtech.app: looser Content-Security-Policy, scripts or fonts from other origins, a push-based deploy or stored credentials on the VPS.
- webOS Launcher screenshots appear: their wallpaper is a Jorge Jacinto painting that is not ours to republish.

## Decisions (made by the owner)

1. Audience: people using the tools. Contributor pages stay on GitHub.
2. Source: pulled from each tool repository at build time. The docs repository holds no copies of tool docs in git.
3. Tools: Helix Toolbox, Helix Boot, webOS Launcher, Touchdown.
4. Built with Starlight (Astro's documentation theme).
5. Look: matches helixtech.app, built from the same color and type settings (see Constraints).
6. New public repository `Commanderx-code/helix-docs`, deployed exactly like helixtech.app (pull-based, below), served by Caddy at `docs.helixtech.app`.
7. A fixed list of pages per tool, kept in the docs repository:
   - **Helix Toolbox** (`Commanderx-code/Helix-toolbox`, `docs/`): `walkthrough.md` (Walkthrough), `INSTALL.md`, `GUIDE.md`, `GUI.md`, `CATALOG.md`, `REFERENCE.md`, `JSON.md`, `EVENTS.md`, `MIGRATION.md`, `STABILITY.md`, `SECURITY.md`, `REPORTING.md`. Left out: `ARCHITECTURE.md`, `RELEASING.md`, `ROADMAP.md`, `SOURCE-SYNC.md`, `TESTING.md`, `agents/`.
   - **Helix Boot** (`Commanderx-code/helix-boot`, `docs/`): `README.md` (overview), `install.md`, `tools.md`, `look.md`, `theming.md`, `tool-icons.md`, `packs.md`, `engine.md`, `lazarus-pe.md`, `testing.md`, `code-signing.md`. Left out: `roadmap.md`. Its images are included, except three that show other people's work: `themes-imported.jpg` (imported GRUB themes), `boot-menu-folder.jpg` and `artwork/helix-icons-preview.png` (vendor logos). The text around them stays.
   - **webOS Launcher** (`Commanderx-code/webos-launcher`): `README.md`, split into a few pages from an explicit list of its `##` sections; `## Layout` (source-tree map) stays out. No screenshots or images from the repository.
   - **Touchdown** (`Commanderx-code/touchdown-cli`): `README.md`, split into a few pages from an explicit list of its `##` sections; `## Development` stays out. Its banner and screenshots are included.
   - *(Builder's call, recorded)* A README section not on the list is left out and the build log names it, so an unreviewed section on `main` never goes live by itself.
8. Version: latest GitHub release tag per tool; `main` when a tool has none. At the time of writing: Toolbox v1.25.8, Boot v0.7.7, Touchdown v0.1.0, webOS Launcher `main`.
9. Rebuilds: daily on a schedule, on every push to `helix-docs` `main`, and on manual "Run workflow". No tokens shared between repositories.
10. Home page: search at the top and one card per tool linking to its first page.
11. Every page has "Edit this page on GitHub" pointing to the source file at `main` in the tool repository. Links between listed pages stay on the docs site; links to anything else (code files, unlisted pages) point to GitHub at the same ref the page was built from.
12. Once the docs are live, helixtech.app's "Documentation" buttons (`docs:` in `src/data/tools.ts` in helix-site) point to `https://docs.helixtech.app/<tool>/`.
13. No webOS Launcher screenshots until there are ones with free or own wallpaper.
14. Title "Helix Tech Docs", Helix Tech logo in the header, the same footer and copyright line as helixtech.app ("© 2026 Helix Tech LLC. Helix Tech™ is a trademark of Helix Tech LLC.", years as on the site).
15. Content-Security-Policy may allow inline style **attributes** only (`style-src-attr 'unsafe-inline'`), which Starlight's code highlighting (Expressive Code) and search need. Scripts and style sheets stay `'self'`.
16. Images: every image a listed page uses is copied into the build from the same ref (Toolbox's `GUI.md` screenshots included, which today point at `raw.githubusercontent.com` and would be blocked by `img-src 'self'`), except the excluded ones in decisions 7 and 13.
17. The helixtech.app privacy page is updated to cover `docs.helixtech.app` (theme and sidebar state kept in the browser by Starlight, docs visits in the server access log and the GoAccess report), drafted by the builder and reviewed by the owner, in the same helix-site change as the Documentation links.

## Constraints

- **Branding** comes from helix-site `main` (`src/styles/global.css`, `src/assets/brand/`): dark-first tokens `--ink #0b0d12`, `--deep #11141c`, `--raised #161a24`, `--line #232837`, `--mint #5eead4` (accent), `--violet #a78bfa`, `--chrome #eceef4`, `--text #b4b9c9`, `--muted #8b91a3`, plus the light-mode set in the same file; fonts Fira Sans (body), Fira Sans Condensed (display), JetBrains Mono Variable (code), self-hosted through fontsource like the site. Logo files `logo-on-dark.png` / `logo-on-light.png`, favicon `public/favicon.svg`. US English.
- **Security headers as strict as helixtech.app:** Caddy sends HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, no `Server`, GET/HEAD only (405 otherwise), and a CSP with `default-src 'none'` that loads scripts, styles, images and fonts only from the site itself. Starlight adds small inline scripts (theme choice, etc.); they must be allowed by hash or moved to files, never with `'unsafe-inline'` for scripts; inline style attributes are allowed (decision 15). Search (Pagefind) must work under the CSP (it may need `'wasm-unsafe-eval'`; that is acceptable, `'unsafe-eval'` is not).
- **Deploy, as for helixtech.app** (documented in homelab `docs/homelab/helix-vps.md`, "Website"): GitHub Actions builds and force-pushes `dist` to the repository's `deploy` branch only when it changed, with pinned GitHub-owned actions and `contents: write` only on that job. On the VPS a timer, as a dedicated unprivileged user in a sandboxed unit, pulls new `deploy` commits into `/srv/helix-docs/releases/<commit>`, rejects symlinks and special files, switches a `current` symlink atomically and keeps five releases. The existing `helix-site-deploy` script and units in homelab `scripts/helix-vps/site/` are the model; generalizing them for both sites or adding a second copy is the builder's call.
- **Repository settings as on helix-site:** public, MIT license, secret scanning with push protection, private vulnerability reporting, Dependabot, read-only default workflow token, GitHub-owned actions only, ruleset blocking force pushes and deletion of `main`, wiki and projects off, `security.txt` and `SECURITY.md` pointing to `security@helixstack.io`. Copy the per-directory hookify attribution rule into `.claude/` and exclude it with `.git/info/exclude`.
- **Commits** as the owner's git identity, plain messages, no attribution lines; docs and comments never name AI tools.
- **DNS:** the owner adds a Cloudflare A record `docs` → `41.180.225.41`, DNS only (not proxied), so Caddy gets its own Let's Encrypt certificate. The existing CAA records already allow Let's Encrypt. Check public DNS from the VPS, not from home (home DNS is intercepted by AdGuard).
- **VPS changes go through the homelab repository** (`scripts/helix-vps/Caddyfile`, units, docs) in a pull request the owner merges; the live Caddyfile must match the repository afterwards. The Caddy site block imports the `access_log` snippet so CrowdSec and GoAccess see the traffic.
- The fetch step needs no credentials (all four repositories are public); it may use the workflow's `GITHUB_TOKEN` for API rate limits.

## Calls made while writing this (owner may revisit)

- Starlight's inline scripts move into files rather than hashes in the Caddyfile, so a Starlight upgrade never needs a homelab change to keep the site working.
- Branding is copied once from helix-site (tokens, fonts, logos, favicon) rather than fetched at build time; a later redesign is copied over by hand.
- Footer: the logo, the copyright line, and links back to helixtech.app (Tools, GitHub, Privacy). The site's call-to-action, full tool menu and screenshot gallery are not repeated. The header has the logo, search, the theme picker and a link to helixtech.app.

## Left to the builder

- How the fetch step works (tarball per tag, GitHub API, sparse checkout), where it runs (an Astro integration, a prebuild script) and how pages get Starlight front matter (title from the first `#` heading, which is then removed).
- How the two READMEs are split into pages and what the pages are called, and the sidebar order and labels within each tool.
- Link and image rewriting details, including anchors and relative image paths.
- How the theme maps the site's tokens onto Starlight's variables.
- What happens when a listed page is missing at a tag (recommended: fail the build loudly rather than publish a hole).
- Whether to add a Kuma keyword monitor for `docs.helixtech.app` (the owner adds home Kuma monitors in its UI; the VPS Kuma accepts direct changes).
