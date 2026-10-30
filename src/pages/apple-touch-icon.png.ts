// The icon iPhones and iPads use for a saved page: the favicon at 180 pixels,
// on its own navy so the corners iOS rounds off are not transparent
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { APIRoute } from 'astro';
import { Resvg } from '@resvg/resvg-js';

export const GET: APIRoute = async () => {
  const svg = await readFile(path.join(process.cwd(), 'public/favicon.svg'), 'utf8');
  const png = new Resvg(svg, { background: '#0d0f2c', fitTo: { mode: 'width', value: 180 } }).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
