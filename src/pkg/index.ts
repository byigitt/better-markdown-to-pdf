import { chromium, Browser } from 'playwright';
import { renderMarkdownSafe, MarkdownOptions } from '../lib/markdown';
import * as fs from 'fs/promises';
import * as path from 'path';

// Re-export MarkdownOptions for external use
export type { MarkdownOptions };

// ============================================================================
// Types
// ============================================================================

export interface PdfOptions {
  /** Page format: 'A4', 'Letter', 'A3', 'A5', 'Legal', 'Tabloid' */
  format?: 'A4' | 'Letter' | 'A3' | 'A5' | 'Legal' | 'Tabloid';
  /** Page width (overrides format) */
  width?: string | number;
  /** Page height (overrides format) */
  height?: string | number;
  /** Page margins */
  margin?: {
    top?: string | number;
    bottom?: string | number;
    left?: string | number;
    right?: string | number;
  };
  /** Print background graphics */
  printBackground?: boolean;
  /** Landscape orientation */
  landscape?: boolean;
  /** Scale of the webpage rendering (0.1 - 2) */
  scale?: number;
  /** Header template HTML */
  headerTemplate?: string;
  /** Footer template HTML */
  footerTemplate?: string;
  /** Display header and footer */
  displayHeaderFooter?: boolean;
  /** Page ranges to print, e.g. '1-5, 8, 11-13' */
  pageRanges?: string;
  /** Prefer CSS page size */
  preferCSSPageSize?: boolean;
}

/** Script injection configuration */
export interface ScriptConfig {
  /** Path to local JavaScript file */
  path?: string;
  /** URL to remote JavaScript file */
  url?: string;
  /** Inline JavaScript code */
  content?: string;
}

export interface Config {
  /** Base directory for resolving relative paths */
  basedir?: string;
  /** Paths to CSS stylesheets to include */
  stylesheet?: string | string[];
  /** Inline CSS string */
  css?: string;
  /** Body class(es) to apply */
  body_class?: string | string[];
  /** Puppeteer/Playwright PDF options */
  pdf_options?: PdfOptions;
  /** Destination path for the PDF/HTML file */
  dest?: string;
  /** Document title */
  document_title?: string;
  /** Timeout in ms for page operations */
  timeout?: number;
  /** Output HTML instead of PDF */
  as_html?: boolean;
  /** Syntax highlighting theme (github, monokai, dracula, vs2015, atom-one-dark, etc.) */
  highlight_style?: string;
  /** CSS media type: 'screen' or 'print' */
  page_media_type?: 'screen' | 'print';
  /** Open browser with DevTools for debugging (no output generated) */
  devtools?: boolean;
  /** Playwright browser launch options */
  launch_options?: {
    headless?: boolean;
    executablePath?: string;
    args?: string[];
    proxy?: {
      server: string;
      bypass?: string;
      username?: string;
      password?: string;
    };
  };
  /** Markdown-it parser options */
  markdown_options?: MarkdownOptions;
  /** Custom JavaScript scripts to inject */
  script?: ScriptConfig | ScriptConfig[];
  /** File encoding for markdown files (default: utf-8) */
  md_file_encoding?: BufferEncoding;
  /** File encoding for stylesheet files (default: utf-8) */
  stylesheet_encoding?: BufferEncoding;
}

export interface MdToPdfInput {
  /** Path to the markdown file */
  path?: string;
  /** Markdown content string */
  content?: string;
}

export interface MdToPdfOutput {
  /** PDF/HTML content as Buffer (PDF) or string (HTML) */
  content: Buffer;
  /** Path where output was saved (if dest was specified) */
  filename?: string;
}

interface FrontmatterResult {
  content: string;
  config: Partial<Config>;
}

// ============================================================================
// Highlight.js Themes
// ============================================================================

const HIGHLIGHT_THEMES: Record<string, string> = {
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
    .hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-doctag,.hljs-title,.hljs-section,.hljs-type,.hljs-selector-id{font-weight:700}
  `,
  dracula: `
    .hljs{background:#282a36;color:#f8f8f2}
    .hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-section,.hljs-link{color:#ff79c6}
    .hljs-function .hljs-keyword{color:#ff79c6}
    .hljs-subst{color:#f8f8f2}
    .hljs-string,.hljs-title,.hljs-name,.hljs-type,.hljs-attribute,.hljs-symbol,.hljs-bullet,.hljs-addition,.hljs-variable,.hljs-template-tag,.hljs-template-variable{color:#f1fa8c}
    .hljs-comment,.hljs-quote,.hljs-deletion,.hljs-meta{color:#6272a4}
    .hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-title,.hljs-section,.hljs-doctag,.hljs-type,.hljs-name,.hljs-strong{font-weight:700}
    .hljs-number{color:#bd93f9}
    .hljs-built_in,.hljs-class .hljs-title,.hljs-title.class_{color:#50fa7b}
  `,
  'vs2015': `
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
    .hljs-emphasis{font-style:italic}
    .hljs-strong{font-weight:700}
    .hljs-bullet,.hljs-selector-tag,.hljs-selector-id,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo{color:#D7BA7D}
    .hljs-addition{background-color:#144212;display:inline-block;width:100%}
    .hljs-deletion{background-color:#600;display:inline-block;width:100%}
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
    .hljs-emphasis{font-style:italic}
    .hljs-strong{font-weight:700}
    .hljs-link{text-decoration:underline}
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
    .hljs-emphasis{font-style:italic}
    .hljs-strong{font-weight:700}
    .hljs-link{text-decoration:underline}
  `,
};

function getHighlightThemeCss(theme: string): string {
  return HIGHLIGHT_THEMES[theme.toLowerCase()] || HIGHLIGHT_THEMES.github;
}

// ============================================================================
// Frontmatter Parser
// ============================================================================

function parseFrontmatter(markdown: string): FrontmatterResult {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
  const match = markdown.match(frontmatterRegex);

  if (!match) {
    return { content: markdown, config: {} };
  }

  const yamlContent = match[1];
  const content = markdown.slice(match[0].length);
  const config: Partial<Config> = {};

  // Simple YAML parser for our supported options
  const lines = yamlContent.split('\n');
  let currentKey = '';
  let isArray = false;
  let inPdfOptions = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check for array item
    if (trimmed.startsWith('- ')) {
      if (currentKey && isArray) {
        const value = trimmed.slice(2).trim();
        if (!Array.isArray(config[currentKey as keyof Config])) {
          (config as Record<string, unknown>)[currentKey] = [];
        }
        ((config as Record<string, unknown>)[currentKey] as string[]).push(value);
      }
      continue;
    }

    // Key-value pair
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex).trim();
      let value = trimmed.slice(colonIndex + 1).trim();
      isArray = false;

      // Handle top-level pdf_options
      if (key === 'pdf_options') {
        config.pdf_options = config.pdf_options || {};
        inPdfOptions = true;
        currentKey = key;
        continue;
      }

      // Handle pdf_options sub-keys (indented lines)
      if (line.startsWith('  ') && inPdfOptions) {
        const subKey = key as keyof PdfOptions;
        if (value === '') {
          // Nested object like margin
          continue;
        }
        if (value.startsWith('{') || value.startsWith('[')) {
          try {
            (config.pdf_options as Record<string, unknown>)[subKey] = JSON.parse(value);
          } catch {
            (config.pdf_options as Record<string, unknown>)[subKey] = value;
          }
        } else if (value === 'true') {
          (config.pdf_options as Record<string, unknown>)[subKey] = true;
        } else if (value === 'false') {
          (config.pdf_options as Record<string, unknown>)[subKey] = false;
        } else if (!isNaN(Number(value)) && value !== '') {
          (config.pdf_options as Record<string, unknown>)[subKey] = Number(value);
        } else {
          (config.pdf_options as Record<string, unknown>)[subKey] = value;
        }
        continue;
      }

      // Handle margin sub-keys (more deeply indented)
      if (line.startsWith('    ') && inPdfOptions) {
        if (!config.pdf_options!.margin) {
          config.pdf_options!.margin = {};
        }
        (config.pdf_options!.margin as Record<string, string>)[key] = value;
        continue;
      }

      // Not in pdf_options anymore
      inPdfOptions = false;
      currentKey = key;

      // Check if next line starts an array
      if (value === '') {
        isArray = true;
        continue;
      }

      // Parse value
      if (value === 'true') {
        (config as Record<string, unknown>)[currentKey] = true;
      } else if (value === 'false') {
        (config as Record<string, unknown>)[currentKey] = false;
      } else if (!isNaN(Number(value)) && value !== '') {
        (config as Record<string, unknown>)[currentKey] = Number(value);
      } else {
        (config as Record<string, unknown>)[currentKey] = value;
      }
    }
  }

  return { content, config };
}

// ============================================================================
// HTML Generator
// ============================================================================

async function loadStylesheet(
  stylesheetPath: string,
  basedir: string,
  encoding: BufferEncoding = 'utf-8'
): Promise<string> {
  // Remote stylesheet
  if (stylesheetPath.startsWith('http://') || stylesheetPath.startsWith('https://')) {
    try {
      const response = await fetch(stylesheetPath);
      return await response.text();
    } catch {
      console.warn(`Failed to load remote stylesheet: ${stylesheetPath}`);
      return '';
    }
  }

  // Local stylesheet
  const fullPath = path.isAbsolute(stylesheetPath)
    ? stylesheetPath
    : path.resolve(basedir, stylesheetPath);

  try {
    return await fs.readFile(fullPath, encoding);
  } catch {
    console.warn(`Failed to load stylesheet: ${fullPath}`);
    return '';
  }
}

async function loadScript(
  scriptConfig: ScriptConfig,
  basedir: string
): Promise<string> {
  // Inline content
  if (scriptConfig.content) {
    return `<script>${scriptConfig.content}</script>`;
  }

  // Remote URL
  if (scriptConfig.url) {
    return `<script src="${scriptConfig.url}"></script>`;
  }

  // Local file
  if (scriptConfig.path) {
    const fullPath = path.isAbsolute(scriptConfig.path)
      ? scriptConfig.path
      : path.resolve(basedir, scriptConfig.path);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      return `<script>${content}</script>`;
    } catch {
      console.warn(`Failed to load script: ${fullPath}`);
      return '';
    }
  }

  return '';
}

function generateHtml(
  content: string,
  config: Config,
  customStyles: string,
  customScripts: string = ''
): string {
  const bodyClasses = Array.isArray(config.body_class)
    ? config.body_class.join(' ')
    : config.body_class || 'markdown-body';

  const title = config.document_title || 'Document';
  const highlightTheme = getHighlightThemeCss(config.highlight_style || 'github');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&family=Noto+Color+Emoji&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <style>
    :root {
      --font-family: "Inter Tight", -apple-system, BlinkMacSystemFont, "Segoe UI", "Ubuntu", "Droid Sans", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
      --font-family-mono: Menlo, Monaco, Consolas, "Courier New", monospace;
      --color-text: #333333;
      --color-text-secondary: #6a737d;
      --color-heading: #1a1a1a;
      --color-link: #0366d6;
      --color-bg: #ffffff;
      --color-border: rgba(0, 0, 0, 0.12);
      --color-code-bg: #f6f8fa;
      --color-code-text: #24292f;
      --color-code-inline-bg: rgba(175, 184, 193, 0.2);
      --color-code-inline-text: #c9501c;
      --color-blockquote-bg: rgba(127, 127, 127, 0.1);
      --color-blockquote-border: rgba(0, 122, 204, 0.5);
      --color-table-border: #d0d7de;
      --color-table-header-bg: #f6f8fa;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-family);
      font-size: 14px;
      line-height: 1.6;
      color: var(--color-text);
      background-color: var(--color-bg);
      padding: 24px;
    }
    .markdown-body h1, .markdown-body h2, .markdown-body h3,
    .markdown-body h4, .markdown-body h5, .markdown-body h6 {
      margin-top: 24px;
      margin-bottom: 16px;
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
    .markdown-body p { margin-top: 0; margin-bottom: 16px; }
    .markdown-body strong { font-weight: 600; }
    .markdown-body em { font-style: italic; }
    .markdown-body a { color: var(--color-link); text-decoration: none; }
    .markdown-body ul, .markdown-body ol { margin-bottom: 16px; padding-left: 2em; }
    .markdown-body li { margin-top: 4px; }
    .markdown-body ul:has(input[type="checkbox"]) { list-style: none; padding-left: 1.5em; }
    .markdown-body li:has(> input[type="checkbox"]) { list-style: none; }
    .markdown-body li > input[type="checkbox"] { margin-right: 0.4em; }
    .markdown-body code {
      font-family: var(--font-family-mono);
      font-size: 0.9em;
      padding: 0.2em 0.4em;
      background-color: var(--color-code-inline-bg);
      color: var(--color-code-inline-text);
      border-radius: 6px;
    }
    .markdown-body pre {
      margin-bottom: 16px;
      padding: 16px;
      overflow: auto;
      font-size: 0.95em;
      line-height: 1.45;
      background-color: var(--color-code-bg);
      border-radius: 6px;
      border: 1px solid var(--color-border);
    }
    .markdown-body pre code {
      display: block;
      padding: 0;
      background-color: transparent;
      color: var(--color-code-text);
      border: 0;
      font-size: inherit;
    }
    .markdown-body blockquote {
      margin: 0 0 16px;
      padding: 0 16px 0 10px;
      color: var(--color-text-secondary);
      border-left: 5px solid var(--color-blockquote-border);
      background-color: var(--color-blockquote-bg);
    }
    .markdown-body blockquote > :first-child { margin-top: 8px; }
    .markdown-body blockquote > :last-child { margin-bottom: 8px; }
    .markdown-body table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 16px;
    }
    .markdown-body table th, .markdown-body table td {
      padding: 6px 13px;
      border: 1px solid var(--color-table-border);
    }
    .markdown-body table th {
      font-weight: 600;
      background-color: var(--color-table-header-bg);
    }
    .markdown-body table tr:nth-child(2n) { background-color: #f6f8fa; }
    .markdown-body hr {
      height: 0.25em;
      margin: 24px 0;
      background-color: rgba(0,0,0,0.18);
      border: 0;
    }
    .markdown-body img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 16px 0;
      border-radius: 4px;
    }
    .markdown-body .katex-block {
      display: block;
      margin: 8px 0;
      text-align: center;
      overflow-x: auto;
    }
    .markdown-body .katex { font-size: 1.1em; }
    .markdown-body .katex-block .katex { font-size: 1.6em; }
    .markdown-body .math-error {
      color: #d32f2f;
      background-color: rgba(211, 47, 47, 0.1);
      padding: 4px 8px;
      border-radius: 4px;
      font-family: var(--font-family-mono);
      font-size: 85%;
    }
    .markdown-body .mermaid {
      margin: 16px 0;
      text-align: center;
      background-color: var(--color-bg);
      padding: 16px;
      border-radius: 6px;
    }
    /* Syntax Highlighting Theme */
    ${highlightTheme}
    @media print {
      body { padding: 0; }
      .markdown-body pre, .markdown-body code { white-space: pre-wrap; word-wrap: break-word; }
      .markdown-body img { max-width: 100% !important; page-break-inside: avoid; }
      .markdown-body h1, .markdown-body h2, .markdown-body h3 { page-break-after: avoid; }
      .markdown-body pre, .markdown-body blockquote, .markdown-body table { page-break-inside: avoid; }
    }
    ${customStyles}
  </style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
</head>
<body>
  <div class="${bodyClasses}">${content}</div>
  <script>mermaid.initialize({ startOnLoad: true, theme: 'default' });</script>
  ${customScripts}
</body>
</html>`;
}

// ============================================================================
// Browser Management
// ============================================================================

let browserInstance: Browser | null = null;
let currentLaunchOptions: string | null = null;

async function getBrowser(launchOptions?: Config['launch_options']): Promise<Browser> {
  const optionsKey = launchOptions ? JSON.stringify(launchOptions) : 'default';

  // Close existing browser if launch options changed
  if (browserInstance && currentLaunchOptions !== optionsKey) {
    await browserInstance.close();
    browserInstance = null;
  }

  if (!browserInstance) {
    browserInstance = await chromium.launch({
      headless: launchOptions?.headless ?? true,
      executablePath: launchOptions?.executablePath,
      args: launchOptions?.args,
      proxy: launchOptions?.proxy,
    });
    currentLaunchOptions = optionsKey;
  }
  return browserInstance;
}

/**
 * Close browser instance and cleanup resources.
 * Call this when done with PDF generation.
 */
export async function cleanup(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Convert markdown to PDF or HTML.
 *
 * @example
 * // From file
 * const { content } = await mdToPdf({ path: './readme.md' });
 *
 * @example
 * // From content
 * const { content } = await mdToPdf({ content: '# Hello World' });
 *
 * @example
 * // With options
 * const { content } = await mdToPdf({ path: './readme.md' }, {
 *   dest: './output.pdf',
 *   stylesheet: './custom.css',
 *   pdf_options: { format: 'A4', margin: { top: '2cm', bottom: '2cm' } }
 * });
 *
 * @example
 * // HTML output
 * const { content } = await mdToPdf({ path: './readme.md' }, { as_html: true });
 *
 * @example
 * // With syntax highlighting theme
 * const { content } = await mdToPdf({ path: './readme.md' }, { highlight_style: 'dracula' });
 */
export async function mdToPdf(
  input: MdToPdfInput,
  config: Config = {}
): Promise<MdToPdfOutput> {
  // Validate input
  if (!input.path && !input.content) {
    throw new Error('Either path or content must be provided');
  }

  // Read file if path provided
  let markdown: string;
  let basedir = config.basedir || process.cwd();
  const mdEncoding = config.md_file_encoding || 'utf-8';

  if (input.path) {
    const absolutePath = path.isAbsolute(input.path)
      ? input.path
      : path.resolve(process.cwd(), input.path);
    markdown = await fs.readFile(absolutePath, mdEncoding);
    basedir = config.basedir || path.dirname(absolutePath);
  } else {
    markdown = input.content!;
  }

  // Parse frontmatter
  const { content: markdownContent, config: frontmatterConfig } = parseFrontmatter(markdown);

  // Merge configs (frontmatter takes precedence)
  const mergedConfig: Config = {
    ...config,
    ...frontmatterConfig,
    pdf_options: {
      ...config.pdf_options,
      ...frontmatterConfig.pdf_options,
    },
  };

  // Load custom stylesheets
  let customStyles = '';
  const stylesheetEncoding = mergedConfig.stylesheet_encoding || 'utf-8';

  if (mergedConfig.stylesheet) {
    const stylesheets = Array.isArray(mergedConfig.stylesheet)
      ? mergedConfig.stylesheet
      : [mergedConfig.stylesheet];

    const loadedStyles = await Promise.all(
      stylesheets.map((s) => loadStylesheet(s, basedir, stylesheetEncoding))
    );
    customStyles += loadedStyles.join('\n');
  }

  if (mergedConfig.css) {
    customStyles += '\n' + mergedConfig.css;
  }

  // Load custom scripts
  let customScripts = '';
  if (mergedConfig.script) {
    const scripts = Array.isArray(mergedConfig.script)
      ? mergedConfig.script
      : [mergedConfig.script];

    const loadedScripts = await Promise.all(
      scripts.map((s) => loadScript(s, basedir))
    );
    customScripts = loadedScripts.join('\n');
  }

  // Render markdown to HTML
  const htmlContent = renderMarkdownSafe(markdownContent, {
    sanitize: true,
    markdownOptions: mergedConfig.markdown_options,
  });
  const fullHtml = generateHtml(htmlContent, mergedConfig, customStyles, customScripts);

  // HTML output mode
  if (mergedConfig.as_html) {
    const htmlBuffer = Buffer.from(fullHtml, 'utf-8');
    const result: MdToPdfOutput = { content: htmlBuffer };

    const dest = mergedConfig.dest;
    if (dest && dest !== 'stdout') {
      const outputPath = path.isAbsolute(dest) ? dest : path.resolve(basedir, dest);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, fullHtml, 'utf-8');
      result.filename = outputPath;
    } else if (dest === 'stdout') {
      process.stdout.write(fullHtml);
      result.filename = 'stdout';
    }

    return result;
  }

  // PDF output mode
  const launchOpts = mergedConfig.devtools
    ? { ...mergedConfig.launch_options, headless: false }
    : mergedConfig.launch_options;

  const browser = await getBrowser(launchOpts);
  const context = await browser.newContext();
  const page = await context.newPage();

  const timeout = mergedConfig.timeout || 30000;

  // Set CSS media type (screen or print)
  if (mergedConfig.page_media_type) {
    await page.emulateMedia({ media: mergedConfig.page_media_type });
  }

  await page.setContent(fullHtml, {
    waitUntil: 'networkidle',
    timeout,
  });

  // Wait for Mermaid diagrams
  await page.waitForTimeout(1000);

  // DevTools mode: keep browser open for debugging
  if (mergedConfig.devtools) {
    console.log('DevTools mode enabled. Browser will stay open.');
    console.log('Press Ctrl+C to exit and close the browser.');

    // Wait indefinitely (user closes browser or presses Ctrl+C)
    await new Promise<void>((resolve) => {
      process.on('SIGINT', () => {
        resolve();
      });
      process.on('SIGTERM', () => {
        resolve();
      });
    });

    await context.close();
    throw new Error('DevTools mode: No output generated.');
  }

  // Build PDF options
  const pdfOptions = mergedConfig.pdf_options || {};
  const pdf = await page.pdf({
    format: pdfOptions.format || 'A4',
    width: pdfOptions.width,
    height: pdfOptions.height,
    margin: pdfOptions.margin || { top: '1.5cm', bottom: '1cm', left: '1cm', right: '1cm' },
    printBackground: pdfOptions.printBackground ?? true,
    landscape: pdfOptions.landscape ?? false,
    scale: pdfOptions.scale,
    headerTemplate: pdfOptions.headerTemplate,
    footerTemplate: pdfOptions.footerTemplate,
    displayHeaderFooter: pdfOptions.displayHeaderFooter,
    pageRanges: pdfOptions.pageRanges,
    preferCSSPageSize: pdfOptions.preferCSSPageSize,
  });

  await context.close();

  const buffer = Buffer.from(pdf);
  const result: MdToPdfOutput = { content: buffer };

  // Save to file if dest is specified
  const dest = mergedConfig.dest;
  if (dest && dest !== 'stdout') {
    const outputPath = path.isAbsolute(dest) ? dest : path.resolve(basedir, dest);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, buffer);
    result.filename = outputPath;
  } else if (dest === 'stdout') {
    process.stdout.write(buffer);
    result.filename = 'stdout';
  }

  return result;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Convert markdown file to PDF (convenience wrapper).
 */
export async function mdFileToPdf(
  filePath: string,
  config: Config = {}
): Promise<MdToPdfOutput> {
  return mdToPdf({ path: filePath }, config);
}

/**
 * Convert markdown string to PDF (convenience wrapper).
 */
export async function mdContentToPdf(
  content: string,
  config: Config = {}
): Promise<MdToPdfOutput> {
  return mdToPdf({ content }, config);
}
