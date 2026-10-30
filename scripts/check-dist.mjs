// Checks the built site against what the Content-Security-Policy allows:
// no inline scripts or <style> elements, no event-handler attributes, and
// nothing loaded from another origin or from data: URLs. Links are fine.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { elements } from './lib/html.mjs';

// Attributes that make the browser fetch something, per element
const LOADS = {
  script: ['src'],
  img: ['src', 'srcset'],
  source: ['src', 'srcset'],
  video: ['src', 'poster'],
  audio: ['src'],
  iframe: ['src'],
  embed: ['src'],
  object: ['data'],
  input: ['src'],
};
const LINK_LOADS = new Set(['stylesheet', 'icon', 'preload', 'modulepreload', 'prefetch', 'manifest', 'apple-touch-icon']);
// Where the build writes scripts: Astro's bundles and the moved inline scripts
const SCRIPT_PATHS = ['/_astro/', '/_scripts/'];

const urlsOf = (name, value) => (name === 'srcset' ? value.split(',').map((part) => part.trim().split(/\s+/)[0]) : [value]);
const isRemote = (url) => /^(https?:)?\/\//i.test(url.trim());
const isData = (url) => /^data:/i.test(url.trim());

/**
 * @param {string} html
 * @param {string} file shown in each problem
 * @returns {string[]} problems, empty when clean
 */
export function checkHtml(html, file) {
  const problems = [];
  for (const { tag, attrs, text } of elements(html)) {
    if (tag === 'script') {
      const src = attrs.get('src');
      if (src === undefined && attrs.get('type') !== 'application/ld+json') {
        problems.push(`${file}: inline script: ${text.trim().slice(0, 80)}`);
      } else if (src !== undefined && !isRemote(src) && !SCRIPT_PATHS.some((p) => src.startsWith(p))) {
        problems.push(`${file}: script from a path the build does not write: ${src}`);
      }
    }
    if (tag === 'style') problems.push(`${file}: <style> element: ${text.trim().slice(0, 80)}`);
    for (const name of attrs.keys()) {
      if (/^on[a-z]+$/.test(name)) problems.push(`${file}: <${tag} ${name}> event handler`);
    }
    let names = LOADS[tag] ?? [];
    if (tag === 'link') {
      const rel = (attrs.get('rel') ?? '').toLowerCase().split(/\s+/);
      names = rel.some((r) => LINK_LOADS.has(r)) ? ['href'] : [];
    }
    for (const name of names) {
      if (!attrs.has(name)) continue;
      for (const url of urlsOf(name, attrs.get(name))) {
        if (isRemote(url)) problems.push(`${file}: <${tag} ${name}> loads from another origin: ${url}`);
        if (isData(url)) problems.push(`${file}: <${tag} ${name}> uses a data: URL`);
      }
    }
  }
  return problems;
}

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((e) => e.isFile() && e.name.endsWith('.html')).map((e) => path.join(e.parentPath, e.name));
}

async function main(dir) {
  const problems = [];
  for (const file of await htmlFiles(dir)) {
    problems.push(...checkHtml(await readFile(file, 'utf8'), path.relative(dir, file)));
  }
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2] ?? 'dist').catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
