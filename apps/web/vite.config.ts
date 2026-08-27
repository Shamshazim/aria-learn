import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // P2H-12: one `.env`, at the repo root, for both apps. Vite would otherwise look only in
  // `apps/web`, so a `VITE_` key sitting beside the API's own settings would be invisible.
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { proxy: { '/api': 'http://localhost:3000' } },
  build: { sourcemap: true },
});
