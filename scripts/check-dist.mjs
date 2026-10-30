// Checks the built site against what the Content-Security-Policy allows:
// no inline scripts or <style> elements, no event-handler attributes, and
// nothing loaded from another origin or from data: URLs. Links are fine.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TAG = /<([a-z][a-z0-9-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
const ATTR = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
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

function attributes(text) {
  const attrs = new Map();
  for (const m of text.matchAll(ATTR)) attrs.set(m[1].toLowerCase(), m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}

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
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = attributes(m[1]);
    if (!attrs.has('src') && attrs.get('type') !== 'application/ld+json') {
      problems.push(`${file}: inline script: ${m[2].trim().slice(0, 80)}`);
    }
  }
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    problems.push(`${file}: <style> element: ${m[1].trim().slice(0, 80)}`);
  }
  for (const m of html.matchAll(TAG)) {
    const tag = m[1].toLowerCase();
    const attrs = attributes(m[2]);
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
