import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@cortex/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  server: {
    port: 3002,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});

