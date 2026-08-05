import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  /**
   * The arqfs Worker is a module Worker: it `import`s sqlite-wasm, which loads its
   * own `.wasm` relative to itself. Vite's default worker format for a production
   * build is `iife`, which cannot carry a static import at all - so without this
   * the Worker works in dev and fails only in a built bundle.
   */
  worker: {
    format: 'es',
  },
});
