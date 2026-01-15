import { NextRequest, NextResponse } from 'next/server';
import { chromium, Browser } from 'playwright';
import { renderMarkdownSafe, MarkdownOptions } from '@/lib/markdown';

type HighlightTheme = 'github' | 'monokai' | 'dracula' | 'vs2015' | 'atom-one-dark' | 'atom-one-light';
type ExportFormat = 'pdf' | 'html';

interface ExportOptions {
  pageSize: 'a4' | 'letter';
  margins: 'normal' | 'narrow' | 'wide';
  theme: 'light' | 'dark';
  fontSize: string;
  highlightTheme: HighlightTheme;
  format: ExportFormat;
  markdownOptions: MarkdownOptions;
}

interface ExportRequest {
  markdown: string;
  options?: Partial<ExportOptions>;
}

const MARGIN_CONFIGS = {
  normal: { top: '1.5cm', bottom: '1.5cm', left: '1.5cm', right: '1.5cm' },
  narrow: { top: '0.5cm', bottom: '0.5cm', left: '0.5cm', right: '0.5cm' },
  wide: { top: '3cm', bottom: '2.5cm', left: '3cm', right: '3cm' },
};

const PAGE_FORMATS = {
  a4: 'A4' as const,
  letter: 'Letter' as const,
};

const HIGHLIGHT_THEMES: Record<HighlightTheme, string> = {
  github: `
    .hljs{color:#4d4d4c;background:#f6f8fa}
    .hljs-comment,.hljs-quote{color:#8e908c}
    .hljs-variable,.hljs-tag,.hljs-name,.hljs-selector-id,.hljs-selector-class,.hljs-regexp,.hljs-deletion{color:#c82829}
    .hljs-number,.hljs-built_in,.hljs-literal,.hljs-type,.hljs-params,.hljs-meta,.hljs-link{color:#f5871f}
    .hljs-attribute{color:#eab700}
    .hljs-string,.hljs-symbol,.hljs-bullet,.hljs-addition{color:#718c00}
    .hljs-title,.hljs-section{color:#4271ae}
    .hljs-keyword,.hljs-selector-tag{color:#8959a8}
  `,
  monokai: `
    .hljs{background:#272822;color:#ddd}
    .hljs-tag,.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-strong,.hljs-name{color:#f92672}
    .hljs-code{color:#66d9ef}
    .hljs-attribute,.hljs-symbol,.hljs-regexp,.hljs-link{color:#bf79db}
    .hljs-string,.hljs-bullet,.hljs-subst,.hljs-title,.hljs-section,.hljs-emphasis,.hljs-type,.hljs-built_in,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-addition,.hljs-variable,.hljs-template-tag,.hljs-template-variable{color:#a6e22e}
    .hljs-title.class_,.hljs-class .hljs-title{color:#fff}
    .hljs-comment,.hljs-quote,.hljs-deletion,.hljs-meta{color:#75715e}
  `,
  dracula: `
    .hljs{background:#282a36;color:#f8f8f2}
    .hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-section,.hljs-link{color:#ff79c6}
    .hljs-function .hljs-keyword{color:#ff79c6}
    .hljs-subst{color:#f8f8f2}
    .hljs-string,.hljs-title,.hljs-name,.hljs-type,.hljs-attribute,.hljs-symbol,.hljs-bullet,.hljs-addition,.hljs-variable,.hljs-template-tag,.hljs-template-variable{color:#f1fa8c}
    .hljs-comment,.hljs-quote,.hljs-deletion,.hljs-meta{color:#6272a4}
    .hljs-number{color:#bd93f9}
    .hljs-built_in,.hljs-class .hljs-title,.hljs-title.class_{color:#50fa7b}
  `,
  vs2015: `
    .hljs{background:#1E1E1E;color:#DCDCDC}
    .hljs-keyword,.hljs-literal,.hljs-symbol,.hljs-name{color:#569CD6}
    .hljs-link{color:#569CD6;text-decoration:underline}
    .hljs-built_in,.hljs-type{color:#4EC9B0}
    .hljs-number,.hljs-class{color:#B8D7A3}
    .hljs-string,.hljs-meta .hljs-string{color:#D69D85}
    .hljs-regexp,.hljs-template-tag{color:#9A5334}
    .hljs-subst,.hljs-function,.hljs-title,.hljs-params,.hljs-formula{color:#DCDCDC}
    .hljs-comment,.hljs-quote{color:#57A64A;font-style:italic}
    .hljs-doctag{color:#608B4E}
    .hljs-meta,.hljs-meta .hljs-keyword,.hljs-tag{color:#9B9B9B}
    .hljs-variable,.hljs-template-variable{color:#BD63C5}
    .hljs-attr,.hljs-attribute{color:#9CDCFE}
    .hljs-section{color:#ffd700}
  `,
  'atom-one-dark': `
    .hljs{background:#282c34;color:#abb2bf}
    .hljs-comment,.hljs-quote{color:#5c6370;font-style:italic}
    .hljs-doctag,.hljs-keyword,.hljs-formula{color:#c678dd}
    .hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#e06c75}
    .hljs-literal{color:#56b6c2}
    .hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#98c379}
    .hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#d19a66}
    .hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#61aeee}
    .hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#e6c07b}
  `,
  'atom-one-light': `
    .hljs{background:#fafafa;color:#383a42}
    .hljs-comment,.hljs-quote{color:#a0a1a7;font-style:italic}
    .hljs-doctag,.hljs-keyword,.hljs-formula{color:#a626a4}
    .hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#e45649}
    .hljs-literal{color:#0184bb}
    .hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#50a14f}
    .hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#986801}
    .hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#4078f2}
    .hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#c18401}
  `,
};

function generateHtml(content: string, fontSize: string, highlightTheme: HighlightTheme = 'github'): string {
  const highlightCss = HIGHLIGHT_THEMES[highlightTheme] || HIGHLIGHT_THEMES.github;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&family=Noto+Color+Emoji&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <style>
    /* PDF Styles - Always light theme for print */
    :root {
      --font-family: "Inter Tight", -apple-system, BlinkMacSystemFont, "Segoe UI", "Ubuntu", "Droid Sans", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
      --font-family-mono: Menlo, Monaco, Consolas, "Droid Sans Mono", "Courier New", monospace;
      --font-size-base: ${fontSize};
      --line-height-base: 1.6;
      --line-height-code: 1.357;
      --spacing-xs: 4px;
      --spacing-sm: 8px;
      --spacing-md: 16px;
      --spacing-lg: 24px;
      --spacing-xl: 32px;
      --color-text: #333333;
      --color-text-secondary: #6a737d;
      --color-heading: #1a1a1a;
      --color-link: #0366d6;
      --color-bg: #ffffff;
      --color-bg-secondary: #f6f8fa;
      --color-border: rgba(0, 0, 0, 0.12);
      --color-border-strong: rgba(0, 0, 0, 0.18);
      --color-code-bg: #f6f8fa;
      --color-code-text: #24292f;
      --color-code-inline-bg: rgba(175, 184, 193, 0.2);
      --color-code-inline-text: #c9501c;
      --color-blockquote-bg: rgba(127, 127, 127, 0.1);
      --color-blockquote-border: rgba(0, 122, 204, 0.5);
      --color-table-border: #d0d7de;
      --color-table-header-bg: #f6f8fa;
      --color-table-row-alt: #f6f8fa;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font-family);
      font-size: var(--font-size-base);
      line-height: var(--line-height-base);
      color: var(--color-text);
      background-color: var(--color-bg);
      padding: 24px;
    }

    .markdown-body h1, .markdown-body h2, .markdown-body h3,
    .markdown-body h4, .markdown-body h5, .markdown-body h6 {
      margin-top: var(--spacing-lg);
      margin-bottom: var(--spacing-md);
      font-weight: 600;
      line-height: 1.25;
      color: var(--color-heading);
    }

    .markdown-body h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid var(--color-border); }
    .markdown-body h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid var(--color-border); }
    .markdown-body h3 { font-size: 1.25em; }
    .markdown-body h4 { font-size: 1em; }
    .markdown-body h5 { font-size: 0.875em; }
    .markdown-body h6 { font-size: 0.85em; color: var(--color-text-secondary); }

    .markdown-body p { margin-top: 0; margin-bottom: var(--spacing-md); }
    .markdown-body strong { font-weight: 600; }
    .markdown-body em { font-style: italic; }

    .markdown-body a { color: var(--color-link); text-decoration: none; }
    .markdown-body a:hover { text-decoration: underline; }

    .markdown-body ul, .markdown-body ol {
      margin-top: 0;
      margin-bottom: var(--spacing-md);
      padding-left: 2em;
    }

    .markdown-body li { margin-top: var(--spacing-xs); }
    .markdown-body li + li { margin-top: var(--spacing-xs); }

    .markdown-body ul:has(input[type="checkbox"]) { list-style: none; padding-left: 1.5em; }
    .markdown-body li:has(> input[type="checkbox"]) { list-style: none; }
    .markdown-body li > input[type="checkbox"] { margin-right: 0.4em; }

    .markdown-body code {
      font-family: var(--font-family-mono);
      font-size: 0.9em;
      padding: 0.2em 0.4em;
      margin: 0;
      background-color: var(--color-code-inline-bg);
      color: var(--color-code-inline-text);
      border-radius: 6px;
    }

    .markdown-body pre {
      margin-top: 0;
      margin-bottom: var(--spacing-md);
      padding: var(--spacing-md);
      overflow: auto;
      font-size: 0.95em;
      line-height: var(--line-height-code);
      background-color: var(--color-code-bg);
      border-radius: 6px;
      border: 1px solid var(--color-border);
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .markdown-body pre code {
      display: block;
      padding: 0;
      margin: 0;
      overflow: visible;
      line-height: 1.5;
      background-color: transparent;
      color: var(--color-code-text);
      border: 0;
      font-size: inherit;
    }

    .markdown-body blockquote {
      margin: 0 0 var(--spacing-md);
      padding: 0 var(--spacing-md) 0 10px;
      color: var(--color-text-secondary);
      border-left: 5px solid var(--color-blockquote-border);
      background-color: var(--color-blockquote-bg);
    }

    .markdown-body blockquote > :first-child { margin-top: var(--spacing-sm); }
    .markdown-body blockquote > :last-child { margin-bottom: var(--spacing-sm); }

    .markdown-body table {
      border-collapse: collapse;
      border-spacing: 0;
      width: 100%;
      margin-bottom: var(--spacing-md);
    }

    .markdown-body table th, .markdown-body table td {
      padding: 6px 13px;
      border: 1px solid var(--color-table-border);
    }

    .markdown-body table th {
      font-weight: 600;
      background-color: var(--color-table-header-bg);
    }

    .markdown-body table tr:nth-child(2n) { background-color: var(--color-table-row-alt); }

    .markdown-body hr {
      height: 0.25em;
      padding: 0;
      margin: var(--spacing-lg) 0;
      background-color: var(--color-border-strong);
      border: 0;
    }

    .markdown-body img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: var(--spacing-md) 0;
      border-radius: 4px;
    }

    .markdown-body .katex-block {
      display: block;
      margin: var(--spacing-sm) 0;
      text-align: center;
      overflow-x: auto;
      padding: var(--spacing-xs) 0;
    }

    .markdown-body .katex { font-size: 1.1em; }
    .markdown-body .katex-block .katex { font-size: 1.6em; }

    .markdown-body .math-error {
      color: #d32f2f;
      background-color: rgba(211, 47, 47, 0.1);
      padding: var(--spacing-xs) var(--spacing-sm);
      border-radius: 4px;
      font-family: var(--font-family-mono);
      font-size: 85%;
    }

    .markdown-body .mermaid {
      margin: var(--spacing-md) 0;
      text-align: center;
      background-color: var(--color-bg);
      padding: var(--spacing-md);
      border-radius: 6px;
    }

    /* Syntax highlighting */
    ${highlightCss}

    @media print {
      body { padding: 0; }
      .markdown-body pre, .markdown-body code { white-space: pre-wrap; word-wrap: break-word; }
      .markdown-body img { max-width: 100% !important; page-break-inside: avoid; }

      /* Headings: prevent orphaning at page bottom */
      .markdown-body h1, .markdown-body h2, .markdown-body h3,
      .markdown-body h4, .markdown-body h5, .markdown-body h6 {
        page-break-after: avoid;
        break-after: avoid;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      /* Keep first element after heading together with heading */
      .markdown-body h1 + *, .markdown-body h2 + *, .markdown-body h3 + *,
      .markdown-body h4 + *, .markdown-body h5 + *, .markdown-body h6 + * {
        page-break-before: avoid;
        break-before: avoid;
      }

      /* Paragraph orphan/widow control - min 3 lines at page break */
      .markdown-body p {
        orphans: 3;
        widows: 3;
      }

      .markdown-body pre, .markdown-body blockquote, .markdown-body table { page-break-inside: avoid; }
      .markdown-body .katex-block, .markdown-body .mermaid { page-break-inside: avoid; }
      .page-break { page-break-after: always; }
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
</head>
<body>
  <div class="markdown-body">
    ${content}
  </div>
  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
  </script>
</body>
</html>`;
}

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      headless: true,
    });
  }
  return browserInstance;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: ExportRequest = await request.json();

    if (!body.markdown || typeof body.markdown !== 'string') {
      return NextResponse.json(
        { message: 'Markdown content is required' },
        { status: 400 }
      );
    }

    // Limit size to prevent abuse
    if (body.markdown.length > 500000) {
      return NextResponse.json(
        { message: 'Markdown content too large (max 500KB)' },
        { status: 400 }
      );
    }

    const options: ExportOptions = {
      pageSize: body.options?.pageSize || 'a4',
      margins: body.options?.margins || 'normal',
      theme: body.options?.theme || 'light',
      fontSize: body.options?.fontSize || '14px',
      highlightTheme: body.options?.highlightTheme || 'github',
      format: body.options?.format || 'pdf',
      markdownOptions: body.options?.markdownOptions || {},
    };

    // Render markdown to HTML
    const htmlContent = renderMarkdownSafe(body.markdown, {
      sanitize: true,
      markdownOptions: options.markdownOptions,
    });
    const fullHtml = generateHtml(htmlContent, options.fontSize, options.highlightTheme);

    // HTML export mode
    if (options.format === 'html') {
      return new NextResponse(fullHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': 'attachment; filename="document.html"',
        },
      });
    }

    // Generate PDF using Playwright
    const browser = await getBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set content with timeout
    await page.setContent(fullHtml, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for Mermaid diagrams to render
    await page.waitForTimeout(1000);

    // Emulate print media for correct styling
    await page.emulateMedia({ media: 'print' });

    // Generate PDF
    const pdf = await page.pdf({
      format: PAGE_FORMATS[options.pageSize],
      margin: MARGIN_CONFIGS[options.margins],
      printBackground: true,
      preferCSSPageSize: false,
    });

    await context.close();

    // Convert Buffer to Uint8Array for NextResponse compatibility
    const pdfUint8Array = new Uint8Array(pdf);

    return new NextResponse(pdfUint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="document.pdf"',
      },
    });
  } catch (error) {
    console.error('PDF export error:', error);
    const message = error instanceof Error ? error.message : 'PDF export failed';
    return NextResponse.json(
      { message },
      { status: 500 }
    );
  }
}

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    if (browserInstance) {
      await browserInstance.close();
    }
  });
}
