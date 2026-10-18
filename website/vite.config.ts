import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/Spitit/',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    open: false
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
