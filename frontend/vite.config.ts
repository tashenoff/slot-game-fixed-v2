import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Относительные пути для Яндекс.Игр
  server: {
    port: 3002,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    // Оптимизация для игровых платформ
    assetsInlineLimit: 0, // Не инлайнить ассеты
    rollupOptions: {
      output: {
        // Предсказуемые имена для кэширования
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
})
