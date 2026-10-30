// Head tags Starlight does not set: a share card per tool, the US locale,
// the browser's theme color and the home-screen icon. A page with no intro
// paragraph is described by its tool's pitch. The home page's title
// is the site's name alone, not "Helix Tech Docs | Helix Tech Docs".
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { TOOLS } from '../scripts/sources.mjs';
import { pitches } from './data/pitches';

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const { head } = route;
  const tool = TOOLS.find((t) => route.id === t.slug || route.id.startsWith(`${t.slug}/`));
  const meta = (property: string) => head.find((tag) => tag.tag === 'meta' && tag.attrs?.property === property);

  if (route.id === '') {
    const title = head.find((tag) => tag.tag === 'title');
    if (title) title.content = route.entry.data.title;
    const type = meta('og:type');
    if (type?.attrs) type.attrs.content = 'website';
  }
  const pitch = tool && pitches[tool.slug];
  if (pitch && !route.entry.data.description) {
    const description = `${tool.name}: ${pitch.text}`;
    head.push(
      { tag: 'meta', attrs: { name: 'description', content: description } },
      { tag: 'meta', attrs: { property: 'og:description', content: description } },
    );
  }
  const locale = meta('og:locale');
  if (locale?.attrs) locale.attrs.content = 'en_US';

  const image = new URL(`/og/${tool?.slug ?? 'home'}.png`, context.site);
  const alt = tool ? `${tool.name} documentation` : 'Helix Tech Docs';
  head.push(
    { tag: 'meta', attrs: { property: 'og:image', content: image.href } },
    { tag: 'meta', attrs: { property: 'og:image:type', content: 'image/png' } },
    { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
    { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
    { tag: 'meta', attrs: { property: 'og:image:alt', content: alt } },
    { tag: 'meta', attrs: { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#11141c' } },
    { tag: 'meta', attrs: { name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#ffffff' } },
    { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } },
  );
});
