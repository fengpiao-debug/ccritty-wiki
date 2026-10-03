# Artist Wiki

React 19 + Tailwind CSS + Express 的歌手 Wiki。

## 最新更新

### 2026-10-03

- 歌曲目录和播放器播放列表新增“+”按钮，可将选中歌曲设为下一首播放，当前播放进度保持不变。
- 前台作品、影卷、视频及后台内容、账号搜索新增关键词高亮，支持多个关键词和清空搜索后恢复原样。
- 歌词搜索结果显示命中位置附近的歌词片段，并高亮关键词，自动隐藏歌词时间标记。
- 活动时间树改为中央主线、活动卡片左右交错排列，海报与活动信息一起展示；手机端自动切换为单列时间线。
- 动态时间树同步采用中央主线和左右交错卡片，保留按日期排序、配图与来源链接，手机端自动切换为单列。

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
