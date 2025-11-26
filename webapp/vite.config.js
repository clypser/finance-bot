import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 80,
    // Разрешаем вашу ссылку ngrok для режима разработки
    allowedHosts: ['uncinate-tonelessly-mariyah.ngrok-free.dev'],
    proxy: {
      '/stats': 'http://backend:3000',
      '/transaction': 'http://backend:3000',
      '/budgets': 'http://backend:3000',
      '/debts': 'http://backend:3000',
    }
  },
  preview: {
    host: true,
    port: 80,
    // Разрешаем вашу ссылку ngrok для режима preview (который в Docker)
    allowedHosts: ['uncinate-tonelessly-mariyah.ngrok-free.dev'],
    proxy: {
      '/stats': 'http://backend:3000',
      '/transaction': 'http://backend:3000',
      '/budgets': 'http://backend:3000',
      '/debts': 'http://backend:3000',
    }
  }
})