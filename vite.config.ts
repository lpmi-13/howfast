import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'static',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 700,
  },
});
