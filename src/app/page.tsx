'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { renderMarkdownSafe } from '@/lib/markdown';

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

interface ExportOptions {
  pageSize: PageSize;
  margins: MarginSize;
}

export default function Home() {
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [pageSize, setPageSize] = useState<PageSize>('a4');
  const [margins, setMargins] = useState<MarginSize>('normal');
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Initialize Mermaid
  useEffect(() => {
    const initMermaid = async () => {
      if (typeof window !== 'undefined') {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === 'dark' ? 'dark' : 'default',
          securityLevel: 'loose',
        });
        // Re-render mermaid diagrams
        if (previewRef.current) {
          const mermaidDivs = previewRef.current.querySelectorAll('.mermaid');
          mermaidDivs.forEach((div, index) => {
            const content = div.textContent || '';
            div.id = `mermaid-${index}`;
            mermaid.render(`mermaid-svg-${index}`, content).then(({ svg }) => {
              div.innerHTML = svg;
            }).catch(() => {
              // Mermaid rendering failed, keep original content
            });
          });
        }
      }
    };
    initMermaid();
  }, [markdown, theme]);

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
      if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown')) {
        showToast('Please upload a .md or .markdown file', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setMarkdown(content);
        showToast('File loaded successfully', 'success');
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

  const handleExportPDF = useCallback(async () => {
    setIsExporting(true);
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
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('PDF exported successfully', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      showToast(message, 'error');
    } finally {
      setIsExporting(false);
    }
  }, [markdown, pageSize, margins, theme, showToast]);

  const renderedHtml = renderMarkdownSafe(markdown);

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
            className="btn btn--primary"
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            {isExporting ? (
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
                Export PDF
              </>
            )}
          </button>
        </div>
      </header>

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
            <div
              ref={previewRef}
              className="markdown-body"
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
