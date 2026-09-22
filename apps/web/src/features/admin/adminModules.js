// 文件作用：集中定义后台栏目、数据集合和权限域，供路由、菜单和内容列表复用。
import { BookOpen, Newspaper, CalendarDays, Image, Music2, Video } from 'lucide-react'

export const adminModules = [
  { type: 'profile', key: 'profile', label: '歌手简介', scope: 'text', icon: BookOpen },
  { type: 'news', key: 'news', label: '动态管理', scope: 'text', icon: Newspaper },
  { type: 'event', key: 'events', label: '活动管理', scope: 'text', icon: CalendarDays },
  { type: 'photo', key: 'photos', label: '照片管理', scope: 'image', icon: Image },
  { type: 'song', key: 'songs', label: '歌曲管理', scope: 'music', icon: Music2 },
  { type: 'video', key: 'videos', label: '视频管理', scope: 'video', icon: Video },
]

export const permissionGroups = [
  { scope: 'text', label: '文字', detail: '简介、动态、活动' },
  { scope: 'image', label: '图片', detail: '照片、图片资源' },
  { scope: 'music', label: '音乐', detail: '歌曲、音频、歌词' },
  { scope: 'video', label: '视频', detail: 'B 站视频资料' },
]
