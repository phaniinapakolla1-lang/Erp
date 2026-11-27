import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    // Never publish readable TypeScript source maps in production builds
    sourcemap: false,
    minify: 'esbuild',
  },
  esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : undefined,
}));
