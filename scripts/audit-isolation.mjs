#!/usr/bin/env node
// Throwaway-user isolation audit: A writes, B must NOT see it.
const API = 'https://calorie-api.baronjetso.workers.dev'
const TS = Date.now().toString(36)
const UA = `audit_a_${TS}`, UB = `audit_b_${TS}`
const PW = 'test1234'
const j = (r) => r.json()
const post = (p, body) => fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(j)
const put = (p, body, tok) => fetch(API + p, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify(body) }).then(j)
const get = (p, tok) => fetch(API + p, { headers: { Authorization: `Bearer ${tok}` } }).then(j)

;(async () => {
  const ra = await post('/api/register', { username: UA, password: PW, displayName: 'AuditA' })
  const rb = await post('/api/register', { username: UB, password: PW, displayName: 'AuditB' })
  console.log('1. registered A:', !!ra.token, 'B:', !!rb.token)
  if (!ra.token || !rb.token) { console.log('FAIL register', ra, rb); process.exit(1) }

  await put('/api/day/2026-08-07', { meals: [{ name: '早餐', items: [{ name: 'SECRET-MARKER-餐', kcal: 999 }], total: 999 }], total: 999 }, ra.token)
  console.log('2. A wrote day with SECRET-MARKER')

  const bd = await get('/api/days', rb.token)
  const bKeys = Object.keys(bd.days || {})
  console.log('3. B days:', bKeys.length ? bKeys.join(',') : 'EMPTY', bKeys.length === 0 ? '✓ ISOLATED' : '✗ LEAK!')

  const bp = await get('/api/profile', rb.token)
  const bw = await get('/api/weight', rb.token)
  console.log('4. B profile:', JSON.stringify(bp.profile), '| B weight:', JSON.stringify(bw.weights || []))
  console.log('   profile null?', bp.profile === null || bp.profile === undefined ? '✓' : '✗', '| weight empty?', !(bw.weights && bw.weights.length) ? '✓' : '✗')

  const ad = await get('/api/days', ra.token)
  const aMeal = ad.days?.['2026-08-07']?.meals?.[0]?.items?.[0]?.name
  console.log('5. A sees own meal:', aMeal, aMeal === 'SECRET-MARKER-餐' ? '✓' : '✗')

  // Foods catalog — shared reference table? Check if B sees foods (intentional global ref)
  const bf = await get('/api/foods', rb.token)
  console.log('6. B foods count:', (bf.foods || []).length, '(shared catalog — intentional, not user data)')

  // Cleanup: delete throwaway users via admin key (need ADMIN_KEY env)
  const adminKey = process.env.ADMIN_KEY
  if (adminKey) {
    // There's no delete-user admin route; we clean up directly via D1 after this.
    console.log('NOTE: users need D1 cleanup:', UA, UB)
  }
})().catch((e) => { console.error('ERROR', e.message); process.exit(1) })
