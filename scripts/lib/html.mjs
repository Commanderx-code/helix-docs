// Walks the elements of an HTML page with a real parser, so text inside
// attribute values (such as a code block's data-code) is never read as tags.
import { parse } from 'parse5';

/**
 * @param {string} html
 * @returns {Generator<{ tag: string, attrs: Map<string, string>, text: string,
 *   start: number, end: number, startTagEnd: number }>}
 */
export function* elements(html) {
  const stack = [parse(html, { sourceCodeLocationInfo: true })];
  while (stack.length) {
    const node = stack.pop();
    if (node.tagName) {
      const loc = node.sourceCodeLocation;
      // Elements the parser adds itself (html, head, body) have no location
      if (loc) {
        yield {
          tag: node.tagName,
          attrs: new Map(node.attrs.map((a) => [a.name, a.value])),
          text: (node.childNodes ?? []).filter((c) => c.nodeName === '#text').map((c) => c.value).join(''),
          start: loc.startOffset,
          end: loc.endOffset,
          startTagEnd: loc.startTag?.endOffset ?? loc.endOffset,
        };
      }
    }
    const children = [...(node.childNodes ?? []), ...(node.content?.childNodes ?? [])];
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
  }
}
