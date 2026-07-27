import { describe, expect, it } from 'vitest';
import { escapeHtml, html, raw } from './html.js';

describe('escapeHtml', () => {
  it('escapes the five HTML metacharacters', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeHtml('Walls, doors and 4.20 m rooms')).toBe('Walls, doors and 4.20 m rooms');
  });
});

describe('html template', () => {
  it('escapes interpolated strings by default', () => {
    expect(html`<p>${'<script>alert(1)</script>'}</p>`.value).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    );
  });

  it('passes through nested SafeHtml and raw() unescaped', () => {
    const inner = html`<em>${'a & b'}</em>`;
    expect(html`<p>${inner}${raw('<br>')}</p>`.value).toBe('<p><em>a &amp; b</em><br></p>');
  });

  it('joins arrays of fragments without separators', () => {
    const items = ['a', 'b'].map((item) => html`<li>${item}</li>`);
    const rendered = html`<ul>
      ${items}
    </ul>`.value.replace(/\s+/g, '');
    expect(rendered).toBe('<ul><li>a</li><li>b</li></ul>');
  });

  it('renders null and undefined as nothing', () => {
    expect(html`<p>${null}${undefined}</p>`.value).toBe('<p></p>');
  });
});
