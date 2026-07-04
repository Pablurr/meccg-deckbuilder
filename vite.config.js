import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = 'http://localhost:3000';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': API,
      '/images': API,
      '/backs': API,
      '/cards.json': API,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
