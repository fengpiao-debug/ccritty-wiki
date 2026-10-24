// Vite may select another port when 5173 is occupied. Only local development
// origins get this flexibility; production must use the configured WEB_ORIGIN.
export function createCorsOptions({ production = process.env.NODE_ENV === 'production', webOrigin = process.env.WEB_ORIGIN } = {}) {
  return {
    origin(origin, callback) {
      if (!origin || (webOrigin && origin === webOrigin)) return callback(null, true)
      if (!production) {
        try {
          const url = new URL(origin)
          if (url.origin === origin && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return callback(null, true)
        } catch { /* Reject malformed origins below. */ }
      }
      const error = new Error('不允许的跨域来源')
      error.status = 403
      error.code = 'CORS_ORIGIN_DENIED'
      callback(error)
    },
  }
}
