// The tools on the site and the pages taken from each. Pages are an explicit
// list: a file added to a tool's docs/ folder, or a README section, does not
// appear here until it is listed.

/**
 * @typedef {{ file: string, slug: string, order: number }} Page
 * @typedef {{ heading: string, slug: string, label: string, order: number }} Section
 * @typedef {{
 *   slug: string, name: string, repo: string, kind: 'docs' | 'readme',
 *   docsDir?: string, pages?: Page[], sections?: Section[], introSlug?: string,
 *   excludeImages: string[], images: boolean, dropBlocks?: string[],
 * }} ToolSource
 */

const pages = (files) => files.map(([file, slug], i) => ({ file, slug, order: i + 1 }));
// The README intro is page 1; sections follow
const sections = (list) => list.map(([heading, slug, label], i) => ({ heading, slug, label: label ?? heading, order: i + 2 }));

/** @type {ToolSource[]} */
export const TOOLS = [
  {
    slug: 'toolbox',
    name: 'Helix Toolbox',
    repo: 'Commanderx-code/Helix-toolbox',
    kind: 'docs',
    docsDir: 'docs',
    pages: pages([
      ['walkthrough.md', 'walkthrough'],
      ['INSTALL.md', 'install'],
      ['GUIDE.md', 'guide'],
      ['GUI.md', 'gui'],
      ['CATALOG.md', 'catalog'],
      ['REFERENCE.md', 'reference'],
      ['JSON.md', 'json'],
      ['EVENTS.md', 'events'],
      ['MIGRATION.md', 'migration'],
      ['STABILITY.md', 'stability'],
      ['SECURITY.md', 'security'],
      ['REPORTING.md', 'reporting'],
    ]),
    excludeImages: [],
    images: true,
  },
  {
    slug: 'boot',
    name: 'Helix Boot',
    repo: 'Commanderx-code/helix-boot',
    kind: 'docs',
    docsDir: 'docs',
    pages: pages([
      ['README.md', 'index'],
      ['install.md', 'install'],
      ['tools.md', 'tools'],
      ['look.md', 'look'],
      ['theming.md', 'theming'],
      ['tool-icons.md', 'tool-icons'],
      ['packs.md', 'packs'],
      ['engine.md', 'engine'],
      ['lazarus-pe.md', 'lazarus-pe'],
      ['testing.md', 'testing'],
      ['code-signing.md', 'code-signing'],
    ]),
    // Other people's work: imported GRUB themes and vendor logos
    excludeImages: [
      'docs/themes-imported.jpg',
      'docs/boot-menu-folder.jpg',
      'docs/artwork/helix-icons-preview.png',
    ],
    images: true,
  },
  {
    slug: 'webos-launcher',
    name: 'webOS Launcher',
    repo: 'Commanderx-code/webos-launcher',
    kind: 'readme',
    introSlug: 'index',
    sections: sections([
      ['Controls', 'controls'],
      ['Setup', 'setup'],
      ['Settings in config.json', 'settings'],
      ['Automatic updates', 'automatic-updates'],
      ['On a rooted TV', 'rooted-tv'],
      ['Keeping Developer Mode alive', 'developer-mode'],
      ["What it can't do", 'limits'],
    ]),
    excludeImages: [],
    // The screenshots show a wallpaper that is not ours to republish
    images: false,
    // The screenshot table and its caption, which are empty without the images
    dropBlocks: ['| Plex rows |', '*Shown with a wallpaper'],
  },
  {
    slug: 'touchdown',
    name: 'Touchdown',
    repo: 'Commanderx-code/touchdown-cli',
    kind: 'readme',
    introSlug: 'index',
    sections: sections([
      ['Features', 'features'],
      ['Quick start', 'quick-start'],
      ['Screenshots', 'screenshots'],
      ['Controls', 'controls'],
      ['Favorite team and theme', 'favorite-team'],
      ['Command-line options', 'options'],
      ['Data and refresh behavior', 'data'],
    ]),
    excludeImages: [],
    images: true,
  },
];
