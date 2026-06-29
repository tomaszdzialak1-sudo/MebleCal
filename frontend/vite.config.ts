import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Backend (FastAPI) na :8000 — proxy dla wywołań /api z frontu.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
