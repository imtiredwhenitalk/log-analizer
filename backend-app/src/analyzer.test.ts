import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeLog } from './analyzer.js'

test('detects encoded payloads and preserves original line numbers', () => {
  const result = analyzeLog('encoded.log', '10.0.0.1 - GET /search?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E HTTP/1.1 400 12')

  const xss = result.detections.find((detection) => detection.id === 'xss')
  assert.ok(xss)
  assert.equal(xss.occurrences, 1)
  assert.equal(xss.examples[0]?.line, 1)
  assert.equal(result.summary.status4xx, 1)
})

test('requires brute-force failures from the same source', () => {
  const lines = Array.from({ length: 4 }, (_, index) => `10.0.0.${index + 1} POST /login HTTP/1.1 401 failed password`)
  const result = analyzeLog('auth.log', lines.join('\n'))

  assert.equal(result.detections.some((detection) => detection.id === 'brute-force'), false)
})

test('does not treat arbitrary standalone numbers as HTTP statuses', () => {
  const result = analyzeLog('application.log', 'job=200 completed in 15ms\nretry=500')

  assert.equal(result.summary.status4xx, 0)
  assert.equal(result.summary.status5xx, 0)
  assert.equal(result.summary.averageResponseMs, 15)
})

test('extracts metrics from structured JSON logs', () => {
  const result = analyzeLog('api.jsonl', '{"ip":"10.0.0.8","method":"POST","path":"/login","status":401,"duration":42,"message":"invalid password"}')

  assert.equal(result.summary.requestCount, 1)
  assert.equal(result.summary.status4xx, 1)
  assert.equal(result.summary.averageResponseMs, 42)
  assert.deepEqual(result.methodCounts, { POST: 1 })
})

test('detects encoded payloads even when another field has malformed encoding', () => {
  const result = analyzeLog('mixed.log', 'GET /search?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E&bad=%ZZ HTTP/1.1 400 20')

  assert.equal(result.detections.find((detection) => detection.id === 'xss')?.occurrences, 1)
})

test('detects private network SSRF targets in URLs', () => {
  const result = analyzeLog('ssrf.log', '10.0.0.4 GET /fetch?url=http://user:pass@192.168.1.20/admin HTTP/1.1 400 10')

  assert.equal(result.detections.find((detection) => detection.id === 'ssrf')?.occurrences, 1)
})