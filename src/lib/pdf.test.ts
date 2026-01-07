import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser } from 'playwright';
import { renderMarkdownSafe } from './markdown';

describe('PDF Export Integration', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  function generateHtml(content: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Document</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; }
    .katex-block { display: block; margin: 16px 0; text-align: center; }
    pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow: auto; }
    code { font-family: monospace; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d0d7de; padding: 6px 13px; }
  </style>
</head>
<body>
  <div class="markdown-body">${content}</div>
</body>
</html>`;
  }

  it('generates a valid PDF from simple markdown', async () => {
    const markdown = '# Hello World\n\nThis is a test document.';
    const html = renderMarkdownSafe(markdown);
    const fullHtml = generateHtml(html);

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle' });

    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },
    });

    await context.close();

    // PDF should be generated and have non-trivial size
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(1000); // PDFs are typically several KB
  });

  it('generates PDF with rendered LaTeX inline math', async () => {
    const markdown = 'The famous equation $E = mc^2$ changed physics.';
    const html = renderMarkdownSafe(markdown);
    const fullHtml = generateHtml(html);

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle' });

    // Check that KaTeX rendered in the page
    const katexElements = await page.locator('.katex').count();
    expect(katexElements).toBeGreaterThan(0);

    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },
    });

    await context.close();

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('generates PDF with rendered LaTeX block math', async () => {
    const markdown = `Here is the quadratic formula:

$$
x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

This is used to solve quadratic equations.`;
    const html = renderMarkdownSafe(markdown);
    const fullHtml = generateHtml(html);

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle' });

    // Check that KaTeX block rendered in the page
    const katexBlocks = await page.locator('.katex-block').count();
    expect(katexBlocks).toBeGreaterThan(0);

    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },
    });

    await context.close();

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('generates PDF with code blocks', async () => {
    const markdown = `# Code Example

\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
\`\`\`
`;
    const html = renderMarkdownSafe(markdown);
    const fullHtml = generateHtml(html);

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle' });

    // Check that code block rendered
    const preElements = await page.locator('pre').count();
    expect(preElements).toBeGreaterThan(0);

    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },
    });

    await context.close();

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('generates PDF with tables', async () => {
    const markdown = `# Table Example

| Feature | Status |
|---------|--------|
| Markdown | Yes |
| LaTeX | Yes |
| PDF | Yes |
`;
    const html = renderMarkdownSafe(markdown);
    const fullHtml = generateHtml(html);

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle' });

    // Check that table rendered
    const tableElements = await page.locator('table').count();
    expect(tableElements).toBeGreaterThan(0);

    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },
    });

    await context.close();

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('generates comprehensive PDF with all features', async () => {
    const markdown = `# Comprehensive Test Document

This document tests all major features of the markdown-to-PDF converter.

## Text Formatting

This is **bold**, this is *italic*, and this is \`inline code\`.

## Lists

- Item 1
- Item 2
  - Nested item
- Item 3

1. First
2. Second
3. Third

## Code Block

\`\`\`typescript
interface User {
  name: string;
  age: number;
}

const user: User = { name: 'Alice', age: 30 };
\`\`\`

## Table

| Column A | Column B | Column C |
|----------|----------|----------|
| 1 | 2 | 3 |
| 4 | 5 | 6 |

## Math (LaTeX)

Inline: $\\alpha + \\beta = \\gamma$

Block:

$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

## Blockquote

> This is a blockquote.
> It can span multiple lines.

## Horizontal Rule

---

*End of document*
`;
    const html = renderMarkdownSafe(markdown);
    const fullHtml = generateHtml(html);

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle' });

    // Verify all elements are present
    expect(await page.locator('h1').count()).toBeGreaterThan(0);
    expect(await page.locator('h2').count()).toBeGreaterThan(0);
    expect(await page.locator('ul').count()).toBeGreaterThan(0);
    expect(await page.locator('ol').count()).toBeGreaterThan(0);
    expect(await page.locator('pre').count()).toBeGreaterThan(0);
    expect(await page.locator('table').count()).toBeGreaterThan(0);
    expect(await page.locator('.katex').count()).toBeGreaterThan(0);
    expect(await page.locator('blockquote').count()).toBeGreaterThan(0);
    expect(await page.locator('hr').count()).toBeGreaterThan(0);

    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '1.5cm', bottom: '1cm', left: '1cm', right: '1cm' },
      printBackground: true,
    });

    await context.close();

    expect(pdf).toBeInstanceOf(Buffer);
    // Comprehensive document should be larger
    expect(pdf.length).toBeGreaterThan(5000);
  });
});
