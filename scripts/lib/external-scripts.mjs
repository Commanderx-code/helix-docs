// Moves inline <script> elements of the built pages into files, so the
// Content-Security-Policy can keep script-src at 'self'. Each script stays
// where it was and stays a plain (blocking) script, so the theme is still
// applied before the page paints.
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = /<script\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/script>/gi;

/**
 * @param {string} html
 * @returns {{ html: string, scripts: { path: string, content: string }[] }}
 */
export function externalizeScripts(html) {
  const scripts = [];
  const out = html.replace(SCRIPT, (whole, attrs, content) => {
    if (/\bsrc\s*=/i.test(attrs) || /\btype\s*=\s*["']?application\/ld\+json/i.test(attrs)) return whole;
    const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
    const file = `_scripts/${hash}.js`;
    scripts.push({ path: file, content });
    return `<script${attrs} src="/${file}"></script>`;
  });
  return { html: out, scripts };
}

/** @returns {import('astro').AstroIntegration} */
export default function externalScripts() {
  return {
    name: 'helix-external-scripts',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const entries = await readdir(root, { withFileTypes: true, recursive: true });
        const written = new Set();
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
          const file = path.join(entry.parentPath, entry.name);
          const { html, scripts } = externalizeScripts(await readFile(file, 'utf8'));
          if (!scripts.length) continue;
          for (const script of scripts) {
            if (written.has(script.path)) continue;
            await mkdir(path.join(root, path.dirname(script.path)), { recursive: true });
            await writeFile(path.join(root, script.path), script.content);
            written.add(script.path);
          }
          await writeFile(file, html);
        }
        logger.info(`${written.size} inline scripts moved into files`);
      },
    },
  };
}
