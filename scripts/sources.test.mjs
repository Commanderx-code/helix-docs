import { describe, expect, test } from 'vitest';
import { TOOLS } from './sources.mjs';

const tool = (slug) => TOOLS.find((t) => t.slug === slug);

describe('TOOLS', () => {
  test('lists the four tools in sidebar order', () => {
    expect(TOOLS.map((t) => t.slug)).toEqual(['toolbox', 'boot', 'webos-launcher', 'touchdown']);
  });

  test('Toolbox pages are the reader pages, walkthrough first', () => {
    expect(tool('toolbox').pages.map((p) => p.slug)).toEqual([
      'walkthrough', 'install', 'guide', 'gui', 'catalog', 'reference',
      'json', 'events', 'migration', 'stability', 'security', 'reporting',
    ]);
    expect(tool('toolbox').pages.map((p) => p.file)).not.toContain('ARCHITECTURE.md');
  });

  test('Boot starts at its overview and leaves out the roadmap', () => {
    const pages = tool('boot').pages;
    expect(pages[0]).toMatchObject({ file: 'README.md', slug: 'index' });
    expect(pages.map((p) => p.file)).not.toContain('roadmap.md');
    expect(tool('boot').excludeImages).toEqual([
      'docs/themes-imported.jpg',
      'docs/boot-menu-folder.jpg',
      'docs/artwork/helix-icons-preview.png',
    ]);
  });

  test('webOS Launcher has no images and no Layout section', () => {
    expect(tool('webos-launcher').images).toBe(false);
    expect(tool('webos-launcher').sections.map((s) => s.heading)).not.toContain('Layout');
  });

  test('Touchdown leaves out Development', () => {
    expect(tool('touchdown').images).toBe(true);
    expect(tool('touchdown').sections.map((s) => s.heading)).not.toContain('Development');
  });

  test('slugs and orders are unique within each tool', () => {
    for (const t of TOOLS) {
      const entries = t.pages ?? t.sections;
      expect(new Set(entries.map((e) => e.slug)).size).toBe(entries.length);
      expect(new Set(entries.map((e) => e.order)).size).toBe(entries.length);
    }
  });
});
