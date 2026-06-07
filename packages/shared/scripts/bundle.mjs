// Dual ESM + CJS bundle for @disbox/shared
// Used by both Node server (CJS via require) and modern bundlers (ESM).
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

await build({
  entryPoints: [resolve(root, 'src/index.ts')],
  outfile: resolve(root, 'dist/index.js'),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  sourcemap: true,
  logLevel: 'info',
});

await build({
  entryPoints: [resolve(root, 'src/index.ts')],
  outfile: resolve(root, 'dist/index.cjs'),
  bundle: true,
  format: 'cjs',
  platform: 'neutral',
  target: 'es2022',
  sourcemap: true,
  logLevel: 'info',
});
