#!/usr/bin/env node
// Local dev test for /api/vision against wrangler dev --remote on port 8790
const BASE = process.argv[2] || 'http://127.0.0.1:8790'
const pw = process.env.BK_PASSWORD

const login = await (await fetch(`${BASE}/api/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'bk', password: pw }),
})).json()
if (!login.token) { console.log('login failed', login); process.exit(1) }
console.log('login ok')

const t0 = Date.now()
const res = await fetch(`${BASE}/api/vision`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` },
  body: JSON.stringify({ text: '一碗雲吞麵加一碟蠔油生菜，半杯凍檸茶少甜' }),
})
const body = await res.json()
console.log(`vision: ${res.status} (${Date.now() - t0}ms)`)
console.log(JSON.stringify(body, null, 2).slice(0, 800))
