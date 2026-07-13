/**
 * data-research/vite.config.ts
 *
 * Same manual multi-entry Vite build pattern as contact-viewer.
 * Two entries: background + sidepanel.
 * manifest.json and sidepanel.html are copied into dist/ by the plugin.
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

function copyStaticAssets() {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      mkdirSync('dist', { recursive: true });
      mkdirSync('dist/icons', { recursive: true });

      copyFileSync('manifest.json', 'dist/manifest.json');

      try {
        copyFileSync('src/sidepanel.html', 'dist/sidepanel.html');
      } catch {
        // Vite may have already output it
      }

      const iconSizes = [16, 32, 48, 128];
      iconSizes.forEach((size) => {
        try {
          copyFileSync(`icons/icon${size}.png`, `dist/icons/icon${size}.png`);
        } catch {
          // Icons are optional for dev
        }
      });

      console.log('[AltLeads Data Research] Static assets copied to dist/');
    },
  };
}

export default defineConfig({
  root: '.',
  envDir: '.',

  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared'),
    },
    dedupe: ['@supabase/supabase-js'],
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: false,

    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        sidepanel: resolve(__dirname, 'src/sidepanel.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        format: 'es',
      },
    },
  },

  plugins: [copyStaticAssets()],
});
