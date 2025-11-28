import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 80,
    // Разрешаем любые хосты (чтобы не было ошибки "Invalid Host Header")
    allowedHosts: true, 
    proxy: {
      // Проксируем запросы к бэкенду
      '/stats': 'http://backend:3000',
      '/transaction': 'http://backend:3000',
      '/user': 'http://backend:3000',
      '/payment': 'http://backend:3000',
      '/transactions': 'http://backend:3000'
    }
  },
  preview: {
    host: true,
    port: 80,
    allowedHosts: true,
    proxy: {
      '/stats': 'http://backend:3000',
      '/transaction': 'http://backend:3000',
      '/user': 'http://backend:3000',
      '/payment': 'http://backend:3000',
      '/transactions': 'http://backend:3000'
    }
  }
})