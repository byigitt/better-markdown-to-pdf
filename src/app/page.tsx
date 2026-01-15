'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { renderMarkdownSafe, MarkdownOptions } from '@/lib/markdown';

const DEFAULT_MARKDOWN = `# Welcome to Better Markdown to PDF

This is a **markdown editor** with *LaTeX support* and high-quality PDF export.

## Features

- Live preview with syntax highlighting
- LaTeX math rendering (KaTeX)
- Dark/Light theme support
- PDF export with print-quality styling

## LaTeX Examples

Inline math: $E = mc^2$

Block math:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

The quadratic formula: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$

## Code Example

\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // 55
\`\`\`

## Table Example

| Feature | Status |
|---------|--------|
| Markdown | ✅ |
| LaTeX | ✅ |
| PDF Export | ✅ |
| Dark Mode | ✅ |

## Task List

- [x] Set up editor
- [x] Add LaTeX support
- [ ] Export to PDF
- [ ] Share document

> **Note:** This editor supports GFM (GitHub Flavored Markdown) including tables, task lists, and code blocks.

## Mermaid Diagram

\`\`\`mermaid
graph TD
    A[Markdown] --> B[HTML]
    B --> C[Preview]
    B --> D[PDF]
\`\`\`

---

*Happy writing!*
`;

type PageSize = 'a4' | 'letter';
type MarginSize = 'normal' | 'narrow' | 'wide';
type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
type HighlightTheme = 'github' | 'monokai' | 'dracula' | 'vs2015' | 'atom-one-dark' | 'atom-one-light';

const FONT_SIZE_VALUES: Record<FontSize, string> = {
  small: '12px',
  medium: '14px',
  large: '16px',
  xlarge: '18px',
};

const MARGIN_PREVIEW_VALUES: Record<MarginSize, string> = {
  normal: '24px',
  narrow: '8px',
  wide: '48px',
};

const HIGHLIGHT_THEME_LABELS: Record<HighlightTheme, string> = {
  github: 'GitHub',
  monokai: 'Monokai',
  dracula: 'Dracula',
  vs2015: 'VS 2015',
  'atom-one-dark': 'Atom One Dark',
  'atom-one-light': 'Atom One Light',
};

const HIGHLIGHT_THEMES_CSS: Record<HighlightTheme, string> = {
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

export default function Home() {
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
  const [renderedHtml, setRenderedHtml] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [pageSize, setPageSize] = useState<PageSize>('a4');
  const [margins, setMargins] = useState<MarginSize>('normal');
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [highlightTheme, setHighlightTheme] = useState<HighlightTheme>('github');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [markdownOptions, setMarkdownOptions] = useState<MarkdownOptions>({
    html: true,
    linkify: true,
    typographer: true,
    breaks: false,
  });
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'html' | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [batchFiles, setBatchFiles] = useState<{ name: string; content: string }[]>([]);
  const [batchExporting, setBatchExporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Render markdown client-side only to avoid SSR issues with highlight.js
  useEffect(() => {
    setRenderedHtml(renderMarkdownSafe(markdown, { markdownOptions }));
  }, [markdown, markdownOptions]);

  // Initialize and render Mermaid diagrams
  useEffect(() => {
    const renderMermaid = async () => {
      if (typeof window === 'undefined' || !previewRef.current) return;

      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: theme === 'dark' ? 'dark' : 'default',
        securityLevel: 'loose',
      });

      // Find all mermaid divs and check if they need rendering
      const mermaidDivs = previewRef.current.querySelectorAll('.mermaid');
      const renderTime = Date.now();

      for (let i = 0; i < mermaidDivs.length; i++) {
        const div = mermaidDivs[i] as HTMLElement;

        // Skip if already rendered (contains SVG)
        if (div.querySelector('svg')) continue;

        const content = div.textContent || '';
        if (!content.trim()) continue;

        try {
          const { svg } = await mermaid.render(`mermaid-${renderTime}-${i}`, content);
          div.innerHTML = svg;
        } catch (error) {
          // Show error message in the diagram area for user feedback
          const errorMsg = error instanceof Error ? error.message : 'Invalid Mermaid syntax';
          div.innerHTML = `<div class="mermaid-error" style="color: #d32f2f; background: rgba(211,47,47,0.1); padding: 12px; border-radius: 4px; font-family: monospace; font-size: 12px; white-space: pre-wrap;">Mermaid Error: ${errorMsg}</div>`;
        }
      }
    };

    // Small delay to ensure DOM is updated with new HTML
    const timeoutId = setTimeout(renderMermaid, 100);
    return () => clearTimeout(timeoutId);
  }, [renderedHtml, theme, highlightTheme]);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  }, [theme]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file extension
      if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown')) {
        showToast('Please upload a .md or .markdown file', 'error');
        return;
      }
      // Check MIME type if available (text/markdown or text/plain are valid)
      if (file.type && !file.type.startsWith('text/') && file.type !== 'application/octet-stream') {
        showToast('Invalid file type. Please upload a text-based markdown file', 'error');
        return;
      }
      // Check file size (limit to 10MB for safety)
      if (file.size > 10 * 1024 * 1024) {
        showToast('File too large. Maximum size is 10MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        // Basic validation that content is valid text
        if (content && typeof content === 'string') {
          setMarkdown(content);
          showToast('File loaded successfully', 'success');
        } else {
          showToast('Failed to parse file content', 'error');
        }
      };
      reader.onerror = () => {
        showToast('Failed to read file', 'error');
      };
      reader.readAsText(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [showToast]);

  const handleExport = useCallback(async (format: 'pdf' | 'html') => {
    setExportingFormat(format);
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          markdown,
          options: {
            pageSize,
            margins,
            theme,
            fontSize: FONT_SIZE_VALUES[fontSize],
            highlightTheme,
            format,
            markdownOptions,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = format === 'pdf' ? 'document.pdf' : 'document.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast(`${format.toUpperCase()} exported successfully`, 'success');
      } finally {
        // Always revoke URL to prevent memory leak, even if download fails
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      showToast(message, 'error');
    } finally {
      setExportingFormat(null);
    }
  }, [markdown, pageSize, margins, theme, fontSize, highlightTheme, markdownOptions, showToast]);

  const handleExportPDF = useCallback(() => handleExport('pdf'), [handleExport]);
  const handleExportHTML = useCallback(() => handleExport('html'), [handleExport]);

  const handleBatchFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      showToast('No valid .md or .markdown files found', 'error');
      return;
    }

    const readPromises = validFiles.map((file) => {
      return new Promise<{ name: string; content: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            name: file.name.replace(/\.(md|markdown)$/, ''),
            content: e.target?.result as string,
          });
        };
        reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
        reader.readAsText(file);
      });
    });

    Promise.all(readPromises)
      .then((results) => {
        setBatchFiles(results);
        showToast(`${results.length} file(s) loaded`, 'success');
      })
      .catch(() => {
        showToast('Failed to read some files', 'error');
      });

    if (batchFileInputRef.current) {
      batchFileInputRef.current.value = '';
    }
  }, [showToast]);

  const handleBatchExport = useCallback(async () => {
    if (batchFiles.length === 0) return;

    setBatchExporting(true);
    setBatchProgress({ current: 0, total: batchFiles.length });

    let successCount = 0;
    for (let i = 0; i < batchFiles.length; i++) {
      const file = batchFiles[i];
      // Show progress as "processing X of Y" (0-indexed current file)
      setBatchProgress({ current: i, total: batchFiles.length });

      try {
        const response = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            markdown: file.content,
            options: {
              pageSize,
              margins,
              theme,
              fontSize: FONT_SIZE_VALUES[fontSize],
              highlightTheme,
              format: 'pdf',
              markdownOptions,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to export ${file.name}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${file.name}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Small delay between downloads
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        showToast(`Failed to export ${file.name}`, 'error');
      }
    }

    setBatchExporting(false);
    setBatchProgress({ current: 0, total: 0 });
    showToast(`Exported ${batchFiles.length} PDF(s)`, 'success');
    setBatchFiles([]);
  }, [batchFiles, pageSize, margins, theme, fontSize, highlightTheme, markdownOptions, showToast]);

  const clearBatchFiles = useCallback(() => {
    setBatchFiles([]);
  }, []);

  const convertBlockToInlineMath = useCallback(() => {
    // Replace $$ ... $$ with $ ... $ (both single-line and multi-line)
    const converted = markdown.replace(/\$\$([\s\S]*?)\$\$/g, (_, content) => {
      // Trim whitespace and newlines, collapse to single line
      const trimmed = content.trim().replace(/\s+/g, ' ');
      return `$${trimmed}$`;
    });
    if (converted !== markdown) {
      setMarkdown(converted);
      showToast('Converted block math to inline', 'success');
    } else {
      showToast('No block math ($$) found', 'error');
    }
  }, [markdown, showToast]);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-header__title">Better Markdown to PDF</h1>
        <div className="app-header__actions">
          <div className="file-upload">
            <input
              ref={fileInputRef}
              type="file"
              id="file-upload"
              className="file-upload__input"
              accept=".md,.markdown"
              onChange={handleFileUpload}
            />
            <label htmlFor="file-upload" className="file-upload__label">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M7.5 1a.5.5 0 0 1 .5.5V7h5.5a.5.5 0 0 1 0 1H8v5.5a.5.5 0 0 1-1 0V8H1.5a.5.5 0 0 1 0-1H7V1.5a.5.5 0 0 1 .5-.5z"/>
              </svg>
              Upload .md
            </label>
          </div>

          <div className="file-upload">
            <input
              ref={batchFileInputRef}
              type="file"
              id="batch-file-upload"
              className="file-upload__input"
              accept=".md,.markdown"
              multiple
              onChange={handleBatchFileUpload}
            />
            <label htmlFor="batch-file-upload" className="file-upload__label file-upload__label--batch">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H4z"/>
                <path d="M9.5 3a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1 0-1H9V3.5a.5.5 0 0 1 .5-.5z"/>
                <path d="M6 7h4v1H6V7zm0 2h4v1H6V9zm0 2h4v1H6v-1z"/>
              </svg>
              Batch
            </label>
          </div>

          {batchFiles.length > 0 && (
            <div className="batch-info">
              <span className="batch-info__count">{batchFiles.length} file(s)</span>
              <button
                className="btn btn--primary btn--small"
                onClick={handleBatchExport}
                disabled={batchExporting}
              >
                {batchExporting ? (
                  <>
                    <span className="spinner" />
                    {batchProgress.current}/{batchProgress.total}
                  </>
                ) : (
                  'Export All'
                )}
              </button>
              <button
                className="btn btn--ghost btn--small"
                onClick={clearBatchFiles}
                disabled={batchExporting}
                title="Clear files"
              >
                ✕
              </button>
            </div>
          )}

          <button
            className="btn btn--secondary btn--small"
            onClick={convertBlockToInlineMath}
            title="Convert $$ to $ (block math to inline)"
          >
            $$ → $
          </button>

          <select
            className="select"
            value={pageSize}
            onChange={(e) => setPageSize(e.target.value as PageSize)}
            aria-label="Page size"
          >
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
          </select>

          <select
            className="select"
            value={margins}
            onChange={(e) => setMargins(e.target.value as MarginSize)}
            aria-label="Margins"
          >
            <option value="normal">Normal margins</option>
            <option value="narrow">Narrow margins</option>
            <option value="wide">Wide margins</option>
          </select>

          <select
            className="select"
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value as FontSize)}
            aria-label="Font size"
          >
            <option value="small">Small (12px)</option>
            <option value="medium">Medium (14px)</option>
            <option value="large">Large (16px)</option>
            <option value="xlarge">X-Large (18px)</option>
          </select>

          <select
            className="select"
            value={highlightTheme}
            onChange={(e) => setHighlightTheme(e.target.value as HighlightTheme)}
            aria-label="Code highlight theme"
          >
            {Object.entries(HIGHLIGHT_THEME_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <button
            className="btn btn--icon"
            onClick={() => setShowAdvanced(!showAdvanced)}
            aria-label="Toggle advanced options"
            title="Advanced options"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
            </svg>
          </button>

          <button
            className="btn btn--icon"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd"/>
              </svg>
            )}
          </button>

          <button
            className="btn btn--secondary"
            onClick={handleExportHTML}
            disabled={exportingFormat !== null}
          >
            {exportingFormat === 'html' ? (
              <>
                <span className="spinner" />
                Exporting...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5.854 4.854a.5.5 0 10-.708-.708l-3.5 3.5a.5.5 0 000 .708l3.5 3.5a.5.5 0 00.708-.708L2.707 8l3.147-3.146zm4.292 0a.5.5 0 01.708-.708l3.5 3.5a.5.5 0 010 .708l-3.5 3.5a.5.5 0 01-.708-.708L13.293 8l-3.147-3.146z"/>
                </svg>
                HTML
              </>
            )}
          </button>

          <button
            className="btn btn--primary"
            onClick={handleExportPDF}
            disabled={exportingFormat !== null}
          >
            {exportingFormat === 'pdf' ? (
              <>
                <span className="spinner" />
                Exporting...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                  <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                </svg>
                PDF
              </>
            )}
          </button>
        </div>
      </header>

      {showAdvanced && (
        <div className="advanced-options">
          <div className="advanced-options__title">Markdown Parser Options</div>
          <div className="advanced-options__grid">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={markdownOptions.html}
                onChange={(e) => setMarkdownOptions({ ...markdownOptions, html: e.target.checked })}
              />
              <span>Allow HTML tags</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={markdownOptions.linkify}
                onChange={(e) => setMarkdownOptions({ ...markdownOptions, linkify: e.target.checked })}
              />
              <span>Auto-link URLs</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={markdownOptions.typographer}
                onChange={(e) => setMarkdownOptions({ ...markdownOptions, typographer: e.target.checked })}
              />
              <span>Smart quotes & dashes</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={markdownOptions.breaks}
                onChange={(e) => setMarkdownOptions({ ...markdownOptions, breaks: e.target.checked })}
              />
              <span>Convert newlines to &lt;br&gt;</span>
            </label>
          </div>
        </div>
      )}

      <main className="app-main">
        <div className="panel editor-panel">
          <div className="panel__header">Editor</div>
          <div className="panel__content">
            <textarea
              className="editor"
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="Type your markdown here..."
              spellCheck={false}
            />
          </div>
        </div>

        <div className="panel preview-panel">
          <div className="panel__header">Preview</div>
          <div className="panel__content preview">
            <style dangerouslySetInnerHTML={{ __html: HIGHLIGHT_THEMES_CSS[highlightTheme] }} />
            <div
              ref={previewRef}
              className="markdown-body"
              style={{
                fontSize: FONT_SIZE_VALUES[fontSize],
                padding: MARGIN_PREVIEW_VALUES[margins],
              }}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        </div>
      </main>

      {toast && (
        <div className={`toast toast--${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
