import { getCollection } from 'astro:content';
import { TOOLS } from '../../../scripts/sources.mjs';
import versions from '../../generated/versions.json';

export interface ToolDocs {
  slug: string;
  name: string;
  /** The release the pages come from, or 'main' */
  ref: string;
  releaseUrl: string;
  /** The tool's first page */
  href: string;
  pages: { title: string; href: string }[];
}

/** Each tool with its pages in sidebar order, for the home page */
export async function toolDocs(): Promise<ToolDocs[]> {
  const docs = await getCollection('docs');
  const refs: Record<string, string> = versions;
  return TOOLS.map((tool) => {
    const pages = docs
      .filter((doc) => doc.id === tool.slug || doc.id.startsWith(`${tool.slug}/`))
      .sort((a, b) => (a.data.sidebar.order ?? 0) - (b.data.sidebar.order ?? 0))
      .map((doc) => ({ title: doc.data.title, href: `/${doc.id}/` }));
    const ref = refs[tool.slug] ?? 'main';
    return {
      slug: tool.slug,
      name: tool.name,
      ref,
      releaseUrl:
        ref === 'main'
          ? `https://github.com/${tool.repo}/commits/main/`
          : `https://github.com/${tool.repo}/releases/tag/${encodeURIComponent(ref)}`,
      href: pages[0]?.href ?? `/${tool.slug}/`,
      pages,
    };
  });
}
