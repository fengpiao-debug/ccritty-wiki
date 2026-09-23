// 文件作用：展示后台操作审计日志，帮助管理员追踪账号、内容和资源操作记录。
import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, RefreshCw } from 'lucide-react'
import { contentApi } from '../../lib/api'

const actionLabels = {
  'auth.login': '登录后台',
  'user.create': '创建账号',
  'user.update': '修改账号权限',
  'user.delete': '删除账号',
  'content.save': '保存内容',
  'content.delete': '删除内容',
  'content.restore': '恢复历史版本',
  'asset.upload': '上传资源',
  'asset.import': '导入资源',
}
const targetLabels = {
  user: '账号',
  profile: '歌手简介',
  news: '动态',
  event: '活动',
  photo: '照片',
  song: '歌曲',
  video: '视频',
  text: '文字',
  lyrics: '歌词',
  image: '图片',
  audio: '音频',
}

function detailFor(item) {
  const metadata = item.metadata || {}
  if (item.action === 'user.create') return `创建「${metadata.displayName || metadata.username || item.targetId}」`
  if (item.action === 'user.update') return `更新「${metadata.displayName || metadata.username || item.targetId}」的权限`
  if (item.action === 'user.delete') return `删除「${metadata.displayName || metadata.username || item.targetId}」`
  if (item.action === 'asset.upload' || item.action === 'asset.import') return metadata.fileName || metadata.url || targetLabels[item.target] || item.target
  if (item.action.startsWith('content.')) return metadata.title || item.targetId || targetLabels[item.target] || item.target
  return item.targetId || targetLabels[item.target] || item.target
}

export function AuditLogPage() {
  const [items, setItems] = useState([])
  const [retentionDays, setRetentionDays] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await contentApi.auditLogs()
      setItems(result.items || [])
      setRetentionDays(result.retentionDays || 15)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { reload() }, [reload])

  return (
    <>
      <div className="cms-page-heading">
        <div>
          <h1>操作日志</h1>
          <p>系统管理 / 审计记录</p>
        </div>
        <button className="cms-button" type="button" onClick={reload} disabled={loading}>
          <RefreshCw size={16} />刷新日志
        </button>
      </div>
      {error && <p className="cms-alert error" role="alert">{error}</p>}
      <section className="cms-registry">
        <div className="cms-section-title">
          <h2><ClipboardList size={17} /> 最近操作 <span>{items.length}</span></h2>
          <span className="cms-muted">日志保留 {retentionDays} 天</span>
        </div>
        <div className="cms-table-scroll">
          <table className="cms-table audit-table">
            <thead><tr><th>时间</th><th>操作者</th><th>操作</th><th>对象</th><th>详情</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="cms-table-empty">正在加载日志…</td></tr>}
              {!loading && items.map((item) => (
                <tr key={item.id}>
                  <td className="audit-time">{new Date(item.createdAt).toLocaleString('zh-CN')}</td>
                  <td><strong>{item.actorName || item.actor}</strong><small>{item.actor}</small></td>
                  <td><span className="cms-badge blue">{actionLabels[item.action] || item.action}</span></td>
                  <td>{targetLabels[item.target] || item.target}</td>
                  <td className="audit-detail">{detailFor(item)}</td>
                </tr>
              ))}
              {!loading && !items.length && <tr><td colSpan={5} className="cms-table-empty">暂无操作日志</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
