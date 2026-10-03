# Artist Wiki

React 19 + Tailwind CSS + Express 的歌手 Wiki。

## 最新更新

### 2026-10-04

- 管理员可在“网站设置”修改浏览器标题、上传替换 favicon，保存后立即生效，清除后恢复默认图标。
- 顶部和页脚支持分别替换标识图片、印章文字及小字；顶部站点名称、副标题与页脚名称、简介均可自行维护，也可一键将顶部标识复制到页脚。
- 页脚“探索档案”补齐“视频作品”入口，可直接进入视频栏目。

[查看完整更新记录](docs/releases/release-notes.md)

## 启动

```bash
npm install
npm run dev
```

- 前台：http://localhost:5173
- 后台：http://localhost:5173/admin
- API：http://localhost:3007/api/health

本地默认管理员：

```text
账号：admin
密码：password
```

生产环境请设置 `ADMIN_JWT_SECRET`，并替换默认管理员密码。当前后端使用 MySQL 持久化。

管理员登录后进入“账号与权限”，负责账号授权和网站设置。请创建独立编辑者并分配文字、图片、音乐或视频权限后维护歌手内容。已有管理员的 `*` 权限会自动收窄，不修改原有密码或内容。

管理员也可进入“网站设置”（`/admin/settings`），填写公共页脚的版权说明、ICP备案号与链接、公安备案号与链接，以及关于页面的标题和 Markdown 正文。留空的备案项不会显示；访客从任意前台页面的页脚进入 `/about`。设置独立保存在 MySQL 中，仅管理员可修改，保存操作会记录到操作日志。
公共页脚采用站点品牌、栏目导航、关于简介和联系信息的分栏布局；站点名称、简介、关于摘要、联系邮箱与说明也在“网站设置”中维护。默认介绍和 example.com 邮箱为演示内容，可按需替换。
“网站设置”还支持浏览器标题、favicon、顶部名称与副标题、顶部和页脚标识及印章文字、页脚小字。网站图片支持选择文件或拖入 PNG / JPG / WEBP / GIF / AVIF（最大 5MB），也可填写站内或 HTTP / HTTPS 图片地址；已有 ICO 图标可通过地址使用。上传的 favicon 自动生成透明留边的 64 × 64 PNG，顶部和页脚图片按比例完整显示。上传完成后点击“保存网站设置”统一生效；上传期间禁止保存，清除 favicon 恢复默认图标。顶部名称留空沿用歌手名称，副标题和页脚小字留空隐藏。网站图片仅管理员可上传。

默认本地数据库配置：

```dotenv
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=root
MYSQL_DATABASE=wiki
ADMIN_PASSWORD=password
ADMIN_JWT_SECRET=artist
AUDIT_RETENTION_DAYS=15
```

服务启动时会自动创建数据库、内容表、用户表、版本表、编辑锁表和审计日志表。管理员进入后台的“操作日志”可以查看账号、内容和上传操作；日志默认保留 15 天，服务启动时和运行期间每日自动清理。
