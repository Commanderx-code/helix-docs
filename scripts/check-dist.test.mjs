import { describe, expect, test } from 'vitest';
import { checkHtml } from './check-dist.mjs';

const check = (html) => checkHtml(html, 'page.html');

describe('checkHtml', () => {
  test('flags inline scripts', () => {
    expect(check('<script>x()</script>')).toHaveLength(1);
    expect(check('<script type="module">x()</script>')).toHaveLength(1);
    expect(check('<script src="/a.js"></script>')).toEqual([]);
    expect(check('<script type="module" src="/a.js"></script>')).toEqual([]);
    expect(check('<script type="application/ld+json">{}</script>')).toEqual([]);
  });

  test('flags style elements', () => {
    expect(check('<style>a{}</style>')).toHaveLength(1);
    expect(check('<p style="color: red">x</p>')).toEqual([]);
  });

  test('flags remote assets', () => {
    expect(check('<link rel="stylesheet" href="https://x/a.css">')).toHaveLength(1);
    expect(check('<img src="https://x/a.png">')).toHaveLength(1);
    expect(check('<script src="//x/a.js"></script>')).toHaveLength(1);
    expect(check('<img srcset="/a.png 1x, https://x/b.png 2x">')).toHaveLength(1);
  });

  test('allows links to other sites', () => {
    expect(check('<a href="https://github.com/Commanderx-code">GitHub</a>')).toEqual([]);
    expect(check('<link rel="canonical" href="https://docs.helixtech.app/">')).toEqual([]);
    expect(check('<link rel="sitemap" href="/sitemap-index.xml">')).toEqual([]);
  });

  test('flags inline event handlers', () => {
    expect(check('<button onclick="go()">x</button>')).toHaveLength(1);
  });

  test('reads attribute values that contain >', () => {
    expect(check('<button data-code="drift <baseline> one more" title="x">c</button>')).toEqual([]);
    expect(check('<img alt="a > b" src="https://x/a.png">')).toHaveLength(1);
  });

  test('flags data: images', () => {
    expect(check('<img src="data:image/png;base64,AAAA">')).toHaveLength(1);
  });

  test('names the file in each problem', () => {
    expect(check('<style>a{}</style>')[0]).toContain('page.html');
  });
});
