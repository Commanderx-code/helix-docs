// Downloads each tool's latest release (or main) and writes its listed pages
// into src/content/docs/<tool>/, with the images they use.
import { execFileSync } from 'node:child_process';
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractTitle, rewrite, splitReadme } from './lib/markdown.mjs';
import { TOOLS } from './sources.mjs';

const root = path.resolve(import.meta.dirname, '..');

/**
 * The tag of a repository's latest release, or 'main' when it has none.
 * @param {string} repo
 * @param {typeof fetch} fetchImpl
 */
export async function resolveRef(repo, fetchImpl = fetch) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'helix-docs' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetchImpl(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
  if (res.status === 404) return 'main';
  if (!res.ok) throw new Error(`GitHub API returned ${res.status} for ${repo}`);
  const { tag_name: tag } = await res.json();
  if (!tag) throw new Error(`No tag_name in the latest release of ${repo}`);
  return tag;
}

/** Reads a file from the extracted tree, refusing symlinks and anything outside it. */
async function readSource(srcRoot, repoPath, ref, what) {
  const file = path.resolve(srcRoot, repoPath);
  let info;
  try {
    info = await lstat(file);
  } catch {
    throw new Error(`${what} missing: ${repoPath} at ${ref}`);
  }
  if (!info.isFile()) throw new Error(`${what} is not a regular file: ${repoPath} at ${ref}`);
  // A symlinked folder on the way could still lead out of the tree
  if (!(await realpath(file)).startsWith((await realpath(srcRoot)) + path.sep)) {
    throw new Error(`${what} outside the repository: ${repoPath} at ${ref}`);
  }
  return file;
}

const PLAIN = /^[A-Za-z0-9][A-Za-z0-9 .,'()/+–—-]*$/;
const yamlString = (value) => (PLAIN.test(value) && !value.endsWith(' ') ? value : JSON.stringify(value));

function page({ title, order, editUrl, body }) {
  return [
    '---',
    `title: ${yamlString(title)}`,
    'sidebar:',
    `  order: ${order}`,
    `editUrl: ${editUrl}`,
    '---',
    '',
    body,
  ].join('\n');
}

const pageUrl = (toolSlug, slug) => (slug === 'index' ? `/${toolSlug}/` : `/${toolSlug}/${slug}/`);

/**
 * Writes one tool's pages and images into outDir, replacing what was there.
 * @param {import('./sources.mjs').ToolSource} tool
 * @param {string} srcRoot the extracted repository
 * @param {string} ref
 * @param {string} outDir
 * @returns {Promise<{ written: string[], skipped: string[], unusedDrops: string[] }>}
 */
export async function buildTool(tool, srcRoot, ref, outDir) {
  const editUrl = (sourcePath) => `https://github.com/${tool.repo}/edit/main/${sourcePath}`;
  const base = {
    repo: tool.repo,
    ref,
    excludeImages: tool.excludeImages,
    images: tool.images,
    imageDir: outDir,
    dropBlocks: tool.dropBlocks,
  };
  const pending = [];
  const sources = [];
  let skipped = [];

  if (tool.kind === 'docs') {
    const siteUrls = new Map(tool.pages.map((p) => [`${tool.docsDir}/${p.file}`, pageUrl(tool.slug, p.slug)]));
    for (const p of tool.pages) {
      const sourcePath = `${tool.docsDir}/${p.file}`;
      const file = await readSource(srcRoot, sourcePath, ref, 'Listed page');
      const text = await readFile(file, 'utf8');
      sources.push(text);
      const { title, body } = extractTitle(text);
      if (!title) throw new Error(`No # title in ${sourcePath} at ${ref}`);
      const { markdown, images } = rewrite(body, { ...base, sourcePath, siteUrls });
      pending.push({ slug: p.slug, title, order: p.order, sourcePath, markdown, images });
    }
  } else {
    const sourcePath = 'README.md';
    const file = await readSource(srcRoot, sourcePath, ref, 'Listed page');
    const text = await readFile(file, 'utf8');
    sources.push(text);
    const { body } = extractTitle(text);
    const split = splitReadme(body, tool.sections);
    skipped = split.skipped;
    const siteUrls = new Map([[sourcePath, pageUrl(tool.slug, tool.introSlug)]]);
    const anchorUrls = new Map();
    for (const p of split.pages) {
      const [own, ...inner] = p.anchors;
      anchorUrls.set(own, pageUrl(tool.slug, p.slug));
      for (const anchor of inner) anchorUrls.set(anchor, `${pageUrl(tool.slug, p.slug)}#${anchor}`);
    }
    const ctx = { ...base, sourcePath, siteUrls, anchorUrls };
    const parts = [{ slug: tool.introSlug, label: tool.name, order: 1, body: split.intro }, ...split.pages];
    for (const p of parts) {
      const { markdown, images } = rewrite(p.body, ctx);
      pending.push({ slug: p.slug, title: p.label, order: p.order, sourcePath, markdown, images });
    }
  }

  // Images are copied under their file name; two different files with one name would collide
  const copies = new Map();
  for (const { images } of pending) {
    for (const image of images) {
      const earlier = copies.get(image.to);
      if (earlier && earlier !== image.from) throw new Error(`Two images named ${path.basename(image.to)}: ${earlier} and ${image.from}`);
      copies.set(image.to, image.from);
    }
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  for (const [to, from] of copies) {
    await copyFile(await readSource(srcRoot, from, ref, 'Image'), to);
  }
  const written = [];
  for (const p of pending) {
    const target = path.join(outDir, `${p.slug}.md`);
    await writeFile(target, page({ title: p.title, order: p.order, editUrl: editUrl(p.sourcePath), body: p.markdown }));
    written.push(target);
  }
  // A drop text that matches nothing means the source changed: worth a look
  const unusedDrops = (tool.dropBlocks ?? []).filter((drop) => !sources.some((text) => text.includes(drop)));
  return { written, skipped, unusedDrops };
}

async function download(repo, ref, dir) {
  const res = await fetch(`https://codeload.github.com/${repo}/tar.gz/${encodeURIComponent(ref)}`);
  if (!res.ok) throw new Error(`Download of ${repo} at ${ref} returned ${res.status}`);
  const archive = path.join(dir, 'source.tar.gz');
  await writeFile(archive, Buffer.from(await res.arrayBuffer()));
  const tree = path.join(dir, 'tree');
  await mkdir(tree);
  execFileSync('tar', ['-xzf', archive, '--strip-components=1', '-C', tree]);
  return tree;
}

export async function main() {
  const versions = {};
  for (const tool of TOOLS) {
    const ref = await resolveRef(tool.repo);
    const work = await mkdtemp(path.join(tmpdir(), `helix-docs-${tool.slug}-`));
    try {
      const tree = await download(tool.repo, ref, work);
      const outDir = path.join(root, 'src/content/docs', tool.slug);
      const { written, skipped, unusedDrops } = await buildTool(tool, tree, ref, outDir);
      console.log(`${tool.name}: ${ref}, ${written.length} pages`);
      if (skipped.length) console.log(`  README sections left out: ${skipped.join(', ')}`);
      if (unusedDrops.length) console.warn(`  Drop texts not found (check sources.mjs): ${unusedDrops.join(', ')}`);
      versions[tool.slug] = ref;
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  }
  await mkdir(path.join(root, 'src/generated'), { recursive: true });
  await writeFile(path.join(root, 'src/generated/versions.json'), `${JSON.stringify(versions, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
