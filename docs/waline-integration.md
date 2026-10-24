# Waline 接入说明

本项目使用 `@waline/client` **3.16.1** 官方组件提供编辑、图片表情选择、预览、图片选择/粘贴/拖入及提交交互，保留本站的留言列表 UI、点赞/举报、管理员审核和 MySQL 数据。不是独立部署 Waline Server；现有留言、附件和匿名身份无需迁移。

## 结构

- `WalineComposer.jsx` 动态加载官方 `init()`，关闭昵称/邮箱/网址、登录、GIF 搜索、文章反应与 RSS。文字“预览”和主题通过限定在组件内的 CSS 适配。
- `walineIntegration.js` 是开发、生产和测试共用的 Vite 解析插件。仅对官方客户端内部的 `@waline/api`、`marked` 导入提供本站适配；不改 `node_modules`，不覆盖全局 `fetch`。
- `walineTransport.js` 把官方提交参数转换为现有匿名 API 的 multipart 请求。官方内部列表隐藏，由本站 React 列表处理精选/本人筛选、排序刷新、点赞和举报。登录/编辑/回复等未启用接口失败关闭。
- `walineMarkdown.js` 将 Waline 的预览导向本站关闭 HTML 的 Markdown 渲染器，输出再经过独立 DOMPurify 白名单。原版预览解析器不会进入客户端打包结果。
- `@waline/client` 为 MIT 许可；基础图片来自 `@waline/emojis` **1.4.0** 的原始 Weibo 包，按其 GPL-3.0-or-later 许可原样提供。完整包的安装版本由 lockfile 固定，本地图片、许可及来源说明在 `apps/web/public/waline-emojis/`，未改动素材。

## 交互与安全

- 列表在前、输入框在后。成功提交后显示 4 秒“留言已提交，审核通过后将会展示”，随后消失；“我的留言”展示待审核内容。失败保留草稿。
- 图片选择后仅生成当前页面的 Blob URL，在真正提交时一起发送到原有审核附件接口。未提交图片不会先进入公共图库。刷新页面后需要重新选择图片；移除正文里的图片标记即不提交该图片。
- 正文保存基础表情短代码（例如 `:weibo_smile:`），只允许预置本地图片路径。任意 HTML、外链图片、SVG 与未知 Blob URL 不渲染。管理员审核页和前台使用同一安全渲染器。
- 发送给后端的仍然只有正文、附件及浏览器匿名凭证；不发送 Waline 的昵称、邮箱、登录令牌或 UA。后端继续强制待审核、图片重编码、附件鉴权、限流与管理员权限。

## 升级检查

升级 Waline 时，应确认其 `@waline/api` 命名导出、Marked 调用方式、表情 HTML 格式和 CSS 类名。不要只升级 lockfile：运行真实官方组件测试、上传/预览/XSS 回归、构建和浏览器检查。服务端路由及数据库权限仍通过原有 guestbook 测试验证。

## 本地端口与 Vue 运行时

本站页面由 React 驱动，Waline 官方组件内部使用 Vue。Vite 的适配插件提供 Vue 编译标志，编辑器不再向可选函数属性传入 `false`。Markdown 说明链接隐藏，但 Markdown 编辑与安全预览仍保留。

开发环境仅允许 HTTP 回环地址（localhost、127.0.0.1、[::1]）随 Vite 改变端口；生产浏览器来源必须与 `WEB_ORIGIN` 精确一致。拒绝的来源返回 403，不再误报 500。已通过用户使用的 5174 代理验证实际 multipart 提交、本人可见与公开隔离，临时验证留言已清理。
