import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite' // <--- Добавь этот импорт

export default defineConfig({
  plugins: [
    tailwindcss(), // <--- Добавь плагин сюда
  ],
})
