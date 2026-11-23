/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Porta fixa: o Tauri aponta para ela em tauri.conf.json (devUrl).
export default defineConfig({
  plugins: [vue()],
  // Flags do build esm-bundler declaradas explicitamente (guia de produção do Vue):
  // sem devtools nem detalhes de hidratação no binário final.
  define: {
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      // main.ts é a raiz de composição (só instancia e monta); tipos não geram código.
      exclude: ['src/main.ts', 'src/**/*.test.ts', 'src/**/*.d.ts', 'src/domain/models.ts', 'src/test/**'],
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
      reporter: ['text', 'html'],
    },
  },
})
