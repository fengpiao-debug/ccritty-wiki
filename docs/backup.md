# 测试服务器定时备份

备份脚本运行在测试服务器，数据来源为该服务器的 MySQL 和上传目录。开发电脑无需开机。

## 范围与时间

- 每天北京时间 **19:00** 运行，systemd 日历明确指定 `Asia/Shanghai`，不依赖服务器默认时区。
- 测试服务器关机错过时间时，启动定时器后补执行一次。
- MySQL：读取 `/etc/artist-wiki.env` 中的连接信息，完整导出应用数据库的表结构和数据。
- 上传目录：`/opt/artist-wiki/shared/uploads`，包含音频、图片。
- 接收位置：本地私密配置 `.env.ssh` 的 `host` 服务器、`path` 下的 `artist-wiki` 子目录。
- 备份是完整备份，每次一个 `artist-wiki-北京时间-随机编号.tar.gz` 和对应 `.sha256` 文件；接收端只保留最新一份成功备份。
- 压缩包包含 `database.sql`、`uploads/` 和 `manifest.json`，不包含应用代码或服务器密码配置。完整迁移还需单独保留代码和环境配置。

数据库先使用事务一致性快照导出，再打包上传文件。当前程序以随机文件名新增资源，不覆盖或物理删除已有文件，因此可以在网站继续运行时备份。备份期间新增的未引用文件可能一并打包。如果未来增加覆盖文件或物理清理功能，应先调整备份协调方式。

## 文件

- `deploy/backup/backup.py`：备份与传输脚本，仅依赖 Python 3.9+ 标准库、MySQL 客户端和 OpenSSH。
- `deploy/backup/retain_latest.py`：接收端保留策略，通过 SSH 使用接收服务器的 Python 3 执行；校验最新备份后，删除同目录中较旧的备份包及校验文件。
- `deploy/backup/config.example.json`：配置示例，实际配置为测试服务器的 `/etc/artist-wiki-backup.json`。
- `deploy/backup/artist-wiki-backup.service` / `.timer`：执行服务及定时器。
- `deploy/backup/test_backup.py` / `test_retention.py`：使用临时文件和模拟进程的测试，不连接业务数据库。

`.env.ssh` 已被 Git 忽略。其 `passwd` 仅用于首次配置 SSH 访问，不写进脚本、定时任务或备份包。未配置 `user` / `username`、`port` 时，首次配置默认使用 `root` 和 `22`。

## 首次安装或迁移

以下操作在测试服务器进行：

1. 将 `backup.py` 和 `retain_latest.py` 保存到 `/opt/artist-wiki/backup-tools/`，权限设为 `0755`；接收服务器需提供 Python 3。
2. 创建 `/var/backups/artist-wiki` 和 `/etc/artist-wiki-backup`，均由 root 拥有，权限 `0700`。
3. 生成专用 SSH 密钥 `/etc/artist-wiki-backup/id_ed25519`。将其公钥追加到接收服务器目标账号的 `authorized_keys`，可以使用 `restrict,from="测试服务器IP"` 限制来源和转发能力，保留原有密钥。
4. 核实接收服务器 SSH 主机指纹，把对应主机公钥保存到 `/etc/artist-wiki-backup/known_hosts`；脚本强制校验该公钥。
5. 根据示例填写 `/etc/artist-wiki-backup.json`。接收服务器使用 `.env.ssh` 指定的 `host`，接收目录使用其 `path` 加 `/artist-wiki`。配置、私钥和主机公钥文件的权限设为 `0600`。
6. 把 service 和 timer 安装到 `/etc/systemd/system/`，运行 `systemctl daemon-reload`。
7. 先手动执行一次并检查接收端压缩包，再启用定时器：

```sh
systemctl start artist-wiki-backup.service
journalctl -u artist-wiki-backup.service -n 50 --no-pager
systemctl enable --now artist-wiki-backup.timer
systemctl list-timers artist-wiki-backup.timer --all
```

脚本使用文件锁避免并发备份；上传到临时文件名，远端 SHA-256 校验通过后才发布正式文件名。专用接收目录权限为 `0700`，备份文件为 `0600`。

## 保留与失败处理

- **远端只保留最新一份完整备份及其校验文件**。每批上传结束后重新校验接收端最新备份的 SHA-256，通过后删除较旧的备份包与对应校验文件；保留文件名中的时间便于确认备份日期。
- 新备份创建或传输失败时，上一份成功备份继续保留。旧积压文件重传不会替换接收端时间更晚的备份；清理失败会记录为任务失败。
- 清理范围仅限接收端专用 `artist-wiki` 目录中符合备份命名规则的文件，不处理其他文件、未完成上传或部署时单独创建的回滚备份。
- 测试服务器的 `/var/backups/artist-wiki` 仅暂存待发送的完整压缩包；确认远端校验通过后删除对应本地副本。
- 传输失败时最多尝试三次，保留本地完整备份，服务标记失败。下一次运行会生成新的备份，并重试积压的压缩包。
- `/var/backups/artist-wiki/last-run.json` 记录最近一次执行结果，详细记录在 systemd journal 中。
- 脚本不发送邮件或聊天通知；失败通过服务状态、日志及结果文件查看。

```sh
# 查看状态、下次执行时间和日志
systemctl status artist-wiki-backup.timer artist-wiki-backup.service
systemctl list-timers artist-wiki-backup.timer --all
journalctl -u artist-wiki-backup.service -n 100 --no-pager
cat /var/backups/artist-wiki/last-run.json

# 立即备份一次
systemctl start artist-wiki-backup.service

# 只重传之前失败的完整备份
python3 /opt/artist-wiki/backup-tools/backup.py --retry-only

# 停止后续定时执行（不删除已有备份）
systemctl disable --now artist-wiki-backup.timer
```

## 校验和恢复

在接收目录中，对选定的同一批次文件进行校验：

```sh
sha256sum -c artist-wiki-具体时间和编号.tar.gz.sha256
tar -tzf artist-wiki-具体时间和编号.tar.gz
```

恢复前保留目标站点现状，暂停目标应用的写入，并把压缩包解压到独立目录。`database.sql` 包含 `CREATE DATABASE`、`USE` 和表重建语句，导入会替换同名数据库中的相关表；确认恢复目标后再导入。将同一压缩包内的 `uploads/` 恢复到应用上传目录，并设置应用用户可读的属主和权限。

恢复后配置数据库账号、应用环境和代码，启动应用，检查首页文字、图片、歌曲播放以及后台登录。数据库账号授权和 MySQL 系统库不属于本备份范围。
