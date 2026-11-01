import { getCollection } from 'astro:content';
import { TOOLS } from '../../../scripts/sources.mjs';
import versions from '../../generated/versions.json';

export interface SectionDocs {
  slug: string;
  name: string;
  /** The release the pages come from, or 'main'; absent for pages written here */
  ref?: string;
  releaseUrl?: string;
  /** The section's first page */
  href: string;
  pages: { title: string; href: string }[];
}
export interface ToolDocs extends SectionDocs {
  ref: string;
  releaseUrl: string;
}

/** Each tool with its pages in sidebar order, for the release list */
export async function toolDocs(): Promise<ToolDocs[]> {
  return (await sectionDocs()).filter((s): s is ToolDocs => s.ref !== undefined);
}

/** Each tool with its pages in sidebar order, then the homelab pages, for the home page */
export async function sectionDocs(): Promise<SectionDocs[]> {
  const docs = await getCollection('docs');
  const refs: Record<string, string> = versions;
  const pagesOf = (slug: string) =>
    docs
      .filter((doc) => doc.id === slug || doc.id.startsWith(`${slug}/`))
      .sort((a, b) => (a.data.sidebar.order ?? 0) - (b.data.sidebar.order ?? 0))
      .map((doc) => ({ title: doc.data.title, href: `/${doc.id}/` }));
  const tools = TOOLS.map((tool) => {
    const pages = pagesOf(tool.slug);
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
  const homelab = pagesOf('homelab');
  return [...tools, { slug: 'homelab', name: 'Homelab', href: homelab[0]?.href ?? '/homelab/', pages: homelab }];
}
