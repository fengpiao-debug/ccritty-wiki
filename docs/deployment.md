# Test Server Deployment

Deployed on 2026-09-30 to the server configured in the ignored `test.env` file.

## Access

- Public site: http://43.155.25.168/
- Administration: http://43.155.25.168/admin
- Health check: http://43.155.25.168/api/health
- Initial administrator: `admin`. The generated password is in the local, ignored `.deployment/test-access.json` file. Do not commit or publish this file.
- This deployment uses HTTP because no domain or TLS certificate was provided. Configure HTTPS before using it as a production site.

## Layout

| Component | Location |
| --- | --- |
| Application releases | `/opt/artist-wiki/releases/` |
| Active application | `/opt/artist-wiki/current` |
| Node executable | `/opt/artist-wiki/runtime/bin/node` |
| Persistent uploads | `/opt/artist-wiki/shared/uploads` |
| Static releases | `/var/www/artist-wiki/releases/` |
| Active static files | `/var/www/artist-wiki/current` |
| Private environment | `/etc/artist-wiki.env` (root only) |
| Systemd service | `/etc/systemd/system/artist-wiki.service` |
| Nginx site | `/etc/nginx/conf.d/artist-wiki.conf` |

The API runs as the non-login `artist-wiki` system user and listens only on `127.0.0.1:3007`. Nginx serves the frontend and proxies `/api/` and `/uploads/`. Nginx replaces the forwarded client address, and the application trusts only the loopback proxy. The systemd service restarts on failure and is enabled at boot.

MySQL uses the `artist_wiki` database and a dedicated `artist_wiki@localhost` user with privileges limited to that database. Application startup creates the five tables: `site_content`, `admin_users`, `content_versions`, `content_locks`, and `audit_logs`.

The initial deployment imports the local public content and uploaded media, but does not copy local accounts, passwords, edit history, locks, or audit logs. It generates a fresh administrator password and JWT secret. Administrators manage accounts; create a separate editor with the required content permissions to maintain the site.

## Operations

Run these commands on the server:

```sh
systemctl status artist-wiki nginx mysqld
journalctl -u artist-wiki -n 100 --no-pager
curl --fail http://127.0.0.1:3007/api/health
nginx -t
systemctl restart artist-wiki
systemctl reload nginx
```

Before a future deployment, back up the database, persistent uploads, private environment, and active release symlink targets. Install Linux dependencies in a new release directory rather than uploading Windows `node_modules`. Keep the API and static release symlinks synchronized. Do not rerun initial content import against an existing site.

`deploy/artist-wiki.service` and `deploy/nginx.conf.template` contain the deployed service templates. Replace `__SERVER_NAME__` with the intended IP or domain. When adding a domain and HTTPS, also update `WEB_ORIGIN` in `/etc/artist-wiki.env` and restart the API.

Favicon updates require the frontend, API, and Nginx configuration to be deployed together. The HTML uses `/api/favicon` before React loads; this endpoint redirects to the saved icon with `Cache-Control: no-store`, or to `/favicon-32.png` when cleared. The exact Nginx `/favicon.ico` location proxies to the same endpoint, so browsers that request that conventional path also receive the configured icon. Apply the updated template, run `nginx -t`, and reload Nginx when deploying this change. Verify both `/api/favicon` and `/favicon.ico` return a `302` with the current icon in `Location` and `Cache-Control: no-store`.

The MySQL root password provided in `test.env` did not authenticate. After confirming the MySQL instance contained only system databases and had no client connections, the first deployment provisioned the isolated application database/account using a temporary MySQL startup initialization file. Both the initialization file and the temporary systemd override were removed, and MySQL was restarted normally. The root password was not changed.
