import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true, // Генерация .d.ts
  clean: true,
  sourcemap: true,
})
