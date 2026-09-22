// 文件作用：apps/web/src/main.jsx，负责项目公共配置或辅助逻辑。
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { PlayerProvider } from './features/player/PlayerContext'
import { ModernPlayer } from './features/player/ModernPlayer'
import { AuthProvider } from './features/auth/AuthContext'
import './styles/theme.css'
import './styles/layout.css'
import './styles/ink-effects.css'
import './styles/player.css'
import './styles/gallery.css'
import './styles/admin.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <PlayerProvider>
        <AuthProvider>
          <App />
          <ModernPlayer />
        </AuthProvider>
      </PlayerProvider>
    </BrowserRouter>
  </StrictMode>,
)
