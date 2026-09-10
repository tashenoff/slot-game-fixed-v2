import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Относительные пути для Яндекс.Игр
  server: {
    port: 3002,
    strictPort: false,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://192.168.0.10:5000',
        changeOrigin: true,
        secure: false,
        configure(proxy, options) {
          options.target = process.env.API_PROXY_TARGET || 'http://192.168.0.10:5000'
        }
      }
    }
  },
  build: {
    // Оптимизация для игровых платформ
    assetsInlineLimit: 0, // Не инлайнить ассеты
    rollupOptions: {
      output: {
        // Хэшированные имена — чтобы WebView/браузер не держал старый бандл после деплоя
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
})
