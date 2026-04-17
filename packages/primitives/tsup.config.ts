import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  platform: 'browser',
  // КРИТИЧЕСКИ ВАЖНО: не инлайнить ядро
  external: ['elestra'], 
})
