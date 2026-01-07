import { defineConfig } from 'tsup';

export default defineConfig([
  // Library build
  {
    entry: { index: 'src/pkg/index.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    splitting: false,
    sourcemap: true,
    minify: false,
    external: [
      'playwright',
      'markdown-it',
      'markdown-it-checkbox',
      'highlight.js',
      'katex',
      'isomorphic-dompurify',
      'dompurify',
    ],
    treeshake: true,
    tsconfig: 'tsconfig.pkg.json',
  },
  // CLI build
  {
    entry: { cli: 'src/pkg/cli.ts' },
    format: ['cjs'],
    dts: false,
    clean: false,
    splitting: false,
    sourcemap: false,
    minify: false,
    external: [
      'playwright',
      'markdown-it',
      'markdown-it-checkbox',
      'highlight.js',
      'katex',
      'isomorphic-dompurify',
      'dompurify',
    ],
    treeshake: true,
    tsconfig: 'tsconfig.pkg.json',
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
