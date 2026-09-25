import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  // Single self-contained index.html (JS, CSS and fonts inlined) so the product works by double-click, offline.
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: { assetsInlineLimit: 100_000_000 },
  test: { environment: 'node', setupFiles: ['./tests/setup.ts'], include: ['tests/**/*.test.ts'] },
})
