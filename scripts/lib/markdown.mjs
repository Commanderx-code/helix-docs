// Turns a tool's Markdown into a page for this site: the title moves into
// front matter, links to other listed pages stay on the site, links to
// anything else go to GitHub at the same ref, and images are copied in.
//
// Edits are made on the original text at the positions remark reports, so
// everything not rewritten (code, tables, spacing) stays byte-for-byte.
import path from 'node:path';
import GithubSlugger from 'github-slugger';
import { toString } from 'mdast-util-to-string';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

const parser = unified().use(remarkParse).use(remarkGfm);
const parse = (markdown) => parser.parse(markdown);

const posix = path.posix;
const IMG_TAG = /<img\b[^>]*>/gi;
const A_HREF = /(<a\b[^>]*?\bhref\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
// HTML a README may use; anything else (meta, iframe, form, picture...) fails the page
const ALLOWED_TAGS = new Set(
  'a abbr b blockquote br code dd del details div dl dt em figcaption figure h1 h2 h3 h4 h5 h6 hr i img ins kbd li mark ol p pre s samp small span strong sub summary sup table tbody td tfoot th thead tr u ul'.split(' '),
);
const PHRASING_PARENTS = new Set(['paragraph', 'heading', 'link', 'emphasis', 'strong', 'delete', 'tableCell']);

const start = (node) => node.position.start.offset;
const end = (node) => node.position.end.offset;

/** Ends text with exactly one newline, or returns '' for blank text. */
function tidy(text) {
  const trimmed = text.trim();
  return trimmed ? `${trimmed}\n` : '';
}

/**
 * The first level-one heading becomes the title and leaves the body.
 * @param {string} markdown
 * @returns {{ title: string, body: string }}
 */
export function extractTitle(markdown) {
  let heading;
  visit(parse(markdown), 'heading', (node) => {
    if (node.depth === 1 && !heading) heading = node;
  });
  if (!heading) return { title: '', body: tidy(markdown) };
  const before = markdown.slice(0, start(heading)).trimEnd();
  const after = markdown.slice(end(heading)).trimStart();
  return {
    title: toString(heading).trim(),
    body: tidy(before ? `${before}\n\n${after}` : after),
  };
}

const SUMMARY_MAX = 160;

/**
 * The page's first paragraph as plain text, for its description: at most
 * 160 characters, cut after a whole sentence when one fits, else at a word.
 * Only the intro before the first heading counts; badges, HTML and notes
 * are passed over.
 * @param {string} markdown
 * @returns {string | undefined}
 */
export function summarize(markdown) {
  for (const node of parse(markdown).children) {
    if (node.type === 'heading') break;
    if (node.type !== 'paragraph') continue;
    let text = toString(node, { includeImageAlt: false }).replace(/\s+/g, ' ').trim();
    if (!text || text.startsWith(':::')) continue;
    // A paragraph that leads into a list ends with a colon: keep what comes before
    if (text.endsWith(':')) text = text.match(/^.*[.!?](?=\s)/)?.[0] ?? `${text.slice(0, -1)}.`;
    if (text.length <= SUMMARY_MAX) return text;
    const fits = text.slice(0, SUMMARY_MAX);
    const sentence = fits.match(/^.*[.!?](?=\s)/);
    if (sentence) return sentence[0];
    return `${fits.slice(0, fits.lastIndexOf(' ', SUMMARY_MAX - 1))}…`;
  }
  return undefined;
}

/**
 * Splits a README into the intro (before the first `##`) and one page per
 * listed `##` section. Sections not listed are returned in `skipped`.
 * @param {string} markdown
 * @param {{ heading: string, slug: string, label: string, order: number }[]} sections
 */
export function splitReadme(markdown, sections) {
  const tree = parse(markdown);
  const slugger = new GithubSlugger();
  const anchorOf = new Map();
  visit(tree, 'heading', (node) => {
    anchorOf.set(node, slugger.slug(toString(node)));
  });

  const h2s = tree.children.filter((node) => node.type === 'heading' && node.depth === 2);
  const intro = tidy(markdown.slice(0, h2s.length ? start(h2s[0]) : markdown.length));
  const found = new Map();
  const skipped = [];
  h2s.forEach((node, i) => {
    const heading = toString(node).trim();
    const stop = i + 1 < h2s.length ? start(h2s[i + 1]) : markdown.length;
    const section = sections.find((s) => s.heading === heading);
    if (!section) {
      skipped.push(heading);
      return;
    }
    found.set(heading, {
      slug: section.slug,
      label: section.label,
      order: section.order,
      body: tidy(markdown.slice(end(node), stop)),
    });
  });

  for (const section of sections) {
    if (!found.has(section.heading)) throw new Error(`Listed section missing: ${section.heading}`);
  }

  // Where each README anchor ends up: its page (null for the intro) and the
  // id the heading gets there, since each page numbers repeated headings alone
  const anchorTargets = new Map();
  const pageSluggers = new Map();
  for (const [node, anchor] of anchorOf) {
    const owner = h2s.filter((h2) => start(h2) <= start(node)).at(-1);
    let page = null;
    if (owner) {
      const section = sections.find((s) => s.heading === toString(owner).trim());
      if (!section) continue;
      page = section.slug;
      if (node === owner) {
        anchorTargets.set(anchor, { page, anchor: '' });
        continue;
      }
    }
    if (!pageSluggers.has(page)) pageSluggers.set(page, new GithubSlugger());
    anchorTargets.set(anchor, { page, anchor: pageSluggers.get(page).slug(toString(node)) });
  }

  const pages = [...found.values()].sort((a, b) => a.order - b.order);
  return { intro, pages, skipped, anchorTargets };
}

/** Splits `path#hash` (dropping any query) into its parts. */
function splitUrl(url) {
  const hashAt = url.indexOf('#');
  const hash = hashAt >= 0 ? url.slice(hashAt + 1) : '';
  const rest = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const queryAt = rest.indexOf('?');
  return { pathPart: queryAt >= 0 ? rest.slice(0, queryAt) : rest, hash };
}

const isExternal = (url) => /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//');

/** The repo path a relative or root-relative URL points at, or null outside the repo. */
function repoPath(pathPart, ctx) {
  let decoded;
  try {
    decoded = decodeURI(pathPart);
  } catch {
    decoded = pathPart;
  }
  const joined = decoded.startsWith('/')
    ? posix.normalize(decoded.slice(1) || '.')
    : posix.normalize(posix.join(posix.dirname(ctx.sourcePath), decoded));
  const resolved = joined.replace(/\/+$/, '');
  if (resolved === '..' || resolved.startsWith('../')) return null;
  return resolved === '.' ? '' : resolved;
}

/** The new URL for a link, or null to leave it as written. */
function resolveLink(url, ctx) {
  if (!url || isExternal(url)) return null;
  const { pathPart, hash } = splitUrl(url);
  const github = (kind, target) => {
    const base = `https://github.com/${ctx.repo}/${kind}/${ctx.ref}`;
    return target ? `${base}/${encodeURI(target)}` : base;
  };
  // In a split README an anchor may be on another page, or in a section left
  // out of the site, where only GitHub has it
  const readmeAnchor = (anchor) => ctx.anchorUrls.get(anchor) ?? `${github('blob', ctx.sourcePath)}#${anchor}`;
  if (!pathPart) return hash && ctx.anchorUrls ? readmeAnchor(hash) : null;

  const target = repoPath(pathPart, ctx);
  // Above the repository root: GitHub would not find it either
  if (target === null) return github('tree', '');
  const suffix = hash ? `#${hash}` : '';
  if (target === ctx.sourcePath && hash && ctx.anchorUrls) return readmeAnchor(hash);
  if (ctx.siteUrls.has(target)) return ctx.siteUrls.get(target) + suffix;

  const isFile = !pathPart.endsWith('/') && /\.[^/]+$/.test(target);
  return github(isFile ? 'blob' : 'tree', target) + suffix;
}

/**
 * Where an image comes from in the repository, or null for an image hosted
 * somewhere else (left as written; the dist check rejects it).
 */
function imageSource(url, ctx) {
  if (!url) return null;
  const sameRepo = (owner, repo) => `${owner}/${repo}`.toLowerCase() === ctx.repo.toLowerCase();
  // The branch or tag in the URL is skipped: images come from the build's ref
  let match = url.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(?:refs\/(?:heads|tags)\/)?[^/]+\/([^?#]+)/);
  if (match && sameRepo(match[1], match[2])) return decodeURI(match[3]);
  match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(?:refs\/(?:heads|tags)\/)?[^/]+\/([^?#]+)/);
  if (match && sameRepo(match[1], match[2])) return decodeURI(match[3]);
  if (isExternal(url)) return null;
  return repoPath(splitUrl(url).pathPart, ctx);
}

/**
 * Decides what happens to one image: dropped, copied in (with the URL the
 * page uses), or kept as written.
 */
function placeImage(url, ctx, images) {
  const from = imageSource(url, ctx);
  if (!ctx.images || (from && ctx.excludeImages.includes(from))) return { action: 'drop' };
  if (!from) return { action: 'keep' };
  const name = posix.basename(from);
  if (!images.some((image) => image.from === from)) {
    images.push({ from, to: posix.join(ctx.imageDir, name) });
  }
  return { action: 'copy', url: `./${name}` };
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
}

const markdownImage = (alt, url) => `![${(alt ?? '').replace(/[[\]]/g, '\\$&')}](${url})`;

/** Wraps a destination in angle brackets when it would not parse bare. */
const destination = (url) => (/[\s()<>]/.test(url) ? `<${url}>` : url);

/**
 * The [from, to) offsets of the destination inside `[text](dest "title")`
 * or `[label]: dest "title"`, searching from `from`.
 */
function destinationRange(source, from, limit) {
  let i = from;
  while (i < limit && /\s/.test(source[i])) i++;
  if (source[i] === '<') {
    const close = source.indexOf('>', i);
    return [i, close + 1];
  }
  let depth = 0;
  let j = i;
  for (; j < limit; j++) {
    const ch = source[j];
    if (/\s/.test(ch)) break;
    if (ch === '\\') {
      j++;
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') {
      if (depth === 0) break;
      depth--;
    }
  }
  return [i, j];
}

/** The offset of the `]` closing a bracket opened just before `from`, or -1. */
function closingBracket(source, from) {
  let depth = 0;
  for (let i = from; i < source.length; i++) {
    const ch = source[i];
    if (ch === '\\') i++;
    else if (ch === '[') depth++;
    else if (ch === ']') {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

/**
 * Offsets of the destination of an inline link or image node, or null for
 * autolinks and references. Found from the end of the link text, so a title
 * containing `](` is not mistaken for it.
 */
function inlineDestination(source, node) {
  const s = start(node);
  const e = end(node);
  if (source[e - 1] !== ')') return null;
  let close;
  if (node.type === 'link') {
    if (source[s] !== '[') return null;
    close = node.children.length ? end(node.children.at(-1)) : s + 1;
  } else {
    if (!source.startsWith('![', s)) return null;
    close = closingBracket(source, s + 2);
  }
  if (close < 0 || !source.startsWith('](', close)) return null;
  return destinationRange(source, close + 2, e - 1);
}

/** Removes a block node and the blank line after it. */
function blockRemoval(source, node) {
  let e = end(node);
  while (source[e] === '\n') e++;
  return { start: start(node), end: e, text: '' };
}

function rewriteHtml(node, parent, source, ctx, images) {
  const s = start(node);
  const e = end(node);
  const html = source.slice(s, e);
  // Only plain README markup gets through. The build moves the site's own
  // inline scripts into files, so a <script> here would pass the CSP, and a
  // <meta> refresh could send visitors elsewhere
  for (const m of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)/g)) {
    const tag = m[1].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) throw new Error(`Unsupported HTML <${tag}> in ${ctx.sourcePath}; the docs site publishes only plain README markup`);
  }
  const inline = PHRASING_PARENTS.has(parent?.type);
  const tags = [...html.matchAll(IMG_TAG)].map((m) => m[0]);

  if (!inline && tags.length && html.replace(/<[^>]*>/g, '').trim() === '') {
    // A block of nothing but images and their wrappers: keep just the images
    const kept = tags.flatMap((tag) => {
      const placed = placeImage(attr(tag, 'src'), ctx, images);
      if (placed.action === 'drop') return [];
      return [placed.action === 'copy' ? markdownImage(attr(tag, 'alt'), placed.url) : tag];
    });
    return kept.length ? { start: s, end: e, text: kept.join('\n\n') } : blockRemoval(source, node);
  }

  const text = html
    .replace(IMG_TAG, (tag) => {
      const placed = placeImage(attr(tag, 'src'), ctx, images);
      if (placed.action === 'drop') return '';
      if (placed.action === 'keep') return tag;
      if (!inline) {
        throw new Error(`Image inside an HTML block with text in ${ctx.sourcePath}: ${attr(tag, 'src')}`);
      }
      return markdownImage(attr(tag, 'alt'), placed.url);
    })
    .replace(A_HREF, (whole, prefix, double, single, bare) => {
      const href = double ?? single ?? bare;
      const next = resolveLink(href, ctx);
      return next === null ? whole : `${prefix}"${next}"`;
    });
  return text === html ? null : { start: s, end: e, text };
}

const ASIDES = { NOTE: 'note', TIP: 'tip', IMPORTANT: 'note[Important]', WARNING: 'caution', CAUTION: 'danger' };

/** Turns GitHub alerts (`> [!TIP]` quotes) at the top level into Starlight asides. */
function convertAlerts(source) {
  const edits = [];
  for (const node of parse(source).children) {
    if (node.type !== 'blockquote') continue;
    const lines = source.slice(start(node), end(node)).split('\n');
    const kind = lines[0].match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/);
    if (!kind) continue;
    const body = lines
      .slice(1)
      .map((line) => line.replace(/^>\s?/, ''))
      .join('\n')
      .trim();
    edits.push({ start: start(node), end: end(node), text: `:::${ASIDES[kind[1]]}\n${body}\n:::` });
  }
  return applyEdits(source, edits);
}

/** Applies edits to the text; outer edits win over edits inside them. */
function applyEdits(source, edits) {
  edits.sort((a, b) => a.start - b.start || b.end - a.end);
  let out = '';
  let at = 0;
  for (const edit of edits) {
    if (edit.start < at) continue;
    out += source.slice(at, edit.start) + edit.text;
    at = edit.end;
  }
  return out + source.slice(at);
}

/**
 * Rewrites links and images of one page, and GitHub alerts into asides.
 * @param {string} markdown
 * @param {{ repo: string, ref: string, sourcePath: string, siteUrls: Map<string, string>,
 *   anchorUrls?: Map<string, string>, excludeImages: string[], images: boolean, imageDir: string,
 *   dropBlocks?: string[] }} ctx dropBlocks: top-level blocks starting with one of these texts are removed
 * @returns {{ markdown: string, images: { from: string, to: string }[] }}
 */
export function rewrite(markdown, ctx) {
  const source = markdown;
  const images = [];
  const edits = [];

  const tree = parse(source);
  for (const node of tree.children) {
    if (ctx.dropBlocks?.some((text) => source.startsWith(text, start(node)))) edits.push(blockRemoval(source, node));
  }

  // Definitions used by image references are images, wherever they point
  const imageRefs = new Set();
  visit(tree, 'imageReference', (node) => {
    imageRefs.add(node.identifier);
  });
  const imageDefs = new Map();
  visit(tree, 'definition', (node) => {
    if (imageRefs.has(node.identifier) && !imageDefs.has(node.identifier)) {
      imageDefs.set(node.identifier, placeImage(node.url, ctx, images));
    }
  });
  const dropImage = (node, parent) => {
    const onlyChild = parent?.type === 'link' && parent.children.length === 1;
    edits.push(onlyChild ? { start: start(parent), end: end(parent), text: '' } : { start: start(node), end: end(node), text: '' });
  };

  visit(tree, (node, _index, parent) => {
    if (node.type === 'definition' && imageDefs.has(node.identifier)) {
      const placed = imageDefs.get(node.identifier);
      if (placed.action === 'drop') edits.push(blockRemoval(source, node));
      if (placed.action === 'copy') {
        const colon = source.indexOf(']:', start(node));
        const [a, b] = destinationRange(source, colon + 2, end(node));
        edits.push({ start: a, end: b, text: destination(placed.url) });
      }
    } else if (node.type === 'imageReference') {
      if (imageDefs.get(node.identifier)?.action === 'drop') dropImage(node, parent);
    } else if (node.type === 'link') {
      const range = inlineDestination(source, node);
      const next = range && resolveLink(node.url, ctx);
      if (next !== null && range) edits.push({ start: range[0], end: range[1], text: destination(next) });
    } else if (node.type === 'definition') {
      const colon = source.indexOf(']:', start(node));
      const [a, b] = destinationRange(source, colon + 2, end(node));
      const next = resolveLink(node.url, ctx);
      if (next !== null) edits.push({ start: a, end: b, text: destination(next) });
    } else if (node.type === 'image') {
      const placed = placeImage(node.url, ctx, images);
      if (placed.action === 'drop') {
        dropImage(node, parent);
      } else if (placed.action === 'copy') {
        const range = inlineDestination(source, node);
        if (range) edits.push({ start: range[0], end: range[1], text: destination(placed.url) });
      }
    } else if (node.type === 'html') {
      const edit = rewriteHtml(node, parent, source, ctx, images);
      if (edit) edits.push(edit);
    }
  });

  // Alerts are a second pass, so links inside them are already rewritten
  return { markdown: convertAlerts(applyEdits(source, edits)), images };
}
