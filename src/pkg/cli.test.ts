import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync, spawn } from 'child_process';

// Test utilities
const TEST_DIR = path.join(process.cwd(), 'test-output');
const CLI_PATH = path.join(process.cwd(), 'dist', 'cli.js');

async function ensureTestDir() {
  await fs.mkdir(TEST_DIR, { recursive: true });
}

async function cleanupTestDir() {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch {
    // Ignore errors
  }
}

async function writeTestFile(filename: string, content: string) {
  const filepath = path.join(TEST_DIR, filename);
  await fs.writeFile(filepath, content, 'utf-8');
  return filepath;
}

function runCli(args: string[], options?: { timeout?: number; input?: string }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('node', [CLI_PATH, ...args], {
      cwd: TEST_DIR,
      timeout: options?.timeout || 30000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    if (options?.input) {
      proc.stdin.write(options.input);
      proc.stdin.end();
    }

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code || 0 });
    });

    proc.on('error', () => {
      resolve({ stdout, stderr, exitCode: 1 });
    });
  });
}

describe('CLI', () => {
  beforeEach(async () => {
    await ensureTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir();
  });

  describe('Help and Version', () => {
    it('shows help with --help flag', async () => {
      const { stdout, exitCode } = await runCli(['--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('better-markdown-to-pdf');
      expect(stdout).toContain('Usage:');
      expect(stdout).toContain('Options:');
      expect(stdout).toContain('--watch');
      expect(stdout).toContain('--as-html');
      expect(stdout).toContain('--highlight-style');
      expect(stdout).toContain('--config-file');
      expect(stdout).toContain('--page-media-type');
      expect(stdout).toContain('--devtools');
      expect(stdout).toContain('--launch-options');
    });

    it('shows help with -h flag', async () => {
      const { stdout, exitCode } = await runCli(['-h']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('better-markdown-to-pdf');
    });

    it('shows version with --version flag', async () => {
      const { stdout, exitCode } = await runCli(['--version']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('better-markdown-to-pdf v');
    });

    it('shows version with -v flag', async () => {
      const { stdout, exitCode } = await runCli(['-v']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('better-markdown-to-pdf v');
    });
  });

  describe('Error Handling', () => {
    it('shows error when no input file specified', async () => {
      const { stderr, exitCode } = await runCli([]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain('No input file specified');
    });

    it('shows error when file not found', async () => {
      const { stderr, exitCode } = await runCli(['nonexistent.md']);
      expect(exitCode).toBe(1);
      expect(stderr).toContain('File not found');
    });

    it('shows error for invalid JSON in --launch-options', async () => {
      await writeTestFile('test.md', '# Test');
      const { stderr, exitCode } = await runCli(['test.md', '--launch-options', 'invalid-json']);
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid JSON');
    });
  });

  describe('Basic Conversion', () => {
    it('converts markdown file to PDF', async () => {
      const mdPath = await writeTestFile('test.md', '# Hello World\n\nThis is a test.');
      const pdfPath = path.join(TEST_DIR, 'test.pdf');

      const { stdout, exitCode } = await runCli(['test.md'], { timeout: 60000 });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Converting');
      expect(stdout).toContain('PDF');

      const exists = await fs.access(pdfPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }, 60000);

    it('converts markdown to custom output path', async () => {
      await writeTestFile('input.md', '# Custom Output');
      const outputPath = path.join(TEST_DIR, 'custom-output.pdf');

      const { exitCode } = await runCli(['input.md', 'custom-output.pdf'], { timeout: 60000 });

      expect(exitCode).toBe(0);
      const exists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }, 60000);
  });

  describe('HTML Output (--as-html)', () => {
    it('converts markdown to HTML with --as-html flag', async () => {
      await writeTestFile('test.md', '# HTML Test\n\nThis is HTML output.');
      const htmlPath = path.join(TEST_DIR, 'test.html');

      const { stdout, exitCode } = await runCli(['test.md', '--as-html'], { timeout: 60000 });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('HTML');

      const exists = await fs.access(htmlPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      const content = await fs.readFile(htmlPath, 'utf-8');
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('HTML Test');
    }, 60000);

    it('supports custom output filename for HTML', async () => {
      await writeTestFile('input.md', '# Custom HTML');

      const { exitCode } = await runCli(['input.md', 'output.html', '--as-html'], { timeout: 60000 });

      expect(exitCode).toBe(0);
      const exists = await fs.access(path.join(TEST_DIR, 'output.html')).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }, 60000);
  });

  describe('Syntax Highlighting (--highlight-style)', () => {
    it('applies highlight style to HTML output', async () => {
      const md = '# Code Test\n\n```javascript\nconst x = 1;\n```';
      await writeTestFile('code.md', md);

      const { exitCode } = await runCli(['code.md', '--as-html', '--highlight-style', 'monokai'], { timeout: 60000 });

      expect(exitCode).toBe(0);
      const content = await fs.readFile(path.join(TEST_DIR, 'code.html'), 'utf-8');
      expect(content).toContain('hljs');
    }, 60000);

    it('supports multiple highlight themes', async () => {
      const themes = ['github', 'monokai', 'dracula', 'vs2015', 'atom-one-dark', 'atom-one-light'];

      for (const theme of themes) {
        await writeTestFile(`code-${theme}.md`, '```js\nconst x = 1;\n```');
        const { exitCode } = await runCli([`code-${theme}.md`, '--as-html', '--highlight-style', theme], { timeout: 60000 });
        expect(exitCode).toBe(0);
      }
    }, 120000);
  });

  describe('PDF Options', () => {
    it('applies format option', async () => {
      await writeTestFile('format.md', '# Format Test');

      const { exitCode } = await runCli(['format.md', '--format', 'Letter'], { timeout: 60000 });

      expect(exitCode).toBe(0);
    }, 60000);

    it('applies landscape option', async () => {
      await writeTestFile('landscape.md', '# Landscape Test');

      const { exitCode } = await runCli(['landscape.md', '--landscape'], { timeout: 60000 });

      expect(exitCode).toBe(0);
    }, 60000);

    it('applies margin option with single value', async () => {
      await writeTestFile('margin1.md', '# Margin Test');

      const { exitCode } = await runCli(['margin1.md', '--margin', '2cm'], { timeout: 60000 });

      expect(exitCode).toBe(0);
    }, 60000);

    it('applies margin option with two values', async () => {
      await writeTestFile('margin2.md', '# Margin Test');

      const { exitCode } = await runCli(['margin2.md', '--margin', '1cm 2cm'], { timeout: 60000 });

      expect(exitCode).toBe(0);
    }, 60000);

    it('applies margin option with four values', async () => {
      await writeTestFile('margin4.md', '# Margin Test');

      const { exitCode } = await runCli(['margin4.md', '--margin', '1cm 2cm 3cm 4cm'], { timeout: 60000 });

      expect(exitCode).toBe(0);
    }, 60000);

    it('applies no-background option', async () => {
      await writeTestFile('nobg.md', '# No Background Test');

      const { exitCode } = await runCli(['nobg.md', '--no-background'], { timeout: 60000 });

      expect(exitCode).toBe(0);
    }, 60000);
  });

  describe('Custom Stylesheet (--stylesheet)', () => {
    it('applies custom CSS stylesheet', async () => {
      await writeTestFile('style.css', 'body { background: red; }');
      await writeTestFile('styled.md', '# Styled Document');

      const { exitCode } = await runCli(['styled.md', '--as-html', '--stylesheet', 'style.css'], { timeout: 60000 });

      expect(exitCode).toBe(0);
      const content = await fs.readFile(path.join(TEST_DIR, 'styled.html'), 'utf-8');
      expect(content).toContain('background: red');
    }, 60000);

    it('applies multiple stylesheets', async () => {
      await writeTestFile('style1.css', '.class1 { color: blue; }');
      await writeTestFile('style2.css', '.class2 { color: green; }');
      await writeTestFile('multi-style.md', '# Multi Style');

      const { exitCode } = await runCli([
        'multi-style.md',
        '--as-html',
        '--stylesheet', 'style1.css',
        '--stylesheet', 'style2.css'
      ], { timeout: 60000 });

      expect(exitCode).toBe(0);
      const content = await fs.readFile(path.join(TEST_DIR, 'multi-style.html'), 'utf-8');
      expect(content).toContain('color: blue');
      expect(content).toContain('color: green');
    }, 60000);
  });

  describe('Inline CSS (--css)', () => {
    it('applies inline CSS', async () => {
      await writeTestFile('inline-css.md', '# Inline CSS Test');

      const { exitCode } = await runCli([
        'inline-css.md',
        '--as-html',
        '--css', 'body { font-size: 20px; }'
      ], { timeout: 60000 });

      expect(exitCode).toBe(0);
      const content = await fs.readFile(path.join(TEST_DIR, 'inline-css.html'), 'utf-8');
      expect(content).toContain('font-size: 20px');
    }, 60000);
  });

  describe('Document Title (--title)', () => {
    it('sets document title', async () => {
      await writeTestFile('title.md', '# Content');

      const { exitCode } = await runCli(['title.md', '--as-html', '--title', 'My Custom Title'], { timeout: 60000 });

      expect(exitCode).toBe(0);
      const content = await fs.readFile(path.join(TEST_DIR, 'title.html'), 'utf-8');
      expect(content).toContain('<title>My Custom Title</title>');
    }, 60000);
  });

  describe('Config File (--config-file)', () => {
    it('loads config from JSON file', async () => {
      const config = {
        highlight_style: 'dracula',
        as_html: true,
        document_title: 'Config Test',
        css: 'body { margin: 0; }'
      };
      await writeTestFile('config.json', JSON.stringify(config, null, 2));
      await writeTestFile('config-test.md', '# Config Test');

      const { exitCode } = await runCli(['config-test.md', '--config-file', 'config.json'], { timeout: 60000 });

      expect(exitCode).toBe(0);
      const content = await fs.readFile(path.join(TEST_DIR, 'config-test.html'), 'utf-8');
      expect(content).toContain('Config Test');
    }, 60000);

    it('CLI options override config file options', async () => {
      const config = { document_title: 'From Config' };
      await writeTestFile('override-config.json', JSON.stringify(config));
      await writeTestFile('override.md', '# Override Test');

      const { exitCode } = await runCli([
        'override.md',
        '--as-html',
        '--config-file', 'override-config.json',
        '--title', 'From CLI'
      ], { timeout: 60000 });

      expect(exitCode).toBe(0);
      const content = await fs.readFile(path.join(TEST_DIR, 'override.html'), 'utf-8');
      expect(content).toContain('<title>From CLI</title>');
    }, 60000);

    it('auto-detects .md-to-pdf.json config file', async () => {
      const config = { as_html: true, document_title: 'Auto Config' };
      await writeTestFile('.md-to-pdf.json', JSON.stringify(config));
      await writeTestFile('auto-config.md', '# Auto Config Test');

      const { exitCode } = await runCli(['auto-config.md'], { timeout: 60000 });

      expect(exitCode).toBe(0);
      const content = await fs.readFile(path.join(TEST_DIR, 'auto-config.html'), 'utf-8');
      expect(content).toContain('Auto Config');
    }, 60000);

    it('shows error for missing config file', async () => {
      await writeTestFile('test.md', '# Test');

      const { stderr, exitCode } = await runCli(['test.md', '--config-file', 'nonexistent.json']);

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Config file not found');
    });

    it('shows error for invalid JSON in config file', async () => {
      await writeTestFile('invalid.json', '{ invalid json }');
      await writeTestFile('test.md', '# Test');

      const { stderr, exitCode } = await runCli(['test.md', '--config-file', 'invalid.json']);

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid JSON');
    });
  });

  describe('Page Media Type (--page-media-type)', () => {
    it('accepts screen media type', async () => {
      await writeTestFile('media-screen.md', '# Screen Media');

      const { exitCode } = await runCli(['media-screen.md', '--page-media-type', 'screen'], { timeout: 60000 });

      expect(exitCode).toBe(0);
    }, 60000);

    it('accepts print media type', async () => {
      await writeTestFile('media-print.md', '# Print Media');

      const { exitCode } = await runCli(['media-print.md', '--page-media-type', 'print'], { timeout: 60000 });

      expect(exitCode).toBe(0);
    }, 60000);
  });

  describe('Multi-file Processing', () => {
    it('processes multiple files', async () => {
      await writeTestFile('file1.md', '# File 1');
      await writeTestFile('file2.md', '# File 2');
      await writeTestFile('file3.md', '# File 3');

      const { stdout, exitCode } = await runCli(['file1.md', 'file2.md', 'file3.md'], { timeout: 120000 });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Processing 3 files');
      expect(stdout).toContain('Completed');

      for (const name of ['file1.pdf', 'file2.pdf', 'file3.pdf']) {
        const exists = await fs.access(path.join(TEST_DIR, name)).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    }, 120000);

    it('shows summary after batch processing', async () => {
      await writeTestFile('batch1.md', '# Batch 1');
      await writeTestFile('batch2.md', '# Batch 2');

      const { stdout, exitCode } = await runCli(['batch1.md', 'batch2.md'], { timeout: 120000 });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Completed');
      expect(stdout).toContain('successful');
    }, 120000);
  });

  describe('Glob Patterns', () => {
    it('expands glob patterns', async () => {
      await writeTestFile('glob1.md', '# Glob 1');
      await writeTestFile('glob2.md', '# Glob 2');
      await writeTestFile('glob3.md', '# Glob 3');

      const { stdout, exitCode } = await runCli(['glob*.md'], { timeout: 120000 });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Processing');
    }, 120000);

    it('shows error when no files match glob', async () => {
      const { stderr, exitCode } = await runCli(['nonexistent*.md']);

      expect(exitCode).toBe(1);
      expect(stderr).toContain('No matching files');
    });
  });

  describe('Frontmatter', () => {
    it('respects frontmatter configuration', async () => {
      const md = `---
document_title: Frontmatter Title
as_html: true
highlight_style: monokai
---

# Frontmatter Test

\`\`\`javascript
const x = 1;
\`\`\`
`;
      await writeTestFile('frontmatter.md', md);

      const { exitCode } = await runCli(['frontmatter.md'], { timeout: 60000 });

      expect(exitCode).toBe(0);
      const content = await fs.readFile(path.join(TEST_DIR, 'frontmatter.html'), 'utf-8');
      expect(content).toContain('<title>Frontmatter Title</title>');
    }, 60000);

    it('respects pdf_options in frontmatter', async () => {
      const md = `---
pdf_options:
  format: Letter
  landscape: true
  margin:
    top: 3cm
    bottom: 3cm
---

# PDF Options Test
`;
      await writeTestFile('pdf-opts.md', md);

      const { exitCode } = await runCli(['pdf-opts.md'], { timeout: 60000 });

      expect(exitCode).toBe(0);
    }, 60000);
  });

  describe('Special Content', () => {
    it('renders LaTeX math', async () => {
      const md = '# Math Test\n\nInline: $E = mc^2$\n\nBlock:\n$$\\int_0^1 x^2 dx$$';
      await writeTestFile('math.md', md);

      const { exitCode } = await runCli(['math.md', '--as-html'], { timeout: 60000 });

      expect(exitCode).toBe(0);
      const content = await fs.readFile(path.join(TEST_DIR, 'math.html'), 'utf-8');
      expect(content).toContain('katex');
    }, 60000);

    it('renders Mermaid diagrams', async () => {
      const md = '# Mermaid Test\n\n```mermaid\ngraph TD\n  A --> B\n```';
      await writeTestFile('mermaid.md', md);

      const { exitCode } = await runCli(['mermaid.md', '--as-html'], { timeout: 60000 });

      expect(exitCode).toBe(0);
      const content = await fs.readFile(path.join(TEST_DIR, 'mermaid.html'), 'utf-8');
      expect(content).toContain('mermaid');
    }, 60000);

    it('renders task lists', async () => {
      const md = '# Tasks\n\n- [x] Done\n- [ ] Todo';
      await writeTestFile('tasks.md', md);

      const { exitCode } = await runCli(['tasks.md', '--as-html'], { timeout: 60000 });

      expect(exitCode).toBe(0);
      const content = await fs.readFile(path.join(TEST_DIR, 'tasks.html'), 'utf-8');
      expect(content).toContain('checkbox');
    }, 60000);

    it('renders tables', async () => {
      const md = '# Table\n\n| A | B |\n|---|---|\n| 1 | 2 |';
      await writeTestFile('table.md', md);

      const { exitCode } = await runCli(['table.md', '--as-html'], { timeout: 60000 });

      expect(exitCode).toBe(0);
      const content = await fs.readFile(path.join(TEST_DIR, 'table.html'), 'utf-8');
      expect(content).toContain('<table>');
    }, 60000);
  });
});

describe('API (Programmatic Usage)', () => {
  beforeEach(async () => {
    await ensureTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir();
  });

  it('exports mdToPdf function', async () => {
    const { mdToPdf } = await import('./index');
    expect(typeof mdToPdf).toBe('function');
  });

  it('exports cleanup function', async () => {
    const { cleanup } = await import('./index');
    expect(typeof cleanup).toBe('function');
  });

  it('exports Config type', async () => {
    const indexModule = await import('./index');
    expect(indexModule).toHaveProperty('mdToPdf');
  });

  it('converts markdown content to PDF', async () => {
    const { mdToPdf, cleanup } = await import('./index');

    const result = await mdToPdf({ content: '# Hello World' });

    expect(result.content).toBeInstanceOf(Buffer);
    expect(result.content.length).toBeGreaterThan(0);

    await cleanup();
  }, 60000);

  it('converts markdown file to PDF', async () => {
    const { mdToPdf, cleanup } = await import('./index');
    const mdPath = await writeTestFile('api-test.md', '# API Test');

    const result = await mdToPdf({ path: mdPath });

    expect(result.content).toBeInstanceOf(Buffer);
    expect(result.content.length).toBeGreaterThan(0);

    await cleanup();
  }, 60000);

  it('outputs HTML when as_html is true', async () => {
    const { mdToPdf, cleanup } = await import('./index');

    const result = await mdToPdf(
      { content: '# HTML Output' },
      { as_html: true }
    );

    const html = result.content.toString('utf-8');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('HTML Output');

    await cleanup();
  }, 60000);

  it('saves to dest when specified', async () => {
    const { mdToPdf, cleanup } = await import('./index');
    const outputPath = path.join(TEST_DIR, 'api-output.pdf');

    const result = await mdToPdf(
      { content: '# Save Test' },
      { dest: outputPath }
    );

    expect(result.filename).toBe(outputPath);
    const exists = await fs.access(outputPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    await cleanup();
  }, 60000);

  it('applies custom stylesheet', async () => {
    const { mdToPdf, cleanup } = await import('./index');
    const cssPath = await writeTestFile('api-style.css', 'body { color: purple; }');

    const result = await mdToPdf(
      { content: '# Styled' },
      { as_html: true, stylesheet: cssPath }
    );

    const html = result.content.toString('utf-8');
    expect(html).toContain('color: purple');

    await cleanup();
  }, 60000);

  it('applies highlight_style', async () => {
    const { mdToPdf, cleanup } = await import('./index');

    const result = await mdToPdf(
      { content: '```js\nconst x = 1;\n```' },
      { as_html: true, highlight_style: 'dracula' }
    );

    const html = result.content.toString('utf-8');
    expect(html).toContain('hljs');

    await cleanup();
  }, 60000);

  it('throws error when neither path nor content provided', async () => {
    const { mdToPdf, cleanup } = await import('./index');

    await expect(mdToPdf({} as any)).rejects.toThrow('Either path or content must be provided');

    await cleanup();
  });
});
