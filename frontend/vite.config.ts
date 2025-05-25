import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://5000-isv6r9soq4o7ekefcb7it-2426c704.manus.computer',
        changeOrigin: true,
        secure: false
      }
    },
    allowedHosts: [
      '3000-isv6r9soq4o7ekefcb7it-2426c704.manus.computer',
      'all'
    ]
  }
})
