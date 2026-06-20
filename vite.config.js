import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          codemirror: [
            'codemirror',
            '@codemirror/view',
            '@codemirror/state',
          ],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
});
