// 文件作用：apps/web/src/App.jsx，负责项目公共配置或辅助逻辑。
import { Navigate, Route, Routes } from 'react-router-dom'
import { PublicLayout } from './components/PublicLayout'
import { AdminLayout } from './components/AdminLayout'
import { HomePage } from './features/public/HomePage'
import { NewsPage } from './features/public/NewsPage'
import { EventsPage } from './features/public/EventsPage'
import { GalleryPage } from './features/public/GalleryPage'
import { MusicPage } from './features/public/MusicPage'
import { VideoPage } from './features/public/VideoPage'
import { AdminDashboard } from './features/admin/AdminDashboard'
import { AboutPage } from './features/public/AboutPage'

export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/music" element={<MusicPage />} />
        <Route path="/videos" element={<VideoPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Route>
      <Route path="/admin/*" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
