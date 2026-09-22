// 文件作用：以中文权限矩阵编辑内容授权，自动保证编辑权限包含查看权限，提供单领域预设。
import { permissionGroups } from './adminModules'

export function PermissionMatrix({ value, onChange }) {
  const preset = permissionGroups.find(({ scope }) => value.length === 2 && value.includes(`${scope}.read`) && value.includes(`${scope}.write`))?.scope || ''
  function toggle(scope, action, checked) {
    const permissions = new Set(value)
    const key = `${scope}.${action}`
    if (checked) { permissions.add(key); if (action === 'write') permissions.add(`${scope}.read`) }
    else { permissions.delete(key); if (action === 'read') permissions.delete(`${scope}.write`) }
    onChange([...permissions])
  }
  return <section className="cms-permissions">
    <h3>权限分配</h3>
    <label className="cms-preset">职责预设<select aria-label="职责预设" value={preset} onChange={(event) => {
      if (event.target.value) onChange([`${event.target.value}.read`, `${event.target.value}.write`])
    }}><option value="">自定义权限</option>{permissionGroups.map((group) => <option key={group.scope} value={group.scope}>仅负责{group.label}</option>)}</select></label>
    <table className="cms-table permission-table"><thead><tr><th>内容模块</th><th>查看</th><th>编辑</th></tr></thead>
      <tbody>{permissionGroups.map(({ scope, label, detail }) => <tr key={scope}>
        <td><strong>{label}</strong><small>{detail}</small></td>
        {['read', 'write'].map((action) => <td key={action}><input type="checkbox" aria-label={`${label}${action === 'read' ? '查看' : '编辑'}`} checked={value.includes(`${scope}.${action}`)} onChange={(event) => toggle(scope, action, event.target.checked)} /></td>)}
      </tr>)}</tbody></table>
    <div className="cms-extra-permissions">{[['content.publish', '发布 / 下线'], ['content.rollback', '历史版本 / 回滚']].map(([key, label]) =>
      <label key={key}><input type="checkbox" checked={value.includes(key)} onChange={(event) => onChange(event.target.checked ? [...value, key] : value.filter((item) => item !== key))} />{label}</label>)}</div>
  </section>
}
