// 文件作用：后台账号密码哈希、JWT 签发和请求身份校验。
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'

const SECRET = process.env.ADMIN_JWT_SECRET || 'artist-wiki-local-secret'

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex') }
}

export function verifyPassword(password, storedHash, salt) {
  if (!storedHash || !salt) return false
  const expected = Buffer.from(hashPassword(password, salt).hash, 'hex')
  const actual = Buffer.from(storedHash, 'hex')
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

export function issueToken(user) {
  return jwt.sign({ sub: user.id }, SECRET, { expiresIn: '12h' })
}

export function authRequired(request, response, next) {
  const header = String(request.headers.authorization || '')
  if (!/^Bearer\s+\S+$/i.test(header)) {
    response.status(401).json({ message: '请先登录后台' })
    return
  }
  const token = header.replace(/^Bearer\s+/i, '').trim()
  try {
    request.user = jwt.verify(token, SECRET)
    next()
  } catch {
    response.status(401).json({ message: '登录已过期，请重新登录' })
  }
}
