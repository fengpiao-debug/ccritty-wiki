// 文件作用：apps/server/src/store.js，负责后端服务的独立功能模块。
import mysql from 'mysql2/promise'
import crypto from 'node:crypto'
import { hashPassword } from './auth.js'
import { DEFAULT_SITE_SETTINGS } from '@artist-wiki/content-types'

const database = process.env.MYSQL_DATABASE || 'artist_wiki'
const auditRetentionDays = Math.max(1, Number(process.env.AUDIT_RETENTION_DAYS || 15))
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root',
  database,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
})

const defaultContent = {
  profile: {
    id: 'profile',
    type: 'profile',
    artistName: 'Critty熙影',
    subtitle: 'Singer · Composer',
    biographyTitle: '锦书',
    heroImage: '',
    markdown: 'Critty熙影，中国内地女歌手、音乐人。\\n\\n她的作品常以古典意象和现代编曲交织，形成细腻而有辨识度的声音。',
  },
  news: [{ id: 'news-1', type: 'news', title: '新曲动态', publishedAt: '2026-09-22', sourceName: '官方发布', sourceUrl: '', cover: '', markdown: '新作与现场消息将在这里持续更新。' }],
  events: [{ id: 'event-1', type: 'event', title: '未来活动示例', startsAt: '2026-10-01T19:30:00.000Z', endsAt: '', city: '杭州', venue: '待公布', category: '演出', status: 'upcoming', ticketUrl: '', cover: '', markdown: '活动详情将在官方确认后更新。' }],
  photos: [],
  songs: [{ id: 'song-1', type: 'song', title: '牵丝戏', artist: 'Critty熙影 / Aki阿杰', releasedAt: '2015-01-01', album: '单曲', cover: '', audioUrl: '', lyrics: '', description: '经典作品资料。' }],
  videos: [],
}

let state = null
const clone = (value) => JSON.parse(JSON.stringify(value))
const parseJson = (value) => typeof value === 'string' ? JSON.parse(value) : value
const sqlDate = (value) => new Date(value).toISOString().slice(0, 19).replace('T', ' ')
const nextId = (prefix) => `${prefix}-${crypto.randomUUID()}`

async function createDatabase() {
  const bootstrap = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root',
  })
  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${database.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await bootstrap.end()
}

async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_content (
      content_key VARCHAR(64) PRIMARY KEY,
      content_json JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id VARCHAR(80) PRIMARY KEY,
      username VARCHAR(80) NOT NULL UNIQUE,
      display_name VARCHAR(120) NOT NULL,
      role VARCHAR(30) NOT NULL DEFAULT 'editor',
      permissions_json JSON NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      password_salt VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_versions (
      id VARCHAR(80) PRIMARY KEY,
      content_type VARCHAR(30) NOT NULL,
      content_id VARCHAR(120) NOT NULL,
      version_no VARCHAR(20) NOT NULL,
      snapshot_json JSON NOT NULL,
      change_summary VARCHAR(255) NOT NULL,
      created_by VARCHAR(80) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_versions_content (content_type, content_id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_locks (
      content_type VARCHAR(30) NOT NULL,
      content_id VARCHAR(120) NOT NULL,
      user_id VARCHAR(80) NOT NULL,
      username VARCHAR(80) NOT NULL,
      expires_at DATETIME NOT NULL,
      PRIMARY KEY (content_type, content_id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(80) PRIMARY KEY,
      actor VARCHAR(80) NOT NULL,
      action VARCHAR(80) NOT NULL,
      target VARCHAR(80) NOT NULL,
      target_id VARCHAR(120) NULL,
      metadata_json JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_created (created_at)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
}

async function seedDefaults() {
  const [contentRows] = await pool.query('SELECT content_key FROM site_content WHERE content_key = ? LIMIT 1', ['site'])
  if (!contentRows.length) {
    await pool.query('INSERT INTO site_content (content_key, content_json) VALUES (?, ?)', ['site', JSON.stringify(defaultContent)])
  }
  const [adminRows] = await pool.query('SELECT id FROM admin_users WHERE username = ? LIMIT 1', ['admin'])
  if (!adminRows.length) {
    const credentials = hashPassword(process.env.ADMIN_PASSWORD || 'admin123456')
    await pool.query(
      `INSERT INTO admin_users (id, username, display_name, role, permissions_json, password_hash, password_salt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['user-admin', 'admin', '系统管理员', 'admin', JSON.stringify(['user.manage']), credentials.hash, credentials.salt],
    )
  }
}

async function loadState() {
  const [contentRows] = await pool.query('SELECT content_json FROM site_content WHERE content_key = ? LIMIT 1', ['site'])
  const [settingsRows] = await pool.query('SELECT content_json FROM site_content WHERE content_key = ? LIMIT 1', ['settings'])
  const [userRows] = await pool.query('SELECT id, username, display_name, role, permissions_json, password_hash, password_salt FROM admin_users')
  const [versionRows] = await pool.query('SELECT id, content_type, content_id, version_no, snapshot_json, change_summary, created_by, created_at FROM content_versions ORDER BY created_at DESC')
  const [lockRows] = await pool.query('SELECT content_type, content_id, user_id, username, expires_at FROM content_locks')
  const [auditRows] = await pool.query('SELECT id, actor, action, target, target_id, metadata_json, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 500')

  state = {
    settings: { ...DEFAULT_SITE_SETTINGS, ...(settingsRows[0] ? parseJson(settingsRows[0].content_json) : {}) },
    content: contentRows[0] ? parseJson(contentRows[0].content_json) : clone(defaultContent),
    users: userRows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
      permissions: parseJson(row.permissions_json),
      passwordHash: row.password_hash,
      passwordSalt: row.password_salt,
    })),
    versions: versionRows.map((row) => ({
      id: row.id,
      type: row.content_type,
      contentId: row.content_id,
      versionNo: row.version_no,
      snapshot: parseJson(row.snapshot_json),
      changeSummary: row.change_summary,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at).toISOString(),
    })),
    locks: lockRows.map((row) => ({
      type: row.content_type,
      contentId: row.content_id,
      userId: row.user_id,
      username: row.username,
      expiresAt: new Date(row.expires_at).toISOString(),
    })),
    audit: auditRows.map((row) => ({
      id: row.id,
      actor: row.actor,
      action: row.action,
      target: row.target,
      targetId: row.target_id,
      metadata: row.metadata_json ? parseJson(row.metadata_json) : null,
      createdAt: new Date(row.created_at).toISOString(),
    })),
  }
}

function pruneAuditState() {
  const cutoff = Date.now() - auditRetentionDays * 24 * 60 * 60 * 1000
  const before = state.audit.length
  state.audit = state.audit
    .filter((item) => new Date(item.createdAt).getTime() >= cutoff)
    .slice(0, 500)
  return state.audit.length !== before
}

export async function initStore() {
  await createDatabase()
  await createTables()
  await seedDefaults()
  // 收窄已有管理员的历史全权限，不修改账号、密码或业务内容。
  await pool.query('UPDATE admin_users SET permissions_json = ? WHERE role = ?', [JSON.stringify(['user.manage']), 'admin'])
  await loadState()
  await cleanupAuditLogs()
  return state
}

export async function persist() {
  pruneAuditState()
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.query('UPDATE site_content SET content_json = ? WHERE content_key = ?', [JSON.stringify(state.content), 'site'])
    await connection.query('DELETE FROM admin_users')
    for (const user of state.users) {
      await connection.query(
        `INSERT INTO admin_users (id, username, display_name, role, permissions_json, password_hash, password_salt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [user.id, user.username, user.displayName, user.role, JSON.stringify(user.permissions), user.passwordHash, user.passwordSalt],
      )
    }
    await connection.query('DELETE FROM content_versions')
    for (const version of state.versions) {
      await connection.query(
        `INSERT INTO content_versions (id, content_type, content_id, version_no, snapshot_json, change_summary, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [version.id, version.type, version.contentId, version.versionNo, JSON.stringify(version.snapshot), version.changeSummary, version.createdBy, sqlDate(version.createdAt)],
      )
    }
    await connection.query('DELETE FROM content_locks')
    for (const lock of state.locks) {
      await connection.query(
        `INSERT INTO content_locks (content_type, content_id, user_id, username, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [lock.type, lock.contentId, lock.userId, lock.username, sqlDate(lock.expiresAt)],
      )
    }
    await connection.query('DELETE FROM audit_logs')
    for (const item of state.audit) {
      await connection.query(
        `INSERT INTO audit_logs (id, actor, action, target, target_id, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.id, item.actor, item.action, item.target, item.targetId || null, item.metadata ? JSON.stringify(item.metadata) : null, sqlDate(item.createdAt)],
      )
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export function getState() { return state }
export function getSiteSettings() { return clone(state.settings) }

export async function saveSiteSettings(settings) {
  // 独立持久化公共设置，避免和歌手内容的保存互相覆盖。
  await pool.query(
    'INSERT INTO site_content (content_key, content_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE content_json = VALUES(content_json)',
    ['settings', JSON.stringify(settings)],
  )
  state.settings = clone(settings)
  return getSiteSettings()
}
export function cloneState(value) { return clone(value) }
export { nextId }

export async function audit(entry) {
  state.audit.unshift({ id: nextId('audit'), createdAt: new Date().toISOString(), ...entry })
  await persist()
}

export async function cleanupAuditLogs() {
  const changed = pruneAuditState()
  const cutoff = new Date(Date.now() - auditRetentionDays * 24 * 60 * 60 * 1000)
  const sqlCutoff = cutoff.toISOString().slice(0, 19).replace('T', ' ')
  await pool.query(
    'DELETE FROM audit_logs WHERE created_at < ?',
    [sqlCutoff],
  )
  if (changed) await persist()
}

export function getAuditRetentionDays() {
  return auditRetentionDays
}

export async function closeStore() {
  await pool.end()
}
