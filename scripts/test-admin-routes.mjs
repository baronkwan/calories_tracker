// Verify admin routes (/api/admin/*) still work after the unified-auth refactor.
// Non-destructive: uses a far-future test date, and foods PUT restores the current catalog.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
const ADMIN_KEY = env.match(/^ADMIN_KEY=(.*)$/m)?.[1]
const BASE = 'https://calorie-api.baronjetso.workers.dev'
const TEST_DATE = '2099-01-01'
const H = { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY }

const call = async (p, opts = {}) => {
  const res = await fetch(`${BASE}${p}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

let pass = 0, fail = 0
const check = (name, ok, extra) => { console.log(`${ok ? '✅' : '❌'} ${name}${extra !== undefined ? ' — ' + JSON.stringify(extra).slice(0, 120) : ''}`); ok ? pass++ : fail++ }

// 1. PUT a test day via /api/admin/day/:date (normalized to user route, uid=1)
const put = await call(`/api/admin/day/${TEST_DATE}`, { method: 'PUT', body: JSON.stringify({ meals: [{ name: '早餐', items: [{ name: '測試', portion: '1份', kcal: 100 }], total: 100 }], total: 100 }) })
check('admin PUT day → ok', put.status === 200 && put.body.ok === true, put.body)

// 2. GET /api/admin/days contains it
const days = await call('/api/admin/days')
check('admin GET days contains test date', days.status === 200 && !!days.body.days?.[TEST_DATE], Object.keys(days.body.days || {}).length + ' days')

// 3. GET /api/admin/profile (read-only)
const prof = await call('/api/admin/profile')
check('admin GET profile', prof.status === 200)

// 4. GET /api/admin/weight (read-only)
const w = await call('/api/admin/weight')
check('admin GET weight', w.status === 200 && Array.isArray(w.body.weights))

// 5. foods PUT restores the catalog (idempotent — fetch then PUT back)
const foods = await call('/api/foods')
const foodPut = await call('/api/admin/foods', { method: 'PUT', body: JSON.stringify({ foods: foods.body.foods || [] }) })
const foods2 = await call('/api/foods')
check('admin PUT foods (restore) count matches', foodPut.status === 200 && foodPut.body.count === (foods.body.foods || []).length, `${foodPut.body.count} foods`)

// 6. DELETE the test day via /api/admin/day/:date (normalized DELETE)
const del = await call(`/api/admin/day/${TEST_DATE}`, { method: 'DELETE' })
const days2 = await call('/api/admin/days')
check('admin DELETE test day', del.status === 200 && !days2.body.days?.[TEST_DATE])

// 7. Unauthenticated admin key → 401
const noAuth = await fetch(`${BASE}/api/admin/days`, { headers: { 'Content-Type': 'application/json' } })
check('admin without key → 401', noAuth.status === 401)

console.log(`\n${pass}/${pass + fail} admin checks passed`)
process.exit(fail ? 1 : 0)
