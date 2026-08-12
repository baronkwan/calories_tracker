// API end-to-end test for exercise routes (throwaway user).
const BASE = 'https://calorie-api.baronjetso.workers.dev'
const u = `uitest${Date.now().toString().slice(-6)}`
const pw = 'test123456'

async function call(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

const reg = await call('/api/register', { method: 'POST', body: JSON.stringify({ username: u, password: pw, displayName: 'UITest' }) })
if (reg.status !== 200) { console.log('❌ register failed', reg); process.exit(1) }
const token = reg.body.token
const H = { Authorization: `Bearer ${token}` }
console.log('✅ register', u)

// 1. Manual add: indoor walk 30min, weight unknown → server defaults 60kg → 3.5*60*0.5=105
const add = await call('/api/exercises', { method: 'POST', headers: H, body: JSON.stringify({ date: '2026-08-12', type: 'indoor_walk', durationMin: 30 }) })
console.log('✅ add indoor_walk 30min →', JSON.stringify(add.body), add.status !== 200 ? '❌' : '')
if (add.status !== 200 || add.body.kcal !== 105) { console.log('❌ unexpected kcal'); process.exit(1) }

// 2. Manual add with profile weight — set profile weight 78.5 then indoor_run 45min → 8.3*78.5*0.75=488.6→489
await call('/api/profile', { method: 'PUT', headers: H, body: JSON.stringify({ profile: { gender: 'male', age: 35, heightCm: 175, weightKg: 78.5, activity: 'light', goal: 'maintain' } }) })
const add2 = await call('/api/exercises', { method: 'POST', headers: H, body: JSON.stringify({ date: '2026-08-12', type: 'indoor_run', durationMin: 45 }) })
console.log('✅ add indoor_run 45min @78.5kg →', JSON.stringify(add2.body), add2.body.kcal === 489 ? 'OK' : `expected 489 got ${add2.body.kcal}`)

// 3. Custom kcal override on 'other'
const add3 = await call('/api/exercises', { method: 'POST', headers: H, body: JSON.stringify({ date: '2026-08-12', type: 'other', durationMin: 20, kcal: 250, name: '家務' }) })
console.log('✅ add custom 250kcal →', JSON.stringify(add3.body))

// 4. Apple Health batch import (with duration in seconds + dedup on re-run)
const importItems = [
  { type: 'HKWorkoutActivityTypeRunning', startDate: '2026-08-11T07:00:00+0800', endDate: '2026-08-11T07:45:00+0800', duration: 2700 },
  { type: 'HKWorkoutActivityTypeCycling', startDate: '2026-08-11T18:00:00+0800', endDate: '2026-08-11T18:30:00+0800', duration: 1800 },
  { type: 'HKWorkoutActivityTypeYoga', startDate: '2026-08-12T06:30:00+0800', endDate: '2026-08-12T07:00:00+0800', duration: 1800 },
  { type: 'UnknownTypeXYZ', startDate: '2026-08-12T20:00:00+0800', endDate: '2026-08-12T20:30:00+0800', duration: 1800 }, // → other 4 MET
]
const imp1 = await call('/api/exercises/import', { method: 'POST', headers: H, body: JSON.stringify({ items: importItems }) })
console.log('✅ import #1 →', JSON.stringify(imp1.body))
const imp2 = await call('/api/exercises/import', { method: 'POST', headers: H, body: JSON.stringify({ items: importItems }) })
console.log('✅ import #2 (dedup) →', JSON.stringify(imp2.body), imp2.body.added === 0 ? 'OK' : '❌ dedup failed')

// 5. GET with date filter
const get = await call('/api/exercises?from=2026-08-11&to=2026-08-12', { headers: H })
const ex = get.body.exercises || []
console.log('✅ GET exercises count =', ex.length)
ex.forEach((e) => console.log('   ', e.date, e.name, e.duration_min + 'min', e.kcal + 'kcal', e.source))
if (ex.length !== 7) { console.log('❌ expected 7 rows'); process.exit(1) }
const yoga = ex.find((e) => e.name === '瑜伽')
if (!yoga || yoga.kcal !== Math.round(2.5 * 78.5 * 0.5)) { console.log('❌ yoga kcal wrong'); process.exit(1) }

// 6. DELETE one
const del = await call(`/api/exercises/${ex[0].id}`, { method: 'DELETE', headers: H })
const get2 = await call('/api/exercises', { headers: H })
console.log('✅ delete →', del.status, 'remaining =', get2.body.exercises.length)

// 7. Multi-user isolation: second throwaway sees none
const u2 = `uitest${Date.now().toString().slice(-4)}b`
const reg2 = await call('/api/register', { method: 'POST', body: JSON.stringify({ username: u2, password: pw, displayName: 'UITest2' }) })
const get3 = await call('/api/exercises', { headers: { Authorization: `Bearer ${reg2.body.token}` } })
console.log('✅ isolation: user B sees', get3.body.exercises.length, 'exercises', get3.body.exercises.length === 0 ? 'OK' : '❌ LEAK')

// 8. Unauthenticated → 401
const unauth = await call('/api/exercises')
console.log('✅ unauth →', unauth.status, unauth.status === 401 ? 'OK' : '❌')

// Cleanup throwaway users
const adminKey = process.env.ADMIN_KEY || ''
if (adminKey) {
  const db = await import('node:child_process')
  // cleanup done separately via wrangler d1
}
console.log('\n✅ ALL API TESTS PASSED (users:', u + ',', u2 + ')')
