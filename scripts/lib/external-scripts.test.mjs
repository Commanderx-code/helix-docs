import { describe, expect, test } from 'vitest';
import { externalizeScripts } from './external-scripts.mjs';

describe('externalizeScripts', () => {
  test('moves an inline script into a file at the same place', () => {
    const { html, scripts } = externalizeScripts('<head><script>a()</script><link rel="x"></head>');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].content).toBe('a()');
    expect(scripts[0].path).toMatch(/^_scripts\/[0-9a-f]{16}\.js$/);
    expect(html).toBe(`<head><script src="/${scripts[0].path}"></script><link rel="x"></head>`);
  });

  test('keeps the attributes', () => {
    const { html, scripts } = externalizeScripts('<script type="module" aria-hidden="true">b()</script>');
    expect(html).toBe(`<script type="module" aria-hidden="true" src="/${scripts[0].path}"></script>`);
  });

  test('names a file by its content, so pages share it', () => {
    const one = externalizeScripts('<script>same()</script>');
    const two = externalizeScripts('<p>x</p><script>same()</script>');
    expect(one.scripts[0].path).toBe(two.scripts[0].path);
  });

  test('leaves scripts with src and JSON-LD alone', () => {
    const html = '<script src="/a.js"></script><script type="application/ld+json">{"a":1}</script>';
    expect(externalizeScripts(html)).toEqual({ html, scripts: [] });
  });
});
