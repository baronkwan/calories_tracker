#!/usr/bin/env node
/**
 * Push public/diet-data.json days into the calorie-api Worker as BK (admin, user 1).
 * Run after `npm run sync` (autosync.sh does both).
 * Usage: node scripts/push.mjs [baseUrl]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ADMIN_KEY comes from the environment — autosync.sh sources .env before running.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, '..', 'public', 'diet-data.json')
const BASE = process.argv[2] || 'https://calorie-api.baronjetso.workers.dev'

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
const dates = Object.keys(data.days).sort()

let ok = 0
for (const date of dates) {
  const day = data.days[date]
  const res = await fetch(`${BASE}/api/admin/day/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': process.env.ADMIN_KEY },
    body: JSON.stringify({ meals: day.meals, total: day.total }),
  })
  if (!res.ok) {
    console.error(`❌ push ${date} failed: ${res.status} ${await res.text()}`)
    process.exit(1)
  }
  ok++
}
console.log(`✅ Pushed ${ok} day(s) → ${BASE} (BK)`)

// Shared food catalog (idempotent replace)
if (Array.isArray(data.foods) && data.foods.length) {
  const res = await fetch(`${BASE}/api/admin/foods`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': process.env.ADMIN_KEY },
    body: JSON.stringify({ foods: data.foods }),
  })
  if (!res.ok) {
    console.error(`❌ push foods failed: ${res.status} ${await res.text()}`)
    process.exit(1)
  }
  console.log(`✅ Pushed ${data.foods.length} foods → ${BASE}`)
}
