#!/usr/bin/env node
/**
 * API smoke test — auth + multi-user isolation.
 * Requires ADMIN_KEY / BK_PASSWORD in env (sourced from .env).
 * Usage: node scripts/test-api.mjs
 */
const BASE = 'https://calorie-api.baronjetso.workers.dev'
const adminKey = process.env.ADMIN_KEY
const bkPassword = process.env.BK_PASSWORD

const j = async (r) => ({ status: r.status, body: await r.json() })

// 1. BK login
const login = await j(await fetch(`${BASE}/api/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'bk', password: bkPassword }),
}))
console.log('BK login:', login.status, login.body.user ? `✓ ${login.body.user.username}` : login.body)
if (login.status !== 200) process.exit(1)
const bkToken = login.body.token

// 2. BK sees his days (should include 2026-08-05/06)
const bkDays = await j(await fetch(`${BASE}/api/days`, { headers: { Authorization: `Bearer ${bkToken}` } }))
console.log('BK days:', bkDays.status, Object.keys(bkDays.body.days || {}))

// 3. Unauthenticated rejected
const noAuth = await j(await fetch(`${BASE}/api/days`))
console.log('No-auth days:', noAuth.status, '(expect 401)')

// 4. Register a test user
const uname = `test${Date.now().toString().slice(-6)}`
const reg = await j(await fetch(`${BASE}/api/register`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: uname, password: 'test1234', displayName: '測試' }),
}))
console.log('Register:', reg.status, reg.body.user ? `✓ ${reg.body.user.username}` : reg.body)
const testToken = reg.body.token

// 5. Test user starts empty (isolation from BK)
const testDays = await j(await fetch(`${BASE}/api/days`, { headers: { Authorization: `Bearer ${testToken}` } }))
console.log('Test user days:', testDays.status, Object.keys(testDays.body.days || {}), '(expect empty)')

// 6. Test user PUT a day
const put = await j(await fetch(`${BASE}/api/day/2026-08-06`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${testToken}` },
  body: JSON.stringify({ meals: [{ name: '早餐', items: [{ name: '測試餐', portion: '1份', kcal: 300 }], total: 300 }], total: 300 }),
}))
console.log('Test user PUT day:', put.status, put.body)

// 7. BK still sees only his data (isolation)
const bkDays2 = await j(await fetch(`${BASE}/api/days`, { headers: { Authorization: `Bearer ${bkToken}` } }))
console.log('BK days after test write:', Object.keys(bkDays2.body.days || {}), '(expect only 05, 06)')

// 8. Foods catalog (shared)
const foods = await j(await fetch(`${BASE}/api/foods`, { headers: { Authorization: `Bearer ${bkToken}` } }))
console.log('Foods catalog:', foods.status, `${(foods.body.foods || []).length} items`)

// 9. Admin pull (BK days via admin key)
const adminDays = await j(await fetch(`${BASE}/api/admin/days`, { headers: { 'x-admin-key': adminKey } }))
console.log('Admin days:', adminDays.status, Object.keys(adminDays.body.days || {}))
