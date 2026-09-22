// 文件作用：apps/web/src/features/player/DesktopPlayerDock.jsx，负责全局音乐播放器的独立功能模块。
import { MiniPlayer } from './MiniPlayer'

// Desktop dock keeps the player feature name explicit while sharing the same stateful UI.
export function DesktopPlayerDock() {
  return <MiniPlayer />
}
