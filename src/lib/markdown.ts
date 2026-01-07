import MarkdownIt from 'markdown-it';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import hljs from 'highlight.js';
import katex from 'katex';

// Options interface for markdown-it
export interface MarkdownItOptions {
  html?: boolean;
  linkify?: boolean;
  typographer?: boolean;
  breaks?: boolean;
}

// Create the markdown-it instance with plugins
function createMarkdownRenderer(options: MarkdownItOptions = {}): MarkdownIt {
  const md = new MarkdownIt({
    html: options.html ?? true,
    linkify: options.linkify ?? true,
    typographer: options.typographer ?? true,
    breaks: options.breaks ?? false,
    highlight: (str: string, lang: string): string => {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
        } catch {
          // Fall through to default
        }
      }
      return escapeHtml(str);
    },
  });

  // Override fence renderer to handle mermaid specially
  md.renderer.rules.fence = (tokens, idx, options) => {
    const token = tokens[idx];
    const lang = token.info.trim();

    // Mermaid blocks should not be wrapped in pre/code
    if (lang === 'mermaid') {
      return `<div class="mermaid">${escapeHtml(token.content)}</div>`;
    }

    // For other languages, use default fence with hljs wrapper
    const code = options.highlight?.(token.content, lang, '') || escapeHtml(token.content);
    const langClass = lang ? ` class="language-${lang}"` : '';
    return `<pre class="hljs"><code${langClass}>${code}</code></pre>`;
  };

  // Add checkbox support for task lists
  md.use(require('markdown-it-checkbox'));

  // Add LaTeX support with custom rules
  addLatexSupport(md);

  return md;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function addLatexSupport(md: MarkdownIt): void {
  // Block math: $$...$$
  const blockMathRule = (state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean => {
    const startPos = state.bMarks[startLine] + state.tShift[startLine];
    const maxPos = state.eMarks[startLine];

    // Check for opening $$
    if (startPos + 2 > maxPos) return false;
    if (state.src.slice(startPos, startPos + 2) !== '$$') return false;

    // Find closing $$
    let nextLine = startLine;
    let found = false;

    // Check if it's on the same line
    const sameLineEnd = state.src.indexOf('$$', startPos + 2);
    if (sameLineEnd !== -1 && sameLineEnd < maxPos) {
      // Single line block math
      if (silent) return true;

      const content = state.src.slice(startPos + 2, sameLineEnd).trim();
      const token = state.push('math_block', 'div', 0);
      token.content = content;
      token.map = [startLine, startLine + 1];
      state.line = startLine + 1;
      return true;
    }

    // Multi-line block math
    for (nextLine = startLine + 1; nextLine < endLine; nextLine++) {
      const pos = state.bMarks[nextLine] + state.tShift[nextLine];
      const max = state.eMarks[nextLine];

      if (state.src.slice(pos, max).trim() === '$$') {
        found = true;
        break;
      }
    }

    if (!found) return false;
    if (silent) return true;

    const content = state.getLines(startLine + 1, nextLine, state.tShift[startLine], false).trim();
    const token = state.push('math_block', 'div', 0);
    token.content = content;
    token.map = [startLine, nextLine + 1];
    state.line = nextLine + 1;
    return true;
  };

  // Inline math: $...$
  const inlineMathRule = (state: StateInline, silent: boolean): boolean => {
    const start = state.pos;
    const max = state.posMax;

    // Check for opening $
    if (state.src.charCodeAt(start) !== 0x24 /* $ */) return false;

    // Don't match $$ (that's block math)
    if (start + 1 < max && state.src.charCodeAt(start + 1) === 0x24) return false;

    // Don't match escaped \$
    if (start > 0 && state.src.charCodeAt(start - 1) === 0x5c /* \ */) return false;

    // Find closing $
    let end = start + 1;
    while (end < max) {
      const char = state.src.charCodeAt(end);
      if (char === 0x24 /* $ */ && state.src.charCodeAt(end - 1) !== 0x5c /* \ */) {
        break;
      }
      end++;
    }

    if (end >= max) return false;

    const content = state.src.slice(start + 1, end);

    // Avoid empty content or content with only spaces
    if (!content.trim()) return false;

    if (!silent) {
      const token = state.push('math_inline', 'span', 0);
      token.content = content;
    }

    state.pos = end + 1;
    return true;
  };

  // Register rules
  md.block.ruler.before('fence', 'math_block', blockMathRule);
  md.inline.ruler.before('escape', 'math_inline', inlineMathRule);

  // Render rules
  md.renderer.rules.math_block = (tokens, idx): string => {
    const content = tokens[idx].content;
    try {
      const rendered = katex.renderToString(content, {
        displayMode: true,
        throwOnError: false,
        trust: true,
        strict: false,
      });
      return `<div class="katex-block">${rendered}</div>`;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      return `<div class="math-error">Math error: ${escapeHtml(errorMessage)}</div>`;
    }
  };

  md.renderer.rules.math_inline = (tokens, idx): string => {
    const content = tokens[idx].content;
    try {
      const rendered = katex.renderToString(content, {
        displayMode: false,
        throwOnError: false,
        trust: true,
        strict: false,
      });
      return rendered;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      return `<span class="math-error">Math error: ${escapeHtml(errorMessage)}</span>`;
    }
  };
}

// Singleton instance
let mdInstance: MarkdownIt | null = null;

export function getMarkdownRenderer(): MarkdownIt {
  if (!mdInstance) {
    mdInstance = createMarkdownRenderer();
  }
  return mdInstance;
}

export function renderMarkdown(content: string): string {
  const md = getMarkdownRenderer();
  return md.render(content);
}

export interface MarkdownOptions {
  /** Enable HTML tags in source */
  html?: boolean;
  /** Autoconvert URL-like text to links */
  linkify?: boolean;
  /** Enable some language-neutral replacement + quotes beautification */
  typographer?: boolean;
  /** Convert \n in paragraphs into <br> */
  breaks?: boolean;
  /** Enable GitHub Flavored Markdown features (tables, strikethrough) */
  gfm?: boolean;
}

export interface RenderOptions {
  sanitize?: boolean;
  /** Markdown-it parser options */
  markdownOptions?: MarkdownOptions;
}

/**
 * Render markdown with custom options.
 * Creates a new renderer if custom markdown options are provided.
 */
export function renderMarkdownWithOptions(content: string, markdownOptions?: MarkdownOptions): string {
  if (markdownOptions && Object.keys(markdownOptions).length > 0) {
    // Create a custom renderer with the provided options
    const customMd = createMarkdownRenderer({
      html: markdownOptions.html,
      linkify: markdownOptions.linkify,
      typographer: markdownOptions.typographer,
      breaks: markdownOptions.breaks,
    });
    return customMd.render(content);
  }
  // Use default singleton renderer
  return renderMarkdown(content);
}

export function renderMarkdownSafe(content: string, options: RenderOptions = {}): string {
  const html = renderMarkdownWithOptions(content, options.markdownOptions);

  if (options.sanitize !== false) {
    // Import DOMPurify dynamically for sanitization
    const DOMPurify = require('isomorphic-dompurify');
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ['math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'mroot', 'msqrt', 'mtext', 'mspace', 'mover', 'munder', 'mtable', 'mtr', 'mtd', 'annotation'],
      ADD_ATTR: ['class', 'style', 'aria-hidden', 'focusable', 'role', 'xmlns', 'encoding'],
      ALLOW_DATA_ATTR: true,
    });
  }

  return html;
}
