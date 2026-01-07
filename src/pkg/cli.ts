import { mdToPdf, cleanup, Config } from './index';
import * as path from 'path';
import * as fs from 'fs/promises';
import { watch } from 'chokidar';
import { glob } from 'glob';

const VERSION = '1.0.0';

function printHelp(): void {
  console.log(`
better-markdown-to-pdf v${VERSION}

Convert Markdown files to PDF with LaTeX, Mermaid diagrams, and syntax highlighting.

Usage:
  md-to-pdf <input.md> [output.pdf] [options]
  md-to-pdf <pattern> [options]
  md-to-pdf --help
  md-to-pdf --version

Arguments:
  input.md      Markdown file to convert (use "-" for stdin)
  pattern       Glob pattern to match multiple files (e.g., "docs/*.md")
  output.pdf    Output PDF file (default: input filename with .pdf extension)

Options:
  -w, --watch           Watch mode - regenerate PDF on file changes
  --as-html             Output HTML instead of PDF
  --highlight-style <s> Syntax highlighting theme (github, monokai, dracula, etc.)
  --stylesheet <path>   Add custom CSS stylesheet (can be used multiple times)
  --css <string>        Inline CSS styles
  --format <format>     Page format: A4, Letter, A3, A5, Legal, Tabloid (default: A4)
  --landscape           Use landscape orientation
  --margin <margin>     Page margins (e.g., "2cm" or "1cm 2cm" or "1cm 2cm 1cm 2cm")
  --no-background       Don't print background graphics
  --title <title>       Document title
  --basedir <path>      Base directory for resolving relative paths
  --config-file <path>  Load config from JSON file
  --page-media-type <t> CSS media type: screen or print (default: screen)
  --devtools            Open browser with DevTools for debugging (no PDF generated)
  --launch-options <j>  Playwright launch options as JSON string
  --markdown-options <j> Markdown-it parser options as JSON string
                        (html, linkify, typographer, breaks)
  --script <path>       Add custom JavaScript file (can be used multiple times)
  --md-file-encoding <e>  Encoding for markdown files (default: utf-8)
  --stylesheet-encoding <e> Encoding for CSS files (default: utf-8)
  --help, -h            Show this help message
  --version, -v         Show version number

Frontmatter:
  You can also configure options in the markdown file using YAML frontmatter:

  ---
  dest: ./output.pdf
  stylesheet: ./custom.css
  highlight_style: dracula
  as_html: false
  css: |
    body { font-size: 16px; }
  pdf_options:
    format: A4
    margin:
      top: 2cm
      bottom: 2cm
  markdown_options:
    html: true
    breaks: true
    linkify: true
  script:
    - path: ./custom.js
    - url: https://example.com/lib.js
  ---

Examples:
  md-to-pdf readme.md
  md-to-pdf readme.md output.pdf
  md-to-pdf readme.md --format Letter --landscape
  md-to-pdf readme.md --watch
  md-to-pdf readme.md --as-html
  md-to-pdf readme.md --highlight-style monokai
  md-to-pdf "docs/*.md"
  md-to-pdf chapter1.md chapter2.md chapter3.md
  cat readme.md | md-to-pdf - > output.pdf
`);
}

function printVersion(): void {
  console.log(`better-markdown-to-pdf v${VERSION}`);
}

interface ParsedArgs {
  inputs: string[];
  output?: string;
  config: Config;
  help: boolean;
  version: boolean;
  watch: boolean;
  asHtml: boolean;
  configFile?: string;
  devtools: boolean;
}

/**
 * Parse CSS-like margin string to margin object.
 * Supports 1, 2, 3, or 4 values like CSS margin shorthand.
 */
function parseMargin(margin: string): { top: string; right: string; bottom: string; left: string } {
  const parts = margin.split(' ').filter(Boolean);

  if (parts.length === 1) {
    return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
  } else if (parts.length === 2) {
    return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
  } else if (parts.length === 3) {
    return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
  } else if (parts.length >= 4) {
    return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
  }

  return { top: margin, right: margin, bottom: margin, left: margin };
}

/**
 * Extract frontmatter config from a markdown file.
 * Simple regex-based extraction for determining output format before full conversion.
 */
async function extractFrontmatterConfig(filePath: string): Promise<Partial<Config>> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    // Simple frontmatter extraction (YAML between --- delimiters)
    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatterMatch) {
      return {};
    }
    const yaml = frontmatterMatch[1];
    const config: Partial<Config> = {};
    // Extract as_html value (simple key: value parsing)
    const asHtmlMatch = yaml.match(/^as_html:\s*(true|false)/m);
    if (asHtmlMatch) {
      config.as_html = asHtmlMatch[1] === 'true';
    }
    return config;
  } catch {
    return {};
  }
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    inputs: [],
    config: {},
    help: false,
    version: false,
    watch: false,
    asHtml: false,
    devtools: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
      i++;
      continue;
    }

    if (arg === '--version' || arg === '-v') {
      result.version = true;
      i++;
      continue;
    }

    if (arg === '--watch' || arg === '-w') {
      result.watch = true;
      i++;
      continue;
    }

    if (arg === '--as-html') {
      result.asHtml = true;
      result.config.as_html = true;
      i++;
      continue;
    }

    if (arg === '--highlight-style') {
      result.config.highlight_style = args[++i];
      i++;
      continue;
    }

    if (arg === '--stylesheet') {
      const value = args[++i];
      if (!result.config.stylesheet) {
        result.config.stylesheet = [];
      }
      if (Array.isArray(result.config.stylesheet)) {
        result.config.stylesheet.push(value);
      }
      i++;
      continue;
    }

    if (arg === '--css') {
      result.config.css = (result.config.css || '') + args[++i];
      i++;
      continue;
    }

    if (arg === '--format') {
      result.config.pdf_options = result.config.pdf_options || {};
      result.config.pdf_options.format = args[++i] as 'A4' | 'Letter';
      i++;
      continue;
    }

    if (arg === '--landscape') {
      result.config.pdf_options = result.config.pdf_options || {};
      result.config.pdf_options.landscape = true;
      i++;
      continue;
    }

    if (arg === '--margin') {
      const marginValue = args[++i];
      result.config.pdf_options = result.config.pdf_options || {};
      result.config.pdf_options.margin = parseMargin(marginValue);
      i++;
      continue;
    }

    if (arg === '--no-background') {
      result.config.pdf_options = result.config.pdf_options || {};
      result.config.pdf_options.printBackground = false;
      i++;
      continue;
    }

    if (arg === '--title') {
      result.config.document_title = args[++i];
      i++;
      continue;
    }

    if (arg === '--basedir') {
      result.config.basedir = args[++i];
      i++;
      continue;
    }

    if (arg === '--config-file') {
      result.configFile = args[++i];
      i++;
      continue;
    }

    if (arg === '--page-media-type') {
      result.config.page_media_type = args[++i] as 'screen' | 'print';
      i++;
      continue;
    }

    if (arg === '--devtools') {
      result.devtools = true;
      result.config.devtools = true;
      i++;
      continue;
    }

    if (arg === '--launch-options') {
      try {
        result.config.launch_options = JSON.parse(args[++i]);
      } catch {
        console.error('Error: Invalid JSON for --launch-options');
        process.exit(1);
      }
      i++;
      continue;
    }

    if (arg === '--markdown-options') {
      try {
        result.config.markdown_options = JSON.parse(args[++i]);
      } catch {
        console.error('Error: Invalid JSON for --markdown-options');
        process.exit(1);
      }
      i++;
      continue;
    }

    if (arg === '--script') {
      const value = args[++i];
      if (!result.config.script) {
        result.config.script = [];
      }
      if (Array.isArray(result.config.script)) {
        // Check if it's a URL or a file path
        if (value.startsWith('http://') || value.startsWith('https://')) {
          result.config.script.push({ url: value });
        } else {
          result.config.script.push({ path: value });
        }
      }
      i++;
      continue;
    }

    if (arg === '--md-file-encoding') {
      result.config.md_file_encoding = args[++i] as BufferEncoding;
      i++;
      continue;
    }

    if (arg === '--stylesheet-encoding') {
      result.config.stylesheet_encoding = args[++i] as BufferEncoding;
      i++;
      continue;
    }

    // Positional arguments
    if (!arg.startsWith('-')) {
      result.inputs.push(arg);
    }

    i++;
  }

  // If exactly 2 inputs and second looks like output file, treat it as output
  if (result.inputs.length === 2) {
    const second = result.inputs[1];
    if (second.endsWith('.pdf') || second.endsWith('.html') || second === '-') {
      result.output = result.inputs.pop();
    }
  }

  return result;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    process.stdin.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on('error', reject);
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

async function convertFile(
  inputPath: string,
  outputPath: string,
  config: Config,
  isStdin: boolean = false,
  stdinContent?: string,
  silent: boolean = false
): Promise<void> {
  const ext = config.as_html ? 'html' : 'pdf';
  const displayInput = isStdin ? 'stdin' : inputPath;

  if (!silent) {
    console.log(`Converting ${displayInput} to ${ext.toUpperCase()}...`);
  }

  const finalConfig: Config = {
    ...config,
    dest: outputPath,
  };

  if (isStdin && stdinContent) {
    await mdToPdf({ content: stdinContent }, finalConfig);
  } else {
    await mdToPdf({ path: inputPath }, finalConfig);
  }

  if (outputPath !== 'stdout' && !silent) {
    console.log(`  -> ${outputPath}`);
  }
}

async function expandGlobs(patterns: string[]): Promise<string[]> {
  const allFiles: string[] = [];

  for (const pattern of patterns) {
    // Check if it's a glob pattern
    if (pattern.includes('*') || pattern.includes('?') || pattern.includes('[')) {
      const files = await glob(pattern, { nodir: true });
      allFiles.push(...files.filter(f => f.endsWith('.md')));
    } else {
      allFiles.push(pattern);
    }
  }

  // Deduplicate and sort
  return Array.from(new Set(allFiles)).sort();
}

async function watchFiles(
  inputPaths: string[],
  config: Config,
  asHtml: boolean
): Promise<void> {
  const ext = asHtml ? 'html' : 'pdf';
  const absolutePaths = inputPaths.map(p => path.resolve(process.cwd(), p));

  console.log(`Watching ${inputPaths.length} file(s) for changes...`);
  console.log(`Press Ctrl+C to stop.\n`);

  // Initial conversion of all files
  for (const inputPath of inputPaths) {
    const outputPath = path.resolve(process.cwd(), inputPath.replace(/\.md$/i, asHtml ? '.html' : '.pdf'));
    try {
      await convertFile(inputPath, outputPath, config);
    } catch (error) {
      console.error(`Error converting ${inputPath}:`, error instanceof Error ? error.message : error);
    }
  }

  // Watch for changes
  const watcher = watch(absolutePaths, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  watcher.on('change', async (changedPath) => {
    const relativePath = path.relative(process.cwd(), changedPath);
    const outputPath = changedPath.replace(/\.md$/i, asHtml ? '.html' : '.pdf');

    console.log(`\n[${new Date().toLocaleTimeString()}] ${relativePath} changed, regenerating ${ext.toUpperCase()}...`);
    try {
      await convertFile(changedPath, outputPath, config, false, undefined, true);
      console.log(`  -> ${path.relative(process.cwd(), outputPath)}`);
    } catch (error) {
      console.error('Conversion error:', error instanceof Error ? error.message : error);
    }
  });

  watcher.on('error', (error) => {
    console.error('Watch error:', error);
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nStopping watch mode...');
    await watcher.close();
    await cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await watcher.close();
    await cleanup();
    process.exit(0);
  });
}

async function loadConfigFile(configPath: string): Promise<Config> {
  const absolutePath = path.resolve(process.cwd(), configPath);
  try {
    const content = await fs.readFile(absolutePath, 'utf-8');
    return JSON.parse(content) as Config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(`Error: Config file not found: ${configPath}`);
    } else if (error instanceof SyntaxError) {
      console.error(`Error: Invalid JSON in config file: ${configPath}`);
    } else {
      console.error(`Error reading config file: ${error instanceof Error ? error.message : error}`);
    }
    process.exit(1);
  }
}

async function findDefaultConfigFile(): Promise<string | undefined> {
  const candidates = ['.md-to-pdf.json', 'md-to-pdf.config.json'];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // File doesn't exist, try next
    }
  }
  return undefined;
}

function mergeConfig(base: Config, override: Config): Config {
  return {
    ...base,
    ...override,
    pdf_options: {
      ...base.pdf_options,
      ...override.pdf_options,
    },
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  if (parsed.help) {
    printHelp();
    process.exit(0);
  }

  if (parsed.version) {
    printVersion();
    process.exit(0);
  }

  // Load config file (explicit or default)
  let fileConfig: Config = {};
  if (parsed.configFile) {
    fileConfig = await loadConfigFile(parsed.configFile);
  } else {
    const defaultConfig = await findDefaultConfigFile();
    if (defaultConfig) {
      fileConfig = await loadConfigFile(defaultConfig);
    }
  }

  // Merge config: file config < CLI options (CLI takes precedence)
  parsed.config = mergeConfig(fileConfig, parsed.config);

  // Sync as_html from config to parsed flag (config file may set it)
  if (parsed.config.as_html) {
    parsed.asHtml = true;
  }

  if (parsed.inputs.length === 0) {
    console.error('Error: No input file specified');
    console.error('Run "md-to-pdf --help" for usage information');
    process.exit(1);
  }

  const isStdin = parsed.inputs.length === 1 && parsed.inputs[0] === '-';

  // Handle stdin
  let stdinContent: string | undefined;
  if (isStdin) {
    if (parsed.watch) {
      console.error('Error: Watch mode is not supported with stdin input');
      process.exit(1);
    }

    stdinContent = await readStdin();

    if (!stdinContent.trim()) {
      console.error('Error: No content received from stdin');
      process.exit(1);
    }

    // Determine output path for stdin
    const ext = parsed.asHtml ? '.html' : '.pdf';
    const outputPath = parsed.output
      ? (parsed.output === '-' ? 'stdout' : path.resolve(process.cwd(), parsed.output))
      : 'stdout';

    try {
      await convertFile('-', outputPath, parsed.config, true, stdinContent);
      await cleanup();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      await cleanup();
      process.exit(1);
    }
    return;
  }

  // Expand glob patterns
  const inputFiles = await expandGlobs(parsed.inputs);

  if (inputFiles.length === 0) {
    console.error('Error: No matching files found');
    process.exit(1);
  }

  // Check if all input files exist
  for (const inputFile of inputFiles) {
    try {
      await fs.access(inputFile);
    } catch {
      console.error(`Error: File not found: ${inputFile}`);
      process.exit(1);
    }
  }

  // Single file mode
  if (inputFiles.length === 1 && !parsed.watch) {
    // Check frontmatter for as_html if not already set via CLI or config
    let useHtml = parsed.asHtml;
    if (!useHtml && !parsed.output) {
      const frontmatterConfig = await extractFrontmatterConfig(inputFiles[0]);
      if (frontmatterConfig.as_html) {
        useHtml = true;
      }
    }
    const ext = useHtml ? '.html' : '.pdf';
    const outputPath = parsed.output
      ? (parsed.output === '-' ? 'stdout' : path.resolve(process.cwd(), parsed.output))
      : path.resolve(process.cwd(), inputFiles[0].replace(/\.md$/i, ext));

    try {
      await convertFile(inputFiles[0], outputPath, parsed.config);
      await cleanup();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      await cleanup();
      process.exit(1);
    }
    return;
  }

  // Watch mode
  if (parsed.watch) {
    await watchFiles(inputFiles, parsed.config, parsed.asHtml);
    return;
  }

  // Multi-file batch mode
  console.log(`Processing ${inputFiles.length} files...\n`);
  const ext = parsed.asHtml ? '.html' : '.pdf';
  let successCount = 0;
  let errorCount = 0;

  for (const inputFile of inputFiles) {
    const outputPath = path.resolve(process.cwd(), inputFile.replace(/\.md$/i, ext));
    try {
      await convertFile(inputFile, outputPath, parsed.config, false, undefined, false);
      successCount++;
    } catch (error) {
      console.error(`Error converting ${inputFile}:`, error instanceof Error ? error.message : error);
      errorCount++;
    }
  }

  console.log(`\nCompleted: ${successCount} successful, ${errorCount} failed`);
  await cleanup();

  if (errorCount > 0) {
    process.exit(1);
  }
}

main();
