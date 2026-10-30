// The picture a page shows when its link is shared: a dark card with the
// page's eyebrow, title and a line of text, the logo, and a glow in the
// page's accent. Drawn at build time with satori and resvg, from the same
// fonts the site uses. The same card as helixtech.app's, with this site's
// address.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import logo from '../assets/brand/logo-on-dark.png';

export interface Card {
  eyebrow: string;
  title: string;
  text: string;
  /** The glow's colour; mint unless the page has its own accent */
  accent?: string;
}

const WIDTH = 1200;
const HEIGHT = 630;

const root = process.cwd();
const font = (file: string) => readFile(path.join(root, 'node_modules/@fontsource', file));
const assets = Promise.all([
  font('fira-sans-condensed/files/fira-sans-condensed-latin-800-normal.woff'),
  font('fira-sans/files/fira-sans-latin-400-normal.woff'),
  font('fira-sans/files/fira-sans-latin-500-normal.woff'),
  readFile(path.join(root, 'src/assets/brand/logo-on-dark.png')),
]);

type Style = Record<string, string | number>;
type Node = { type: string; props: Record<string, unknown> };
const box = (style: Style, children: Node[] | string): Node => ({ type: 'div', props: { style, children } });
const rgba = (hex: string, alpha: number) =>
  `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${alpha})`;

export async function card({ eyebrow, title, text, accent = '#5eead4' }: Card): Promise<Uint8Array<ArrayBuffer>> {
  const [display, body, medium, logoBytes] = await assets;
  const logoHeight = 60;
  const logoWidth = Math.round((logo.width / logo.height) * logoHeight);

  const svg = await satori(
    box(
      {
        position: 'relative',
        boxSizing: 'border-box',
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #0b0d12 0%, #11141c 100%)',
        color: '#eceef4',
        fontFamily: 'Fira Sans',
      },
      [
        box({
          position: 'absolute',
          right: -180,
          top: -220,
          width: 640,
          height: 640,
          borderRadius: 320,
          background: `radial-gradient(circle, ${rgba(accent, 0.28)} 0%, ${rgba(accent, 0)} 70%)`,
        }, ''),
        box({
          position: 'absolute',
          left: -200,
          bottom: -260,
          width: 520,
          height: 520,
          borderRadius: 260,
          background: `radial-gradient(circle, ${rgba('#a78bfa', 0.18)} 0%, ${rgba('#a78bfa', 0)} 70%)`,
        }, ''),
        box({ display: 'flex', flexDirection: 'column', gap: 22 }, [
          box({ fontSize: 24, fontWeight: 500, letterSpacing: 5, textTransform: 'uppercase', color: accent }, eyebrow),
          box(
            {
              fontFamily: 'Fira Sans Condensed',
              fontWeight: 800,
              fontSize: title.length > 22 ? 78 : 108,
              lineHeight: 1,
              letterSpacing: -2,
              maxWidth: 1000,
            },
            title,
          ),
          box({ fontSize: 32, lineHeight: 1.35, color: '#b4b9c9', maxWidth: 900 }, text),
        ]),
        box({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
          {
            type: 'img',
            props: { src: `data:image/png;base64,${logoBytes.toString('base64')}`, width: logoWidth, height: logoHeight },
          },
          box({ fontSize: 26, color: '#8b91a3' }, 'docs.helixtech.app'),
        ]),
      ],
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: 'Fira Sans Condensed', data: display, weight: 800, style: 'normal' },
        { name: 'Fira Sans', data: body, weight: 400, style: 'normal' },
        { name: 'Fira Sans', data: medium, weight: 500, style: 'normal' },
      ],
    },
  );
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
  const bytes = new Uint8Array(png.byteLength);
  bytes.set(png);
  return bytes;
}
