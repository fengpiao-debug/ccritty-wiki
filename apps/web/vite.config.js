// 文件作用：apps/web/vite.config.js，负责项目公共配置或辅助逻辑。
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/favicon.ico': { target: 'http://localhost:3007', rewrite: () => '/api/favicon' },
      '/api': 'http://localhost:3007',
      '/uploads': 'http://localhost:3007',
    },
  },
})
