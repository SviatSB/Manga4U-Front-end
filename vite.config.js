import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

// Collect all HTML files in project root and add them as build inputs so
// Vite builds/serves each page separately (not only index.html).
const htmlFiles = fs.readdirSync(__dirname).filter((f) => f.endsWith('.html'));
const input = {};
for (const f of htmlFiles) {
  // use name without extension as key
  input[f.replace(/\.html$/, '')] = resolve(__dirname, f);
}

export default defineConfig({
  root: '.',
  server: {
    port: 5173,
  },
  // base can be overridden via env var VITE_BASE (useful for GitHub Pages)
  base: process.env.VITE_BASE || '/',
  build: {
    rollupOptions: {
      input,
    },
  },
});
