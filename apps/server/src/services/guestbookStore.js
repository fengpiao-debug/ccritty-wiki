// 留言和附件独立持久化，避免混入公开内容快照及公开 uploads 目录。
import { pool } from '../store.js'

export async function initGuestbook() {
  await pool.query(`CREATE TABLE IF NOT EXISTS guestbook_messages (
    id VARCHAR(80) PRIMARY KEY, owner_hash CHAR(64) NOT NULL,
    nickname VARCHAR(40) NOT NULL, markdown TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending', featured TINYINT NOT NULL DEFAULT 0, created_at VARCHAR(30) NOT NULL,
    reviewed_by VARCHAR(80), reviewed_at VARCHAR(30),
    INDEX guestbook_status (status, created_at), INDEX guestbook_owner (owner_hash, created_at)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  const [columns] = await pool.query("SHOW COLUMNS FROM guestbook_messages LIKE 'featured'")
  if (!columns.length) {
    try { await pool.query('ALTER TABLE guestbook_messages ADD COLUMN featured TINYINT NOT NULL DEFAULT 0') }
    catch (error) { if (error.code !== 'ER_DUP_FIELDNAME') throw error }
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS guestbook_assets (
    id VARCHAR(80) PRIMARY KEY, message_id VARCHAR(80) NOT NULL,
    kind VARCHAR(16) NOT NULL, mime VARCHAR(40) NOT NULL, data MEDIUMBLOB NOT NULL,
    INDEX guestbook_message (message_id)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await pool.query(`CREATE TABLE IF NOT EXISTS guestbook_likes (
    message_id VARCHAR(80) NOT NULL, owner_hash CHAR(64) NOT NULL,
    PRIMARY KEY (message_id, owner_hash)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await pool.query(`CREATE TABLE IF NOT EXISTS guestbook_reports (
    message_id VARCHAR(80) NOT NULL, owner_hash CHAR(64) NOT NULL,
    reason VARCHAR(20) NOT NULL, created_at VARCHAR(30) NOT NULL,
    resolved_at VARCHAR(30), resolved_by VARCHAR(80),
    PRIMARY KEY (message_id, owner_hash), INDEX guestbook_reports_pending (resolved_at, message_id)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
}

export const guestbookStore = {
  async list({ owner, viewer, status, page = 1, admin = false, featuredOnly = false, reportedOnly = false, sort = 'latest' }) {
    const where = (reportedOnly && admin ? '1 = 1' : owner ? 'm.owner_hash = ?' : 'm.status = ?')
      + (featuredOnly ? " AND m.featured = 1 AND m.status = 'approved'" : '')
      + (reportedOnly && admin ? ' AND EXISTS (SELECT 1 FROM guestbook_reports r WHERE r.message_id = m.id AND r.resolved_at IS NULL)' : '')
    const args = reportedOnly && admin ? [] : [owner || (admin ? status : 'approved')]
    const [counts] = await pool.query(`SELECT COUNT(*) AS total FROM guestbook_messages m WHERE ${where}`, args)
    const reviewFields = admin ? ', m.reviewed_by AS reviewedBy, m.reviewed_at AS reviewedAt, (SELECT COUNT(*) FROM guestbook_reports r WHERE r.message_id = m.id AND r.resolved_at IS NULL) AS reportCount' : ''
    const order = !admin && sort === 'hot' ? 'likeCount DESC, m.created_at DESC, m.id DESC' : 'm.created_at DESC, m.id DESC'
    const [rows] = await pool.query(`SELECT m.id, m.markdown, m.status, m.featured, m.created_at AS createdAt,
      (SELECT COUNT(*) FROM guestbook_likes l WHERE l.message_id = m.id) AS likeCount,
      EXISTS (SELECT 1 FROM guestbook_likes l WHERE l.message_id = m.id AND l.owner_hash = ?) AS liked,
      EXISTS (SELECT 1 FROM guestbook_reports r WHERE r.message_id = m.id AND r.owner_hash = ?) AS reported
      ${reviewFields} FROM guestbook_messages m WHERE ${where}
      ORDER BY ${order} LIMIT 10 OFFSET ?`, [viewer || owner || '', viewer || owner || '', ...args, (page - 1) * 10])
    for (const row of rows) { row.featured = Boolean(row.featured); row.liked = Boolean(row.liked); row.reported = Boolean(row.reported) }
    if (rows.length) {
      const [assets] = await pool.query('SELECT id, message_id AS messageId, kind FROM guestbook_assets WHERE message_id IN (?)', [rows.map(row => row.id)])
      for (const row of rows) row.assets = assets.filter(asset => asset.messageId === row.id).map(({ id, kind }) => ({ id, kind }))
      if (admin) {
        const [reports] = await pool.query('SELECT message_id AS messageId, reason, COUNT(*) AS total FROM guestbook_reports WHERE resolved_at IS NULL AND message_id IN (?) GROUP BY message_id, reason', [rows.map(row => row.id)])
        for (const row of rows) row.reportReasons = reports.filter(report => report.messageId === row.id).map(({ reason, total }) => ({ reason, total }))
      }
    }
    return { items: rows, total: counts[0].total, page }
  },
  async create(message, assets) {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      await connection.query('INSERT INTO guestbook_messages (id, owner_hash, nickname, markdown, created_at) VALUES (?, ?, ?, ?, ?)',
        // 兼容旧表的必填列；匿名留言不采集昵称，也不返回历史昵称。
        [message.id, message.owner, '', message.markdown, message.createdAt])
      for (const asset of assets) await connection.query('INSERT INTO guestbook_assets (id, message_id, kind, mime, data) VALUES (?, ?, ?, ?, ?)',
        [asset.id, message.id, asset.kind, asset.mime, asset.data])
      await connection.commit()
    } catch (error) { await connection.rollback(); throw error }
    finally { connection.release() }
  },
  async asset(id) {
    const [rows] = await pool.query(`SELECT a.data, a.mime, m.owner_hash AS owner, m.status
      FROM guestbook_assets a JOIN guestbook_messages m ON m.id = a.message_id WHERE a.id = ?`, [id])
    return rows[0]
  },
  async review(id, status, actor) {
    const [result] = await pool.query("UPDATE guestbook_messages SET status = ?, featured = CASE WHEN ? = 'approved' THEN featured ELSE 0 END, reviewed_by = ?, reviewed_at = ? WHERE id = ?",
      [status, status, actor, new Date().toISOString(), id])
    return result.affectedRows > 0
  },
  async setFeatured(id, featured) {
    const [result] = await pool.query("UPDATE guestbook_messages SET featured = ? WHERE id = ? AND status = 'approved'", [featured ? 1 : 0, id])
    return result.affectedRows > 0
  },
  async remove(id) {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.query('SELECT id FROM guestbook_messages WHERE id = ? FOR UPDATE', [id])
      if (!rows.length) { await connection.rollback(); return false }
      await connection.query('DELETE FROM guestbook_assets WHERE message_id = ?', [id])
      await connection.query('DELETE FROM guestbook_likes WHERE message_id = ?', [id])
      await connection.query('DELETE FROM guestbook_reports WHERE message_id = ?', [id])
      await connection.query('DELETE FROM guestbook_messages WHERE id = ?', [id])
      await connection.commit()
      return true
    } catch (error) { await connection.rollback(); throw error }
    finally { connection.release() }
  },
  async interact(id, owner, action, value) {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.query("SELECT id FROM guestbook_messages WHERE id = ? AND status = 'approved' FOR UPDATE", [id])
      if (!rows.length) { await connection.rollback(); return null }
      let result
      if (action === 'like') {
        if (value) await connection.query('INSERT INTO guestbook_likes (message_id, owner_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE owner_hash = VALUES(owner_hash)', [id, owner])
        else await connection.query('DELETE FROM guestbook_likes WHERE message_id = ? AND owner_hash = ?', [id, owner])
        const [counts] = await connection.query('SELECT COUNT(*) AS total FROM guestbook_likes WHERE message_id = ?', [id])
        result = { liked: value, likeCount: counts[0].total }
      } else {
        await connection.query('INSERT INTO guestbook_reports (message_id, owner_hash, reason, created_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE owner_hash = VALUES(owner_hash)', [id, owner, value, new Date().toISOString()])
        result = { reported: true }
      }
      await connection.commit()
      return result
    } catch (error) { await connection.rollback(); throw error }
    finally { connection.release() }
  },
  async resolveReports(id, action, actor) {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.query('SELECT id FROM guestbook_messages WHERE id = ? FOR UPDATE', [id])
      if (!rows.length) { await connection.rollback(); return false }
      const now = new Date().toISOString()
      if (action === 'withdraw') await connection.query("UPDATE guestbook_messages SET status = 'rejected', featured = 0, reviewed_by = ?, reviewed_at = ? WHERE id = ?", [actor, now, id])
      await connection.query('UPDATE guestbook_reports SET resolved_at = ?, resolved_by = ? WHERE message_id = ? AND resolved_at IS NULL', [now, actor, id])
      await connection.commit()
      return true
    } catch (error) { await connection.rollback(); throw error }
    finally { connection.release() }
  },
}
