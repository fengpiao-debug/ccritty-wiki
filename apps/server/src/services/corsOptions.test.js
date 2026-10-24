import test from 'node:test'
import assert from 'node:assert/strict'
import { createCorsOptions } from './corsOptions.js'

const check = (options, origin) => {
  let result
  createCorsOptions(options).origin(origin, (error, allowed) => { result = { error, allowed } })
  return result
}

test('development accepts loopback origins when Vite changes its port', () => {
  for (const origin of ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5175', 'http://[::1]:5174']) {
    assert.equal(check({ production: false }, origin).allowed, true)
  }
})
test('production accepts only its explicit browser origin, not arbitrary localhost ports', () => {
  const options = { production: true, webOrigin: 'https://wiki.example.com' }
  assert.equal(check(options, 'https://wiki.example.com').allowed, true)
  assert.equal(check(options, undefined).allowed, true)
  for (const origin of ['http://localhost:5173', 'http://localhost:5174', 'https://other.example.com', 'null']) {
    assert.equal(check(options, origin).error.code, 'CORS_ORIGIN_DENIED')
    assert.equal(check(options, origin).error.status, 403)
  }
})
test('development rejects deceptive hostnames, credentials, paths and nonlocal origins', () => {
  for (const origin of ['http://localhost.evil.test:5174', 'http://localhost@evil.test:5174', 'http://evil@localhost:5174', 'http://localhost:5174/path', 'http://192.168.1.2:5174', 'null']) {
    assert.equal(check({ production: false }, origin).error.status, 403)
  }
})
