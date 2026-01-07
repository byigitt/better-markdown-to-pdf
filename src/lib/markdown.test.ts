import { describe, it, expect } from 'vitest';
import { renderMarkdown, renderMarkdownSafe } from './markdown';

describe('Markdown Rendering', () => {
  describe('Basic Markdown', () => {
    it('renders headings', () => {
      const result = renderMarkdown('# Hello World');
      expect(result).toContain('<h1>');
      expect(result).toContain('Hello World');
      expect(result).toContain('</h1>');
    });

    it('renders multiple heading levels', () => {
      const input = '# H1\n## H2\n### H3\n#### H4';
      const result = renderMarkdown(input);
      expect(result).toContain('<h1>');
      expect(result).toContain('<h2>');
      expect(result).toContain('<h3>');
      expect(result).toContain('<h4>');
    });

    it('renders bold text', () => {
      const result = renderMarkdown('**bold text**');
      expect(result).toContain('<strong>bold text</strong>');
    });

    it('renders italic text', () => {
      const result = renderMarkdown('*italic text*');
      expect(result).toContain('<em>italic text</em>');
    });

    it('renders links', () => {
      const result = renderMarkdown('[link](https://example.com)');
      expect(result).toContain('<a href="https://example.com"');
      expect(result).toContain('>link</a>');
    });

    it('renders unordered lists', () => {
      const input = '- Item 1\n- Item 2\n- Item 3';
      const result = renderMarkdown(input);
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
      expect(result).toContain('<li>Item 2</li>');
      expect(result).toContain('<li>Item 3</li>');
      expect(result).toContain('</ul>');
    });

    it('renders ordered lists', () => {
      const input = '1. First\n2. Second\n3. Third';
      const result = renderMarkdown(input);
      expect(result).toContain('<ol>');
      expect(result).toContain('<li>First</li>');
      expect(result).toContain('</ol>');
    });

    it('renders blockquotes', () => {
      const result = renderMarkdown('> This is a quote');
      expect(result).toContain('<blockquote>');
      expect(result).toContain('This is a quote');
      expect(result).toContain('</blockquote>');
    });

    it('renders horizontal rules', () => {
      const result = renderMarkdown('---');
      expect(result).toContain('<hr');
    });

    it('renders images', () => {
      const result = renderMarkdown('![alt text](image.png)');
      expect(result).toContain('<img');
      expect(result).toContain('src="image.png"');
      expect(result).toContain('alt="alt text"');
    });
  });

  describe('Code Blocks', () => {
    it('renders inline code', () => {
      const result = renderMarkdown('Use `console.log()` for debugging');
      expect(result).toContain('<code>');
      expect(result).toContain('console.log()');
      expect(result).toContain('</code>');
    });

    it('renders fenced code blocks', () => {
      const input = '```javascript\nconst x = 1;\n```';
      const result = renderMarkdown(input);
      expect(result).toContain('<pre');
      expect(result).toContain('const');
      expect(result).toContain('x');
      expect(result).toContain('1');
      expect(result).toContain('</pre>');
    });

    it('applies syntax highlighting', () => {
      const input = '```javascript\nfunction test() { return true; }\n```';
      const result = renderMarkdown(input);
      expect(result).toContain('hljs');
      expect(result).toContain('language-javascript');
    });

    it('handles code blocks without language', () => {
      const input = '```\nplain text\n```';
      const result = renderMarkdown(input);
      expect(result).toContain('<pre');
      expect(result).toContain('plain text');
    });
  });

  describe('Tables', () => {
    it('renders tables', () => {
      const input = '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1 | Cell 2 |';
      const result = renderMarkdown(input);
      expect(result).toContain('<table>');
      expect(result).toContain('<th>');
      expect(result).toContain('Header 1');
      expect(result).toContain('<td>');
      expect(result).toContain('Cell 1');
      expect(result).toContain('</table>');
    });
  });

  describe('Task Lists', () => {
    it('renders task lists with checkboxes', () => {
      const input = '- [ ] Unchecked\n- [x] Checked';
      const result = renderMarkdown(input);
      expect(result).toContain('type="checkbox"');
      // Check for unchecked
      expect(result).toMatch(/<input[^>]*type="checkbox"[^>]*>/);
      // Check for checked
      expect(result).toMatch(/<input[^>]*checked/);
    });
  });

  describe('Mermaid Diagrams', () => {
    it('wraps mermaid code blocks in div', () => {
      const input = '```mermaid\ngraph TD\n    A --> B\n```';
      const result = renderMarkdown(input);
      expect(result).toContain('<div class="mermaid">');
      expect(result).toContain('graph TD');
      expect(result).toContain('A --&gt; B');
    });
  });
});

describe('LaTeX Rendering', () => {
  describe('Inline Math', () => {
    it('renders simple inline math', () => {
      const result = renderMarkdown('The equation $E = mc^2$ is famous.');
      expect(result).toContain('katex');
      expect(result).toContain('E');
      expect(result).toContain('m');
      expect(result).not.toContain('$E = mc^2$');
    });

    it('renders inline math with Greek letters', () => {
      const result = renderMarkdown('The constant $\\pi$ is approximately 3.14.');
      expect(result).toContain('katex');
    });

    it('renders multiple inline math expressions', () => {
      const result = renderMarkdown('Given $a = 1$ and $b = 2$, we have $a + b = 3$.');
      // Count katex occurrences (should have 3)
      const matches = result.match(/katex/g);
      expect(matches).toBeTruthy();
      expect(matches!.length).toBeGreaterThanOrEqual(3);
    });

    it('does not render escaped dollar signs', () => {
      const result = renderMarkdown('The price is \\$10.');
      expect(result).toContain('$10');
    });

    it('handles fractions', () => {
      const result = renderMarkdown('Half is $\\frac{1}{2}$.');
      expect(result).toContain('katex');
    });

    it('handles subscripts and superscripts', () => {
      const result = renderMarkdown('Water is $H_2O$ and area is $r^2$.');
      expect(result).toContain('katex');
    });
  });

  describe('Block Math', () => {
    it('renders simple block math', () => {
      const input = '$$\nx = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n$$';
      const result = renderMarkdown(input);
      expect(result).toContain('katex-block');
      expect(result).toContain('katex');
    });

    it('renders single-line block math', () => {
      const input = '$$x^2 + y^2 = z^2$$';
      const result = renderMarkdown(input);
      expect(result).toContain('katex-block');
    });

    it('renders integrals', () => {
      const input = '$$\n\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}\n$$';
      const result = renderMarkdown(input);
      expect(result).toContain('katex-block');
      expect(result).toContain('katex');
    });

    it('renders summations', () => {
      const input = '$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$';
      const result = renderMarkdown(input);
      expect(result).toContain('katex-block');
    });

    it('renders matrices', () => {
      const input = '$$\n\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}\n$$';
      const result = renderMarkdown(input);
      expect(result).toContain('katex-block');
    });
  });

  describe('Error Handling', () => {
    it('handles invalid LaTeX gracefully', () => {
      const result = renderMarkdown('Invalid: $\\invalid{command}$');
      // Should not throw, should render with error message
      expect(result).toBeTruthy();
    });

    it('handles empty math expressions', () => {
      const result = renderMarkdown('Empty: $$');
      // Should not crash
      expect(result).toBeTruthy();
    });
  });
});

describe('Sanitization', () => {
  it('sanitizes XSS attempts', () => {
    const malicious = '<script>alert("xss")</script>';
    const result = renderMarkdownSafe(malicious);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
  });

  it('sanitizes event handlers', () => {
    const malicious = '<img src="x" onerror="alert(\'xss\')">';
    const result = renderMarkdownSafe(malicious);
    expect(result).not.toContain('onerror');
  });

  it('preserves safe HTML', () => {
    const safe = '<strong>Bold</strong> and <em>italic</em>';
    const result = renderMarkdownSafe(safe);
    expect(result).toContain('<strong>Bold</strong>');
    expect(result).toContain('<em>italic</em>');
  });

  it('preserves KaTeX elements', () => {
    const result = renderMarkdownSafe('Math: $x^2$');
    expect(result).toContain('katex');
  });
});
