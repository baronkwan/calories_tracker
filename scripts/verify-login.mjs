#!/usr/bin/env node
// Verify BK login + days flow with the current password from .env
const BASE = 'https://calorie-api.baronjetso.workers.dev'
const pw = process.env.BK_PASSWORD

const loginRes = await fetch(`${BASE}/api/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'bk', password: pw }),
})
const loginBody = await loginRes.json()
console.log('login:', loginRes.status, loginBody.user ? `✓ ${loginBody.user.username}` : loginBody)
if (loginRes.status !== 200) process.exit(1)

const daysRes = await fetch(`${BASE}/api/days`, {
  headers: { Authorization: `Bearer ${loginBody.token}` },
})
const daysBody = await daysRes.json()
console.log('days:', daysRes.status, Object.keys(daysBody.days || {}))
for (const [k, d] of Object.entries(daysBody.days || {})) {
  console.log(`  ${k}: ${d.total} kcal, ${d.meals.length} meals`)
}
