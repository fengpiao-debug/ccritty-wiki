# 架构说明

项目由 React 前端和 Express 后端组成，工作区包负责跨端共享权限常量、内容类型和 Markdown 渲染规则。

- `apps/web`：公开 Wiki、后台 CMS、全局播放器。
- `apps/server`：登录、权限、内容 CRUD、版本、编辑锁和资源上传。
- `packages/permissions`：权限常量和内容类型到权限域的映射。
- `packages/content-types`：内容类型和显示名称。
- `packages/markdown`：受限 Markdown 渲染器。

当前使用 MySQL 持久化，`store.js` 负责初始化数据表和加载、保存数据。

## 后台模块

后台保留独立的管理布局和信息密度，但复用前台水墨主题的纸张背景、朱砂红、青绿色、字体和交互状态。

- `AdminLayout`：登录守卫与管理系统框架。
- `AdminDashboard` / `adminModules`：按有效权限配置菜单、路由和内容集合。
- `UserManagementPage` / `UserEditorDialog` / `PermissionMatrix`：管理员账号管理、表单及授权矩阵。
- `ContentManagementPage` / `ContentEditorDialog` / `ContentFields`：编辑者内容列表和独立编辑窗口。
- `VersionHistoryPanel`：版本列表、只读快照预览及确认恢复。
- `AuditLogPage`：管理员查看账号、内容和资源操作审计日志。
- `AdminDialog`：共享对话框、焦点和键盘行为。

管理员仅负责账号管理，内容编辑由独立编辑者账号完成。后端鉴权规则见 `permissions.md`。

## 操作日志

`audit_logs` 使用 MySQL 持久化，记录登录、账号变更、内容保存/删除/回滚以及图片、音频、文字、歌词和 B 站信息上传。

- 只有拥有 `user.manage` 权限的管理员可以查看日志。
- 默认保留最近 15 天，服务启动时清理一次，运行期间每 24 小时自动清理一次。
- 可通过 `AUDIT_RETENTION_DAYS` 调整保留天数，最小为 1 天。
