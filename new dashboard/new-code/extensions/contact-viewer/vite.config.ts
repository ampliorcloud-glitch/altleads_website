/**
 * contact-viewer/vite.config.ts
 *
 * Manual multi-entry Vite build for the MV3 Chrome extension.
 *
 * We use a plain Vite build (NOT @crxjs/vite-plugin) because @crxjs 2.x is
 * incompatible with Vite 5+ (peer-dep gap as of 2026).  Instead we:
 *   1. Build two JS entries (background + sidepanel) as ES modules.
 *   2. Copy a static manifest.json into dist/ via a small Vite plugin.
 *   3. Copy sidepanel.html into dist/ via the same plugin.
 *
 * The result is a loadable unpacked extension at dist/.
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, writeFileSync, readFileSync } from 'fs';

// ---------------------------------------------------------------------------
// Tiny plugin: copy static assets into dist/ after build
// ---------------------------------------------------------------------------
function copyStaticAssets() {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      // Ensure dist exists
      mkdirSync('dist', { recursive: true });
      mkdirSync('dist/icons', { recursive: true });

      // Copy manifest.json
      copyFileSync('manifest.json', 'dist/manifest.json');

      // Copy sidepanel.html (Vite only processes it as an entry if listed in
      // rollupOptions.input, but we also copy it manually to guarantee placement)
      try {
        copyFileSync('src/sidepanel.html', 'dist/sidepanel.html');
      } catch {
        // If Vite already output it, this is a no-op
      }

      // Copy icons if they exist
      const iconSizes = [16, 32, 48, 128];
      iconSizes.forEach((size) => {
        const src = `icons/icon${size}.png`;
        try {
          copyFileSync(src, `dist/icons/icon${size}.png`);
        } catch {
          // Icons are optional for a dev build — skip silently
        }
      });

      console.log('[AltLeads] Static assets copied to dist/');
    },
  };
}

export default defineConfig({
  root: '.',
  envDir: '.',   // load .env from the extension folder

  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared'),
    },
    // Ensure node_modules are resolved from the extension folder,
    // even when the file being compiled lives in ../shared/
    dedupe: ['@supabase/supabase-js'],
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,          // keep readable for debugging / Chrome Webstore review
    sourcemap: false,       // no sourcemaps in the packed extension

    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        sidepanel: resolve(__dirname, 'src/sidepanel.ts'),
      },
      output: {
        // Use a flat output so Chrome can find background.js and sidepanel.js
        // directly in dist/ (no sub-directory).
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        // MV3 service workers must be ES module type
        format: 'es',
      },
    },
  },

  plugins: [copyStaticAssets()],
});
