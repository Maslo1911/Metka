import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    // В dev-режиме запросы фронтенда на /api уходят на FastAPI (без проблем с CORS)
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
