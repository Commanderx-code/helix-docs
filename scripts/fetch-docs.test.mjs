import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { buildTool, resolveRef } from './fetch-docs.mjs';

const fixtures = path.join(import.meta.dirname, 'fixtures');
const reply = (status, body = {}) => async () => new Response(JSON.stringify(body), { status });
const outDir = () => mkdtemp(path.join(tmpdir(), 'helix-docs-'));

const toolbox = (files) => ({
  slug: 'toolbox',
  name: 'Helix Toolbox',
  repo: 'Commanderx-code/Helix-toolbox',
  kind: 'docs',
  docsDir: 'docs',
  pages: files.map(([file, slug], i) => ({ file, slug, order: i + 1 })),
  excludeImages: [],
  images: true,
});

describe('resolveRef', () => {
  test('resolves the latest release', async () => {
    await expect(resolveRef('Commanderx-code/Helix-toolbox', reply(200, { tag_name: 'v1.25.8' }))).resolves.toBe('v1.25.8');
  });

  test('falls back to main without releases', async () => {
    await expect(resolveRef('Commanderx-code/webos-launcher', reply(404))).resolves.toBe('main');
  });

  test('throws on rate limit', async () => {
    await expect(resolveRef('Commanderx-code/Helix-toolbox', reply(403))).rejects.toThrow(/403/);
  });
});

describe('buildTool', () => {
  test('fails on a missing listed page', async () => {
    const tool = toolbox([['INSTALL.md', 'install'], ['GUI.md', 'gui']]);
    await expect(buildTool(tool, path.join(fixtures, 'toolbox'), 'v1.25.8', await outDir())).rejects.toThrow(
      'Listed page missing: docs/GUI.md at v1.25.8',
    );
  });

  test('writes front matter', async () => {
    const out = await outDir();
    await buildTool(toolbox([['INSTALL.md', 'install']]), path.join(fixtures, 'toolbox'), 'v1.25.8', out);
    const page = await readFile(path.join(out, 'install.md'), 'utf8');
    expect(page.startsWith('---\ntitle: Installing Helix Toolbox\n')).toBe(true);
    expect(page).toContain('editUrl: https://github.com/Commanderx-code/Helix-toolbox/edit/main/docs/INSTALL.md');
    expect(page).toContain('sidebar:\n  order: 1\n');
    expect(page).not.toContain('# Installing Helix Toolbox');
  });

  test('copies the images a page uses', async () => {
    const out = await outDir();
    await buildTool(toolbox([['INSTALL.md', 'install']]), path.join(fixtures, 'toolbox'), 'v1.25.8', out);
    expect(await readFile(path.join(out, 'doctor.png'), 'utf8')).toBe('png');
    expect(await readFile(path.join(out, 'install.md'), 'utf8')).toContain('![Doctor](./doctor.png)');
  });

  test('splits a README into pages and reports skipped sections', async () => {
    const out = await outDir();
    const tool = {
      slug: 'touchdown',
      name: 'Touchdown',
      repo: 'Commanderx-code/touchdown-cli',
      kind: 'readme',
      introSlug: 'index',
      sections: [{ heading: 'Quick start', slug: 'quick-start', label: 'Quick start', order: 2 }],
      excludeImages: [],
      images: true,
    };
    const { written, skipped } = await buildTool(tool, path.join(fixtures, 'readme'), 'v0.1.0', out);
    expect(skipped).toEqual(['Development']);
    expect(written.map((f) => path.basename(f)).sort()).toEqual(['index.md', 'quick-start.md']);
    expect((await readdir(out)).sort()).toEqual(['index.md', 'quick-start.md']);
    const index = await readFile(path.join(out, 'index.md'), 'utf8');
    expect(index.startsWith('---\ntitle: Touchdown\n')).toBe(true);
    expect(index).toContain('[Quick start](/touchdown/quick-start/)');
    expect(index).toContain('editUrl: https://github.com/Commanderx-code/touchdown-cli/edit/main/README.md');
    const quick = await readFile(path.join(out, 'quick-start.md'), 'utf8');
    expect(quick).toContain('title: Quick start');
    expect(quick).toContain('Run it.');
  });

  test('reports drop texts the source no longer has', async () => {
    const tool = { ...toolbox([['INSTALL.md', 'install']]), dropBlocks: ['Read the', '| Gone table |'] };
    const { unusedDrops } = await buildTool(tool, path.join(fixtures, 'toolbox'), 'v1.25.8', await outDir());
    expect(unusedDrops).toEqual(['| Gone table |']);
  });
});
