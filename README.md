# Artist Wiki

React 19 + Tailwind CSS + Express 的歌手 Wiki。

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
密码：admin123456
```

生产环境请设置 `ADMIN_JWT_SECRET`，并替换默认管理员密码。当前后端使用 MySQL 持久化。

管理员登录后进入“账号与权限”，仅负责账号与授权，不编辑内容。请创建独立编辑者并分配文字、图片、音乐或视频权限后进行内容维护。已有管理员的 `*` 权限会自动收窄，不修改原有密码或内容。

默认本地数据库配置：

```dotenv
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=root
MYSQL_DATABASE=artist_wiki
ADMIN_PASSWORD=admin123456
ADMIN_JWT_SECRET=artist-wiki-change-me
```

服务启动时会自动创建数据库、内容表、用户表、版本表、编辑锁表和审计日志表。
