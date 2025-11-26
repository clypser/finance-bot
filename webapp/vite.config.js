import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 80,
    allowedHosts: true, // Разрешаем любые домены (включая ваш новый)
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
    allowedHosts: true, 
    proxy: {
      '/stats': 'http://backend:3000',
      '/transaction': 'http://backend:3000',
      '/budgets': 'http://backend:3000',
      '/debts': 'http://backend:3000',
    }
  }
})