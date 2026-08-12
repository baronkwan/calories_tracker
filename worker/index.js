/**
 * Calorie Dashboard API v2 — Cloudflare Worker + D1 (multi-user)
 * JWT auth (jose HS256, 7d) + bcryptjs passwords. Admin key maps to BK (user_id = 1)
 * for the wiki ↔ D1 sync pipeline. Other users are D1-only.
 *
 * Public:
 *   POST /api/register  { username, password, displayName } → { token, user }
 *   POST /api/login     { username, password }              → { token, user }
 *
 * Auth (Bearer JWT):
 *   GET  /api/me
 *   GET  /api/days                    → own days
 *   PUT  /api/day/:date               → own day upsert
 *   GET  /api/profile                 → own profile
 *   PUT  /api/profile                 → own profile upsert
 *   GET  /api/weight                  → own weights
 *   PUT  /api/weight                  → own weight upsert
 *   PUT  /api/password                → change password
 *   GET  /api/exercises               → own exercise log (optional ?from=&to=)
 *   POST /api/exercises               → add manual exercise { date, type, durationMin, kcal? }
 *   DELETE /api/exercises/:id         → delete own exercise
 *   POST /api/exercises/import        → batch Apple Health workouts { items: [{type,startDate,endDate,duration,date}] }
 *
 * Admin (x-admin-key == ADMIN_KEY → acts as user 1 / BK):
 *   GET  /api/admin/days / PUT /api/admin/day/:date
 *   GET  /api/admin/profile / PUT /api/admin/profile
 *   GET  /api/admin/weight / PUT /api/admin/weight
 */
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'

const ADMIN_USER_ID = 1
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-admin-key',
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...CORS } })
}
const error = (msg, status = 400) => json({ error: msg }, status)

async function hashPassword(pw) { return bcrypt.hash(pw, 10) }
async function verifyPassword(pw, hash) { return bcrypt.compare(pw, hash) }

async function createToken(username, uid, secret) {
  const key = new TextEncoder().encode(secret)
  return await new SignJWT({ sub: username, uid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key)
}

async function verifyToken(token, secret) {
  try {
    const key = new TextEncoder().encode(secret)
    const { payload } = await jwtVerify(token, key)
    return { username: payload.sub, uid: payload.uid ?? null }
  } catch {
    return null
  }
}

async function requireAuth(req, env) {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.slice(7), env.JWT_SECRET)
}

// Admin key acts as BK (user 1). Returns uid or null.
function adminUid(req, env) {
  return req.headers.get('x-admin-key') === env.ADMIN_KEY ? ADMIN_USER_ID : null
}

async function resolveUid(env, auth) {
  if (auth.uid != null) return auth.uid
  const row = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(auth.username).first()
  return row?.id ?? null
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method
    const db = env.DB

    try {
      // ---- Public: register / login ----
      if (method === 'POST' && path === '/api/register') {
        const body = await request.json()
        const username = String(body.username || '').trim().toLowerCase()
        const password = String(body.password || '')
        const displayName = String(body.displayName || '').trim()
        if (!/^[a-z0-9_.-]{3,20}$/.test(username)) return error('用戶名需 3-20 位英數')
        if (password.length < 6) return error('密碼至少 6 位')
        const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
        if (existing) return error('用戶名已存在', 409)
        const hash = await hashPassword(password)
        const res = await db
          .prepare('INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)')
          .bind(username, displayName, hash)
          .run()
        const uid = res.meta.last_row_id
        const token = await createToken(username, uid, env.JWT_SECRET)
        return json({ token, user: { id: uid, username, displayName } })
      }

      if (method === 'POST' && path === '/api/login') {
        const body = await request.json()
        const username = String(body.username || '').trim().toLowerCase()
        const password = String(body.password || '')
        const row = await db.prepare('SELECT id, username, display_name, password_hash FROM users WHERE username = ?').bind(username).first()
        if (!row || !(await verifyPassword(password, row.password_hash))) return error('用戶名或密碼錯誤', 401)
        const token = await createToken(row.username, row.id, env.JWT_SECRET)
        return json({ token, user: { id: row.id, username: row.username, displayName: row.display_name } })
      }

      // ---- Auth: admin key (BK / user 1, sync pipeline) OR Bearer JWT ----
      const adminUid_ = adminUid(request, env)
      const auth = await requireAuth(request, env)
      const uid = adminUid_ != null ? adminUid_ : auth ? await resolveUid(env, auth) : null
      if (!uid) return error('需要登入', 401)

      // Admin path aliases (/api/admin/*) used by the wiki sync pipeline map to the same routes.
      const p = path.startsWith('/api/admin/') ? '/api/' + path.slice('/api/admin/'.length) : path

      // Admin-only: foods replace (users only GET the shared catalog).
      if (method === 'PUT' && path === '/api/admin/foods') {
        const body = await request.json()
        const foods = Array.isArray(body.foods) ? body.foods : []
        await db.prepare('DELETE FROM foods').run()
        if (foods.length) {
          const stmt = db.prepare('INSERT INTO foods (name, portion, kcal, p, c, f) VALUES (?, ?, ?, ?, ?, ?)')
          await db.batch(foods.map((f) => stmt.bind(f.name, f.portion || '', Number(f.kcal) || 0, Number(f.p) || 0, Number(f.c) || 0, Number(f.f) || 0)))
        }
        return json({ ok: true, count: foods.length })
      }

      if (method === 'GET' && p === '/api/me') {
        const row = await db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').bind(uid).first()
        return row ? json({ user: { id: row.id, username: row.username, displayName: row.display_name } }) : error('not found', 404)
      }

      if (method === 'GET' && p === '/api/days') {
        const rows = await db
          .prepare('SELECT date, total, meals_json, updated_at FROM daily_logs WHERE user_id = ? ORDER BY date')
          .bind(uid)
          .all()
        const days = {}
        for (const r of rows.results) days[r.date] = { date: r.date, meals: JSON.parse(r.meals_json), total: r.total, updated_at: r.updated_at }
        return json({ days })
      }

      const dayMatch = p.match(/^\/api\/day\/(\d{4}-\d{2}-\d{2})$/)
      if (method === 'PUT' && dayMatch) {
        const date = dayMatch[1]
        const body = await request.json()
        const meals = Array.isArray(body.meals) ? body.meals : []
        const total = Number(body.total) || meals.reduce((s, m) => s + (m.total || 0), 0)
        await upsertDay(db, uid, date, meals, total)
        return json({ ok: true, date, total })
      }

      if (method === 'DELETE' && dayMatch) {
        const date = dayMatch[1]
        await db.prepare('DELETE FROM daily_logs WHERE user_id = ? AND date = ?').bind(uid, date).run()
        return json({ ok: true, date })
      }

      if (method === 'GET' && p === '/api/profile') {
        const row = await db.prepare('SELECT profile_json FROM profile WHERE user_id = ?').bind(uid).first()
        return json({ profile: row ? JSON.parse(row.profile_json) : null })
      }

      if (method === 'PUT' && p === '/api/profile') {
        const body = await request.json()
        await db
          .prepare("INSERT INTO profile (user_id, profile_json, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET profile_json = excluded.profile_json, updated_at = excluded.updated_at")
          .bind(uid, JSON.stringify(body.profile || {}))
          .run()
        return json({ ok: true })
      }

      if (method === 'GET' && p === '/api/weight') {
        const rows = await db.prepare('SELECT date, kg FROM weight_log WHERE user_id = ? ORDER BY date').bind(uid).all()
        return json({ weights: rows.results })
      }

      if (method === 'GET' && p === '/api/foods') {
        const rows = await db.prepare('SELECT name, portion, kcal, p, c, f FROM foods ORDER BY name').all()
        return json({ foods: rows.results })
      }

      // ---- Vision: photo/text → food items + calories (Workers AI Gemma 4) ----
      if (method === 'POST' && p === '/api/vision') {
        const body = await request.json().catch(() => ({}))
        const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : ''
        const userText = typeof body.text === 'string' ? body.text.trim() : ''
        if (!imageBase64 && !userText) return error('需要相片或文字描述')

        // Ground estimates in the shared food catalog (from the wiki reference table)
        let ref = ''
        try {
          const rows = await db.prepare('SELECT name, portion, kcal FROM foods ORDER BY kcal DESC').all()
          ref = rows.results.map((f) => `${f.name}${f.portion ? ` ${f.portion}` : ''}=${f.kcal}kcal`).join('，').slice(0, 3000)
        } catch { /* catalog optional */ }

        const prompt = `你係一位香港註冊營養師。估算呢餐飯嘅卡路里。
${userText ? `用戶描述：${userText}\n` : ''}${imageBase64 ? '（請睇埋張相，列出具體食物同份量）' : ''}
食物庫參考（每份 kcal）：${ref || '（無）'}
只輸出一個 JSON object，唔好加任何其他文字、註解或 markdown：
{"description":"用一句廣東話總括呢餐","items":[{"name":"具體食物名","portion":"份量(碗/件/塊/片/半份)","kcal":數字}],"total":數字}
規則：份量用香港慣用單位；同一食物唔好拆開多行；庫內有嘅用庫嘅 kcal，冇嘅自己估；total = items 總和。`

        const messages = [{ role: 'user', content: [] }]
        if (imageBase64) messages[0].content.push({ type: 'image_url', image_url: { url: imageBase64 } })
        messages[0].content.push({ type: 'text', text: prompt })

        let raw = ''
        const extractText = (r) => {
          const v = r?.response ?? r?.output ?? r?.choices?.[0]?.message?.content ?? JSON.stringify(r)
          return typeof v === 'string' ? v : JSON.stringify(v)
        }
        try {
          const aiRes = await env.AI.run('@cf/google/gemma-4-26b-a4b-it', { messages })
          raw = extractText(aiRes)
        } catch (e) {
          return json({ error: `AI 服務暫時唔得：${e.message}` }, 502)
        }

        // Robust JSON extraction: strip code fences, find first { … last }
        let parsed = null
        const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
        const candidate = fenced ? fenced[1] : raw
        const start = candidate.indexOf('{')
        const end = candidate.lastIndexOf('}')
        if (start !== -1 && end > start) {
          try { parsed = JSON.parse(candidate.slice(start, end + 1)) } catch { /* fall through */ }
        }
        if (!parsed) return json({ error: '認唔到餐內容，試下再影/寫詳細啲' }, 422)

        const items = Array.isArray(parsed.items)
          ? parsed.items
              .filter((it) => it && typeof it.name === 'string' && Number.isFinite(Number(it.kcal)))
              .map((it) => ({ name: it.name, portion: it.portion || '1份', kcal: Math.max(0, Math.round(Number(it.kcal))) }))
          : []
        if (!items.length) return json({ error: '認唔到餐內容，試下再影/寫詳細啲' }, 422)
        const total = Math.max(0, Math.round(Number(parsed.total) || items.reduce((s, it) => s + it.kcal, 0)))
        return json({ ok: true, description: String(parsed.description || ''), items, total })
      }

      if (method === 'PUT' && p === '/api/weight') {
        const body = await request.json()
        const date = String(body.date || '')
        const kg = Number(body.kg)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(kg)) return error('invalid date or kg')
        await db
          .prepare("INSERT INTO weight_log (user_id, date, kg, created_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(user_id, date) DO UPDATE SET kg = excluded.kg, created_at = excluded.created_at")
          .bind(uid, date, kg)
          .run()
        return json({ ok: true })
      }

      if (method === 'PUT' && p === '/api/password') {
        const body = await request.json()
        const row = await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(uid).first()
        if (!row || !(await verifyPassword(String(body.oldPassword || ''), row.password_hash))) return error('舊密碼錯誤', 401)
        const newPw = String(body.newPassword || '')
        if (newPw.length < 6) return error('新密碼至少 6 位')
        const hash = await hashPassword(newPw)
        await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, uid).run()
        return json({ ok: true })
      }

      // ---- Exercises (manual + Apple Health import) ----
      if (method === 'GET' && p === '/api/exercises') {
        const u = new URL(request.url)
        const from = u.searchParams.get('from')
        const to = u.searchParams.get('to')
        let sql = 'SELECT id, date, type, name, duration_min, kcal, source FROM exercise_log WHERE user_id = ?'
        const params = [uid]
        if (from) { sql += ' AND date >= ?'; params.push(from) }
        if (to) { sql += ' AND date <= ?'; params.push(to) }
        sql += ' ORDER BY date DESC, id DESC'
        const rows = await db.prepare(sql).bind(...params).all()
        return json({ exercises: rows.results })
      }

      if (method === 'POST' && p === '/api/exercises') {
        const body = await request.json().catch(() => ({}))
        const date = String(body.date || '')
        const type = String(body.type || 'other')
        const durationMin = Number(body.durationMin)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error('invalid date')
        if (!Number.isFinite(durationMin) || durationMin <= 0) return error('時長必須大於 0 分鐘')
        const t = EXERCISE_MET[type]
        if (!t) return error('唔知嘅運動類型')
        const weight = await currentWeightKg(db, uid)
        // Custom kcal override allowed (e.g. 自訂運動) — otherwise MET estimate.
        const customKcal = Number(body.kcal)
        const kcal = Number.isFinite(customKcal) && customKcal > 0
          ? Math.round(customKcal)
          : calcExerciseKcal(t.met, weight, durationMin)
        const name = String(body.name || t.name).slice(0, 60)
        const res = await db
          .prepare("INSERT INTO exercise_log (user_id, date, type, name, duration_min, kcal, source) VALUES (?, ?, ?, ?, ?, ?, 'manual')")
          .bind(uid, date, type, name, durationMin, kcal)
          .run()
        return json({ ok: true, id: res.meta.last_row_id, kcal, weight })
      }

      const exDelete = p.match(/^\/api\/exercises\/(\d+)$/)
      if (method === 'DELETE' && exDelete) {
        await db.prepare('DELETE FROM exercise_log WHERE id = ? AND user_id = ?').bind(Number(exDelete[1]), uid).run()
        return json({ ok: true })
      }

      // Apple Health batch import (Shortcut → worker). Accepts both admin key
      // (BK's own iPhone shortcut) and Bearer JWT.
      if (method === 'POST' && p === '/api/exercises/import') {
        const body = await request.json().catch(() => ({}))
        const items = Array.isArray(body.items) ? body.items : []
        if (!items.length) return json({ ok: true, added: 0, kcal: 0, skipped: 0 })
        const weight = await currentWeightKg(db, uid)
        let added = 0, kcalSum = 0, skipped = 0
        for (const it of items) {
          const type = appleTypeToId(it.type)
          const t = EXERCISE_MET[type]
          // Apple Shortcuts gives duration in seconds; also accept durationMin.
          let durMin = Number(it.durationMin)
          if (!Number.isFinite(durMin) || durMin <= 0) durMin = Number(it.duration) / 60
          if (!Number.isFinite(durMin) || durMin <= 0) {
            const s = Date.parse(String(it.startDate || ''))
            const e = Date.parse(String(it.endDate || ''))
            if (Number.isFinite(s) && Number.isFinite(e) && e > s) durMin = (e - s) / 60000
          }
          if (!Number.isFinite(durMin) || durMin <= 0) { skipped++; continue }
          durMin = Math.round(durMin * 10) / 10
          // Local date: prefer explicit date, else first 10 chars of startDate (HK-local string).
          const dm = String(it.date || '').match(/^\d{4}-\d{2}-\d{2}$/)
          const date = dm ? String(it.date) : (String(it.startDate || '').match(/^(\d{4}-\d{2}-\d{2})/) || [])[1]
          if (!date) { skipped++; continue }
          const startIso = String(it.startDate || it.start_iso || '').slice(0, 64)
          if (startIso) {
            const dup = await db
              .prepare('SELECT id FROM exercise_log WHERE user_id = ? AND date = ? AND type = ? AND duration_min = ? AND start_iso = ?')
              .bind(uid, date, type, durMin, startIso)
              .first()
            if (dup) { skipped++; continue }
          }
          const kcal = calcExerciseKcal(t.met, weight, durMin)
          await db
            .prepare("INSERT INTO exercise_log (user_id, date, type, name, duration_min, kcal, source, start_iso) VALUES (?, ?, ?, ?, ?, ?, 'apple_health', ?)")
            .bind(uid, date, type, t.name, durMin, kcal, startIso)
            .run()
          added++
          kcalSum += kcal
        }
        return json({ ok: true, added, kcal: kcalSum, skipped, weight })
      }

      // ---- Admin routes handled above (before auth gate) ----

      return error('not found', 404)
    } catch (e) {
      return json({ error: e.message }, 500)
    }
  },
}

async function upsertDay(db, uid, date, meals, total) {
  await db
    .prepare("INSERT INTO daily_logs (user_id, date, total, meals_json, updated_at) VALUES (?, ?, ?, ?, datetime('now')) ON CONFLICT(user_id, date) DO UPDATE SET total = excluded.total, meals_json = excluded.meals_json, updated_at = excluded.updated_at")
    .bind(uid, date, total, JSON.stringify(meals))
    .run()
}

// ---- Exercise engine ----
// MET values from the Compendium of Physical Activities. MUST stay in sync with
// src/lib/exercises.js (EXERCISE_TYPES). Server is authoritative for stored kcal.
// kcal = MET × weight(kg) × hours  — the best practical estimate without a heart-rate strap.
const EXERCISE_TYPES = [
  { id: 'indoor_walk', name: '室內步行', met: 3.5 },
  { id: 'indoor_run', name: '室內跑步', met: 8.3 },
  { id: 'walk', name: '步行', met: 3.5 },
  { id: 'run', name: '跑步', met: 8.3 },
  { id: 'cycling', name: '單車', met: 6.8 },
  { id: 'swimming', name: '游泳', met: 5.8 },
  { id: 'hiking', name: '行山', met: 6.0 },
  { id: 'yoga', name: '瑜伽', met: 2.5 },
  { id: 'strength', name: '重量訓練', met: 3.5 },
  { id: 'elliptical', name: '橢圓機', met: 5.0 },
  { id: 'stair_stepper', name: '樓梯機', met: 6.0 },
  { id: 'rowing', name: '划船機', met: 7.0 },
  { id: 'dance', name: '跳舞', met: 5.0 },
  { id: 'pilates', name: '普拉提', met: 3.0 },
  { id: 'hiit', name: '高強度間歇', met: 8.0 },
  { id: 'tai_chi', name: '太極', met: 3.0 },
  { id: 'jump_rope', name: '跳繩', met: 11.0 },
  { id: 'basketball', name: '籃球', met: 6.5 },
  { id: 'badminton', name: '羽毛球', met: 5.5 },
  { id: 'football', name: '足球', met: 7.0 },
  { id: 'tennis', name: '網球', met: 7.3 },
  { id: 'table_tennis', name: '乒乓球', met: 4.0 },
  { id: 'golf', name: '高爾夫', met: 4.8 },
  { id: 'stairs', name: '行樓梯', met: 4.0 },
  { id: 'other', name: '運動', met: 4.0 },
]
const EXERCISE_MET = Object.fromEntries(EXERCISE_TYPES.map((t) => [t.id, t]))

// Apple Health HKWorkoutActivityType → our type id (substring match, case-insensitive).
const APPLE_HEALTH_MAP = [
  [/run/i, 'run'],
  [/walk/i, 'walk'],
  [/cycling|cycle|bike/i, 'cycling'],
  [/swim/i, 'swimming'],
  [/hike/i, 'hiking'],
  [/yoga/i, 'yoga'],
  [/strength|traditional/i, 'strength'],
  [/elliptical/i, 'elliptical'],
  [/stair/i, 'stair_stepper'],
  [/row/i, 'rowing'],
  [/dance/i, 'dance'],
  [/pilates/i, 'pilates'],
  [/highintensity|hiit/i, 'hiit'],
  [/tai ?chi/i, 'tai_chi'],
  [/jump ?rope/i, 'jump_rope'],
  [/basketball/i, 'basketball'],
  [/badminton/i, 'badminton'],
  [/soccer|football/i, 'football'],
  [/tennis/i, 'tennis'],
  [/table ?tennis|ping ?pong/i, 'table_tennis'],
  [/golf/i, 'golf'],
]

function appleTypeToId(typeStr) {
  const s = String(typeStr || '').replace(/^HKWorkoutActivityType/, '')
  for (const [re, id] of APPLE_HEALTH_MAP) if (re.test(s)) return id
  return 'other'
}

function calcExerciseKcal(met, weightKg, durationMin) {
  return Math.max(1, Math.round(met * weightKg * (durationMin / 60)))
}

// Best available weight: profile.weightKg → latest weight_log → 60 (neutral default).
async function currentWeightKg(db, uid) {
  try {
    const prof = await db.prepare('SELECT profile_json FROM profile WHERE user_id = ?').bind(uid).first()
    if (prof) {
      const p = JSON.parse(prof.profile_json || '{}')
      if (Number.isFinite(Number(p.weightKg)) && Number(p.weightKg) > 0) return Number(p.weightKg)
    }
    const w = await db.prepare('SELECT kg FROM weight_log WHERE user_id = ? ORDER BY date DESC LIMIT 1').bind(uid).first()
    if (w && Number.isFinite(Number(w.kg)) && Number(w.kg) > 0) return Number(w.kg)
  } catch { /* fall through */ }
  return 60
}
