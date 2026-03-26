import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ command }) => ({
  // Dev server serves demo/index.html; library build does not use this root
  root: command === 'serve' ? 'demo' : undefined,
  publicDir: false,
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Pindrop',
      formats: ['es', 'umd'],
      fileName: (format) => `pindrop.${format === 'es' ? 'es' : 'umd'}.js`,
    },
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  test: {
    root: resolve(__dirname),
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    css: true,
  },
}));
