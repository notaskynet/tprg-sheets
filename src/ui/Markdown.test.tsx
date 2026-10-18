import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Markdown, toggleTask } from './Markdown';

describe('Markdown', () => {
  it('renders gfm: headings, lists, tasks, tables', () => {
    const html = renderToString(<Markdown source={'# Title\n\n- a\n- [ ] todo\n- [x] done\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n**bold**'} />);
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<table>');
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
  });
  it('does not render raw html or javascript: links', () => {
    const html = renderToString(<Markdown source={'<script>alert(1)</script>\n\n[x](javascript:alert(1))'} />);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('javascript:');
  });
  it('toggles the nth task marker only', () => {
    const src = '- [ ] one\n- [x] two\n  - [ ] three';
    expect(toggleTask(src, 0)).toBe('- [x] one\n- [x] two\n  - [ ] three');
    expect(toggleTask(src, 1)).toBe('- [ ] one\n- [ ] two\n  - [ ] three');
    expect(toggleTask(src, 2)).toBe('- [ ] one\n- [x] two\n  - [x] three');
  });
});
