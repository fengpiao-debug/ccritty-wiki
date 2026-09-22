// 文件作用：配置播放器组件集成测试，隔离浏览器媒体与后端数据，不修改真实数据库。
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', include: ['src/**/*.test.jsx'] },
})
