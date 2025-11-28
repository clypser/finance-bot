import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Очень важно: Mini-app Telegram требует base: "./"
// иначе пути к JS ломаются и ты видишь БЕЛЫЙ экран
export default defineConfig({
  plugins: [react()],

  base: './',   // <-- критически важно для Telegram WebApp

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
  },

  server: {
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
  },

  preview: {
    host: true,
    port: 80,
    allowedHosts: true
  }
});
