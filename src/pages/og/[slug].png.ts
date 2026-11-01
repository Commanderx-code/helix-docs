// One share card for the home page, one per tool, used by every page of that tool, and one for the homelab pages
import type { APIRoute } from 'astro';
import { TOOLS } from '../../../scripts/sources.mjs';
import { pitches } from '../../data/pitches';
import { card, type Card } from '../../og/card';

const pages: Record<string, Card> = {
  home: {
    eyebrow: 'Documentation',
    title: 'Helix Tech Docs',
    text: 'Install, learn and fix the Helix tools. Every page follows the tool’s latest release, and search covers them all.',
  },
  ...Object.fromEntries(
    TOOLS.map((tool) => [
      tool.slug,
      { eyebrow: 'Documentation', title: tool.name, text: pitches[tool.slug]?.text ?? '', accent: pitches[tool.slug]?.accent },
    ]),
  ),
  homelab: { eyebrow: 'Documentation', title: 'Homelab', text: pitches.homelab.text, accent: pitches.homelab.accent },
};

export function getStaticPaths() {
  return Object.entries(pages).map(([slug, props]) => ({ params: { slug }, props }));
}

export const GET: APIRoute = async ({ props }) =>
  new Response(await card(props as Card), { headers: { 'Content-Type': 'image/png' } });
