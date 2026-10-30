import { describe, expect, test } from 'vitest';
import { extractTitle, rewrite, splitReadme, summarize } from './markdown.mjs';

const toolbox = (overrides = {}) => ({
  repo: 'Commanderx-code/Helix-toolbox',
  ref: 'v1.25.8',
  sourcePath: 'docs/INSTALL.md',
  siteUrls: new Map([
    ['docs/GUIDE.md', '/toolbox/guide/'],
    ['docs/INSTALL.md', '/toolbox/install/'],
  ]),
  excludeImages: [],
  images: true,
  imageDir: 'src/content/docs/toolbox',
  ...overrides,
});
const blob = 'https://github.com/Commanderx-code/Helix-toolbox/blob/v1.25.8';
const tree = 'https://github.com/Commanderx-code/Helix-toolbox/tree/v1.25.8';

describe('extractTitle', () => {
  test('extracts the title', () => {
    expect(extractTitle('# Installing Helix Toolbox\n\nText')).toEqual({
      title: 'Installing Helix Toolbox',
      body: 'Text\n',
    });
  });

  test('keeps what comes before the title', () => {
    const { title, body } = extractTitle('<p><img src="assets/banner.svg"></p>\n\n# Touchdown\n\nText\n');
    expect(title).toBe('Touchdown');
    expect(body).toBe('<p><img src="assets/banner.svg"></p>\n\nText\n');
  });

  test('ignores a heading inside a code block', () => {
    expect(extractTitle('```sh\n# not a title\n```\n\n# Real\n').title).toBe('Real');
  });
});

describe('rewrite links', () => {
  test('rewrites listed pages', () => {
    expect(rewrite('See [guide](GUIDE.md).\n', toolbox()).markdown).toBe('See [guide](/toolbox/guide/).\n');
  });

  test('keeps anchors', () => {
    expect(rewrite('[plans](GUIDE.md#plans)\n', toolbox()).markdown).toBe('[plans](/toolbox/guide/#plans)\n');
  });

  test('sends unlisted targets to GitHub', () => {
    const md = '[a](ARCHITECTURE.md) [r](../README.md) [s](../src) [d](./)\n';
    expect(rewrite(md, toolbox()).markdown).toBe(
      `[a](${blob}/docs/ARCHITECTURE.md) [r](${blob}/README.md) [s](${tree}/src) [d](${tree}/docs)\n`,
    );
  });

  test('resolves links from the repository root', () => {
    expect(rewrite('[g](/docs/GUIDE.md) [c](/Cargo.toml)\n', toolbox()).markdown).toBe(
      `[g](/toolbox/guide/) [c](${blob}/Cargo.toml)\n`,
    );
  });

  test('leaves external and in-page links alone', () => {
    const md = '[e](https://example.com) [s](#section) [m](mailto:security@helixstack.io)\n';
    expect(rewrite(md, toolbox()).markdown).toBe(md);
  });

  test('leaves links in code alone', () => {
    const md = '```md\n[x](GUIDE.md)\n```\n\nUse `[x](GUIDE.md)` here.\n';
    expect(rewrite(md, toolbox()).markdown).toBe(md);
  });

  test('rewrites link definitions', () => {
    expect(rewrite('[guide][g]\n\n[g]: GUIDE.md "The guide"\n', toolbox()).markdown).toBe(
      '[guide][g]\n\n[g]: /toolbox/guide/ "The guide"\n',
    );
  });

  test('rewrites links in HTML', () => {
    expect(rewrite('<a href="GUIDE.md#plans">plans</a>\n', toolbox()).markdown).toBe(
      '<a href="/toolbox/guide/#plans">plans</a>\n',
    );
  });

  test('sends anchors of split README sections to their page', () => {
    const ctx = toolbox({
      sourcePath: 'README.md',
      siteUrls: new Map([['README.md', '/touchdown/']]),
      anchorUrls: new Map([
        ['quick-start', '/touchdown/quick-start/'],
        ['keys', '/touchdown/controls/#keys'],
      ]),
    });
    expect(rewrite('[q](#quick-start) [k](#keys) [o](#other)\n', ctx).markdown).toBe(
      `[q](/touchdown/quick-start/) [k](/touchdown/controls/#keys) [o](${blob}/README.md#other)\n`,
    );
  });

  test('changes nothing else in the file', () => {
    const md = '* one\n* two\n\n__bold__ and *it* [g](GUIDE.md)\n\n| a | b |\n|---|---|\n| 1 | 2 |\n';
    expect(rewrite(md, toolbox()).markdown).toBe(md.replace('GUIDE.md', '/toolbox/guide/'));
  });
});

describe('rewrite images', () => {
  const boot = (overrides = {}) =>
    toolbox({
      repo: 'Commanderx-code/helix-boot',
      ref: 'v0.7.7',
      sourcePath: 'docs/look.md',
      siteUrls: new Map(),
      imageDir: 'src/content/docs/boot',
      ...overrides,
    });

  test('copies relative images', () => {
    const { markdown, images } = rewrite('![a](themes.jpg)\n', boot());
    expect(markdown).toBe('![a](./themes.jpg)\n');
    expect(images).toEqual([{ from: 'docs/themes.jpg', to: 'src/content/docs/boot/themes.jpg' }]);
  });

  test('copies images from subfolders under their file name', () => {
    const { markdown, images } = rewrite('![n](artwork/helix-neon-preview.jpg)\n', boot());
    expect(markdown).toBe('![n](./helix-neon-preview.jpg)\n');
    expect(images).toEqual([
      { from: 'docs/artwork/helix-neon-preview.jpg', to: 'src/content/docs/boot/helix-neon-preview.jpg' },
    ]);
  });

  test('localizes raw GitHub images', () => {
    const md =
      '<img src="https://raw.githubusercontent.com/Commanderx-code/Helix-toolbox/main/assets/screenshots/gui-doctor.png" width="820" alt="Doctor">\n';
    const { markdown, images } = rewrite(md, toolbox({ sourcePath: 'docs/GUI.md' }));
    expect(markdown).toBe('![Doctor](./gui-doctor.png)\n');
    expect(images).toEqual([
      { from: 'assets/screenshots/gui-doctor.png', to: 'src/content/docs/toolbox/gui-doctor.png' },
    ]);
  });

  test('localizes GitHub blob images of the same repository', () => {
    const md = '![d](https://github.com/Commanderx-code/Helix-toolbox/blob/main/assets/x.png?raw=true)\n';
    const { markdown, images } = rewrite(md, toolbox());
    expect(markdown).toBe('![d](./x.png)\n');
    expect(images).toEqual([{ from: 'assets/x.png', to: 'src/content/docs/toolbox/x.png' }]);
  });

  test('converts images in an HTML block and drops the wrapper', () => {
    const md = '<p align="center">\n  <img src="../assets/banner.svg" alt="Touchdown">\n</p>\n\nText\n';
    const { markdown, images } = rewrite(md, toolbox({ sourcePath: 'docs/a.md' }));
    expect(markdown).toBe('![Touchdown](./banner.svg)\n\nText\n');
    expect(images).toEqual([{ from: 'assets/banner.svg', to: 'src/content/docs/toolbox/banner.svg' }]);
  });

  test('drops excluded images', () => {
    const md = 'Before.\n\n<img src="boot-menu-folder.jpg" alt="Folder menu">\n\nAfter ![t](themes-imported.jpg) text.\n';
    const { markdown, images } = rewrite(
      md,
      boot({ sourcePath: 'docs/tools.md', excludeImages: ['docs/boot-menu-folder.jpg', 'docs/themes-imported.jpg'] }),
    );
    expect(markdown).not.toMatch(/boot-menu-folder|themes-imported|<img/);
    expect(markdown).toMatch(/Before\./);
    expect(markdown).toMatch(/After\s+text\./);
    expect(images).toEqual([]);
  });

  test('copies an image inside a link and rewrites both', () => {
    const md = '[![s](assets/s.png)](assets/s.png)\n';
    const { markdown, images } = rewrite(md, boot({ sourcePath: 'README.md' }));
    expect(markdown).toBe('[![s](./s.png)](https://github.com/Commanderx-code/helix-boot/blob/v0.7.7/assets/s.png)\n');
    expect(images).toEqual([{ from: 'assets/s.png', to: 'src/content/docs/boot/s.png' }]);
  });

  test('drops the link around a dropped image', () => {
    const md = 'A [![t](themes-imported.jpg)](themes-imported.jpg) B\n';
    const { markdown } = rewrite(md, boot({ excludeImages: ['docs/themes-imported.jpg'] }));
    expect(markdown).toBe('A  B\n');
  });

  test('drops all images when images is false', () => {
    const md = '![a](a.png)\n\n<img src="b.png" alt="b">\n\nText <img src="c.png"> here.\n';
    const { markdown, images } = rewrite(md, toolbox({ images: false }));
    expect(markdown).not.toMatch(/a\.png|b\.png|c\.png|<img/);
    expect(markdown).toMatch(/Text\s+here\./);
    expect(images).toEqual([]);
  });

  test('leaves images in code alone', () => {
    const md = '```html\n<img src="b.png">\n```\n';
    expect(rewrite(md, toolbox({ images: false })).markdown).toBe(md);
  });
});

describe('splitReadme', () => {
  const readme = [
    'Intro text.',
    '',
    '## Controls',
    '',
    'Press keys.',
    '',
    '### Keys',
    '',
    'More.',
    '',
    '## Layout',
    '',
    'Tree.',
    '',
    '## License',
    '',
    'MIT.',
    '',
  ].join('\n');
  const sections = [{ heading: 'Controls', slug: 'controls', label: 'Controls', order: 2 }];

  test('splits a README', () => {
    const { intro, pages, skipped } = splitReadme(readme, sections);
    expect(intro).toBe('Intro text.\n');
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ slug: 'controls', label: 'Controls', order: 2 });
    expect(pages[0].body).toBe('Press keys.\n\n### Keys\n\nMore.\n');
    expect(skipped).toEqual(['Layout', 'License']);
  });

  test('fails on a listed section the README lacks', () => {
    expect(() => splitReadme(readme, [...sections, { heading: 'Setup', slug: 'setup', label: 'Setup', order: 1 }])).toThrow(
      'Listed section missing: Setup',
    );
  });
});

describe('GitHub alerts', () => {
  test('become Starlight asides', () => {
    const md = 'Before.\n\n> [!TIP]\n> Use **Parted Magic** for [SSDs](GUIDE.md).\n>\n> Second paragraph.\n\nAfter.\n';
    expect(rewrite(md, toolbox()).markdown).toBe(
      'Before.\n\n:::tip\nUse **Parted Magic** for [SSDs](/toolbox/guide/).\n\nSecond paragraph.\n:::\n\nAfter.\n',
    );
  });

  test('map each kind to an aside', () => {
    const kinds = { NOTE: ':::note', IMPORTANT: ':::note[Important]', WARNING: ':::caution', CAUTION: ':::danger' };
    for (const [kind, aside] of Object.entries(kinds)) {
      expect(rewrite(`> [!${kind}]\n> Text.\n`, toolbox()).markdown).toBe(`${aside}\nText.\n:::\n`);
    }
  });

  test('leave plain quotes alone', () => {
    const md = '> A quote [!TIP] here.\n';
    expect(rewrite(md, toolbox()).markdown).toBe(md);
  });
});

describe('dropBlocks', () => {
  test('removes top-level blocks that start with a listed text', () => {
    const md = 'Intro.\n\n| Plex rows | Edit |\n| --- | --- |\n| ![a](a.jpg) | ![b](b.jpg) |\n\n*Shown with a wallpaper of your own.*\n\nAfter.\n';
    const ctx = toolbox({ images: false, dropBlocks: ['| Plex rows |', '*Shown with a wallpaper'] });
    expect(rewrite(md, ctx).markdown).toBe('Intro.\n\nAfter.\n');
  });

  test('leaves blocks that only mention the text later', () => {
    const md = 'See | Plex rows | here.\n';
    expect(rewrite(md, toolbox({ dropBlocks: ['| Plex rows |'] })).markdown).toBe(md);
  });
});

describe('raw scripts', () => {
  test('fail the page, so a script in a tool repository never reaches the site', () => {
    expect(() => rewrite('Text\n\n<script>alert(1)</script>\n', toolbox())).toThrow(/script.*docs\/INSTALL\.md/i);
    expect(() => rewrite('Inline <script src="/x.js"></script> here.\n', toolbox())).toThrow(/script/i);
  });

  test('are fine inside code', () => {
    const md = '```html\n<script>alert(1)</script>\n```\n\nUse `<script>` tags.\n';
    expect(rewrite(md, toolbox()).markdown).toBe(md);
  });
});

describe('review fixes', () => {
  test('a link title containing ]( keeps the destination edit in place', () => {
    expect(rewrite('[x](GUIDE.md "see ](here")\n', toolbox()).markdown).toBe('[x](/toolbox/guide/ "see ](here")\n');
    const ctx = toolbox({ repo: 'Commanderx-code/helix-boot', ref: 'v0.7.7', sourcePath: 'docs/look.md', siteUrls: new Map() });
    expect(rewrite('![a](themes.jpg "t ](x")\n', ctx).markdown).toBe('![a](./themes.jpg "t ](x")\n');
  });

  test('a link above the repository root goes to the repository on GitHub', () => {
    expect(rewrite('[up](../../x.md)\n', toolbox()).markdown).toBe(`[up](${tree})\n`);
  });

  test('an unquoted href is rewritten', () => {
    expect(rewrite('<a href=GUIDE.md>g</a>\n', toolbox()).markdown).toBe('<a href="/toolbox/guide/">g</a>\n');
  });

  test('image references are copied', () => {
    const ctx = toolbox({ repo: 'Commanderx-code/helix-boot', ref: 'v0.7.7', sourcePath: 'docs/look.md', siteUrls: new Map(), imageDir: 'out' });
    const { markdown, images } = rewrite('![a][s]\n\n[s]: themes.jpg "Themes"\n', ctx);
    expect(markdown).toBe('![a][s]\n\n[s]: ./themes.jpg "Themes"\n');
    expect(images).toEqual([{ from: 'docs/themes.jpg', to: 'out/themes.jpg' }]);
  });

  test('image references are dropped with their definition', () => {
    const { markdown, images } = rewrite('Text ![a][s] here.\n\n[s]: shot.png\n', toolbox({ images: false }));
    expect(markdown).not.toMatch(/shot\.png|!\[a\]/);
    expect(markdown).toMatch(/Text\s+here\./);
    expect(images).toEqual([]);
  });

  test('raw GitHub URLs with refs/heads/ resolve to the repository path', () => {
    const md = '<img src="https://raw.githubusercontent.com/Commanderx-code/Helix-toolbox/refs/heads/main/assets/x.png" alt="X">\n';
    expect(rewrite(md, toolbox()).images).toEqual([{ from: 'assets/x.png', to: 'src/content/docs/toolbox/x.png' }]);
  });

  test('HTML outside the README allowlist fails the page', () => {
    expect(() => rewrite('<meta http-equiv="refresh" content="0;url=https://x">\n', toolbox())).toThrow(/<meta>.*docs\/INSTALL\.md/);
    expect(() => rewrite('Text <iframe src="/x"></iframe>\n', toolbox())).toThrow(/<iframe>/);
    expect(rewrite('<!-- note -->\n\n<details><summary>s</summary>\n\nx\n\n</details>\n', toolbox()).markdown).toContain('<details>');
  });
});

describe('splitReadme anchor targets', () => {
  const readme = 'Intro.\n\n### Install\n\n## One\n\n### Usage\n\n## Two\n\n### Usage\n\n## Gone\n';
  const sections = [
    { heading: 'One', slug: 'one', label: 'One', order: 2 },
    { heading: 'Two', slug: 'two', label: 'Two', order: 3 },
  ];

  test('map README anchors to the page and its own heading ids', () => {
    const { anchorTargets } = splitReadme(readme, sections);
    expect(Object.fromEntries(anchorTargets)).toEqual({
      install: { page: null, anchor: 'install' },
      one: { page: 'one', anchor: '' },
      usage: { page: 'one', anchor: 'usage' },
      two: { page: 'two', anchor: '' },
      'usage-1': { page: 'two', anchor: 'usage' },
    });
  });
});

describe('summarize', () => {
  test('gives the first paragraph as plain text', () => {
    expect(summarize('Start with the [README](../README.md) for `helix` and **more**.\n')).toBe(
      'Start with the README for helix and more.',
    );
  });

  test('skips HTML, image-only paragraphs and notes', () => {
    const md = '<p align="center"><img src="a.svg"></p>\n\n![Build](b.svg) ![License](c.svg)\n\n:::note\nA note.\n:::\n\nReal text here.\n';
    expect(summarize(md)).toBe('Real text here.');
  });

  test('joins wrapped lines', () => {
    expect(summarize('One line\nand the next.\n')).toBe('One line and the next.');
  });

  test('cuts a long paragraph after the last whole sentence that fits', () => {
    const first = 'A'.repeat(100) + '.';
    expect(summarize(`${first} ${'B'.repeat(100)}.`)).toBe(first);
  });

  test('cuts one long sentence at a word, with an ellipsis', () => {
    const text = Array.from({ length: 60 }, () => 'word').join(' ');
    const summary = summarize(text);
    expect(summary.length).toBeLessThanOrEqual(160);
    expect(summary.endsWith('word…')).toBe(true);
  });

  test('drops a closing sentence that leads into a list', () => {
    expect(summarize('A home screen for TVs. From the top:\n\n- one\n')).toBe('A home screen for TVs.');
  });

  test('ends a lone lead-in sentence with a period', () => {
    expect(summarize('Set a favorite from the terminal:\n\n- one\n')).toBe('Set a favorite from the terminal.');
  });

  test('looks only before the first heading', () => {
    expect(summarize('<!-- generated -->\n\n## Applications\n\n- a list\n\nLater text.\n')).toBeUndefined();
  });

  test('gives undefined when there is no paragraph', () => {
    expect(summarize('## Only a heading\n\n- a list\n')).toBeUndefined();
  });
});
