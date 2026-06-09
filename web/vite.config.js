import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 4001,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/imgs': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/ical': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
})
