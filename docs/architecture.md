# 架构说明

项目由 React 前端和 Express 后端组成，工作区包负责跨端共享权限常量、内容类型和 Markdown 渲染规则。

- `apps/web`：公开 Wiki、后台 CMS、全局播放器。
- `apps/server`：登录、权限、内容 CRUD、版本、编辑锁和资源上传。
- `packages/permissions`：权限常量和内容类型到权限域的映射。
- `packages/content-types`：内容类型和显示名称。
- `packages/markdown`：受限 Markdown 渲染器。

当前使用 MySQL 持久化，`store.js` 负责初始化数据表和加载、保存数据。

## 后台模块

后台使用独立的系统字体、侧边栏、顶部账号栏和表格样式，不继承前台水墨视觉。

- `AdminLayout`：登录守卫与管理系统框架。
- `AdminDashboard` / `adminModules`：按有效权限配置菜单、路由和内容集合。
- `UserManagementPage` / `UserEditorDialog` / `PermissionMatrix`：管理员账号管理、表单及授权矩阵。
- `ContentManagementPage` / `ContentEditorDialog` / `ContentFields`：编辑者内容列表和独立编辑窗口。
- `VersionHistoryPanel`：版本列表、只读快照预览及确认恢复。
- `AdminDialog`：共享对话框、焦点和键盘行为。

管理员仅负责账号管理，内容编辑由独立编辑者账号完成。后端鉴权规则见 `permissions.md`。
