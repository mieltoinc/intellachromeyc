import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { mkdirSync, copyFileSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-files',
      closeBundle() {
        // Copy manifest
        copyFileSync('manifest.json', 'dist/manifest.json');
        
        // Create icons directory and copy placeholder
        try {
          mkdirSync('dist/icons', { recursive: true });
          copyFileSync('icons/placeholder.txt', 'dist/icons/placeholder.txt');
        } catch (e) {
          console.log('Icons directory handling:', e);
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        content: resolve(__dirname, 'src/content/index.tsx'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background/index.js';
          }
          if (chunkInfo.name === 'content') {
            return 'content/index.js';
          }
          return '[name]/index.js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          if (name.endsWith('.css')) {
            return 'content/styles.css';
          }
          if (name.endsWith('.html')) {
            return '[name][extname]';
          }
          return 'assets/[name][extname]';
        },
        format: 'es',
        manualChunks: (id) => {
          // Don't create chunks for content script dependencies
          if (id.includes('src/content/') || 
              id.includes('src/types/') || 
              id.includes('src/utils/domReader')) {
            return undefined;
          }
        },
      },
    },
  },
});

