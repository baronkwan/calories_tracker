#!/usr/bin/env node
/**
 * Calorie Dashboard — wiki → JSON sync
 * Reads ~/wiki/general/health/diet/YYYY-MM-DD.md daily logs and
 * ~/wiki/general/health/entities/food-calorie-reference.md, compiles
 * public/diet-data.json for the dashboard (kcal + P/C/F macros).
 *
 * Run: npm run sync   (after every wiki update)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WIKI_ROOT = path.join(process.env.HOME, 'wiki', 'general', 'health')
const WIKI_DIR = path.join(WIKI_ROOT, 'diet')
const REF_FILE = path.join(WIKI_ROOT, 'entities', 'food-calorie-reference.md')
const OUT_DIR = path.join(__dirname, '..', 'public')
const OUT_FILE = path.join(OUT_DIR, 'diet-data.json')

const DEFAULT_BUDGET = 2073 // fallback; app overrides from user profile

function parseNum(str) {
  if (!str) return 0
  const m = String(str).replace(/,/g, '').match(/(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : 0
}

/** Parse the food reference table into { name: { kcal, p, c, f, portion } } */
function parseReference(filePath) {
  const map = {}
  if (!fs.existsSync(filePath)) return map
  const raw = fs.readFileSync(filePath, 'utf8')
  for (const line of raw.split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line.split('|').map((c) => c.trim()).filter((c) => c !== '')
    if (cells.length < 4) continue
    if (cells[0].includes('食物') || cells[0].replace(/[-:]/g, '').trim() === '') continue
    if (cells[0].startsWith('**')) continue
    const name = cells[0]
    const kcal = parseNum(cells[2])
    const p = parseNum(cells[3])
    const c = parseNum(cells[4])
    const f = parseNum(cells[5])
    if (kcal > 0 || p + c + f > 0) map[name] = { kcal, p, c, f, portion: cells[1] }
  }
  return map
}

/** Scale macros by the logged portion vs reference portion.
 *  count units (隻/個/杯/碗…) → leading number, 半 → 0.5
 *  weight/volume (g/ml) → ratio to reference portion number
 */
function portionMultiplier(portion, refPortion) {
  const s = (portion || '').trim()
  if (!s) return 1
  const numMatch = s.match(/^(\d+(?:\.\d+)?)/)
  const fracMatch = s.match(/^(\d+)\s*\/\s*(\d+)/)
  const half = s.startsWith('半') ? 0.5 : 1
  let mult = 1
  if (fracMatch) {
    mult = parseFloat(fracMatch[1]) / parseFloat(fracMatch[2])
  } else if (/[gml]$/i.test(s) && refPortion) {
    const rNum = String(refPortion).match(/(\d+(?:\.\d+)?)\s*(?:g|ml)/i)
    if (numMatch && rNum) mult = parseFloat(numMatch[1]) / parseFloat(rNum[1])
    else mult = half
  } else if (numMatch) {
    mult = parseFloat(numMatch[1]) * half
  } else {
    mult = half
  }
  return mult > 0 ? mult : 1
}

/** Longest common substring length (names are short, O(n·m) fine) */
function lcsLen(a, b) {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  let best = 0
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
        if (dp[i][j] > best) best = dp[i][j]
      }
    }
  }
  return best
}

/** Find reference entry by fuzzy name match:
 *  exact → substring → best LCS score (≥2 chars & ≥35% of shorter name) */
function lookup(refMap, name) {
  if (refMap[name]) return refMap[name]
  let best = null
  let bestScore = 0
  for (const [key, v] of Object.entries(refMap)) {
    if (!key || !name) continue
    if (name.includes(key) || key.includes(name)) return v
    const lcs = lcsLen(name, key)
    const minLen = Math.min(name.length, key.length)
    if (lcs >= 2 && minLen > 0 && lcs / minLen >= 0.35 && lcs > bestScore) {
      bestScore = lcs
      best = v
    }
  }
  return best
}

function parseDayFile(filePath, refMap) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const lines = raw.split('\n')
  const date = path.basename(filePath, '.md')
  const meals = []
  let currentMeal = null

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)/)
    if (heading) {
      const label = heading[1].replace(/\s*（.+?）\s*$/, '').trim()
      if (!label.includes('小計') && !label.includes('狀態')) {
        currentMeal = { name: label, items: [], total: 0 }
        meals.push(currentMeal)
      } else {
        currentMeal = null
      }
      continue
    }
    if (!currentMeal) continue
    if (!line.startsWith('|')) continue
    const cells = line.split('|').map((c) => c.trim()).filter((c) => c !== '')
    if (cells.length < 3) continue
    if (cells[0].includes('食物') && cells[1].includes('份量')) continue
    if (cells[0].replace(/[-:]/g, '').trim() === '') continue
    if (cells[0].startsWith('**')) continue
    if (cells[0] === '_未記錄_') continue
    const kcal = parseNum(cells[cells.length - 1])
    if (kcal === 0) continue
    const item = { name: cells[0], portion: cells[1], kcal }
    // Enrich with macros from reference (kcal stays authoritative from the log)
    const ref = lookup(refMap, item.name)
    if (ref) {
      const mult = portionMultiplier(item.portion, ref.portion)
      item.p = ref.p * mult
      item.c = ref.c * mult
      item.f = ref.f * mult
    }
    currentMeal.items.push(item)
    currentMeal.total += kcal
  }

  const total = meals.reduce((sum, m) => sum + m.total, 0)
  const subtotalMatch = raw.match(/\|\s*總攝入\s*\|\s*(\d[\d,.]*)\s*\|/)
  const sourceTotal = subtotalMatch ? parseNum(subtotalMatch[1]) : total

  return {
    date,
    meals: meals.filter((m) => m.items.length > 0),
    total: sourceTotal || total,
  }
}

function main() {
  if (!fs.existsSync(WIKI_DIR)) {
    console.error(`Wiki diet dir not found: ${WIKI_DIR}`)
    process.exit(1)
  }
  const refMap = parseReference(REF_FILE)
  console.log(`Reference table: ${Object.keys(refMap).length} foods`)

  const files = fs.readdirSync(WIKI_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()

  const days = {}
  for (const f of files) {
    const day = parseDayFile(path.join(WIKI_DIR, f), refMap)
    if (day.meals.length > 0 || day.total > 0) days[day.date] = day
  }

  const data = {
    budget: DEFAULT_BUDGET,
    generatedAt: new Date().toISOString(),
    days,
    foods: Object.entries(refMap).map(([name, v]) => ({
      name, portion: v.portion, kcal: v.kcal, p: v.p, c: v.c, f: v.f,
    })),
  }

  // No-change detection: skip write+push when JSON content is identical
  const newJson = JSON.stringify(data)
  if (fs.existsSync(OUT_FILE) && fs.readFileSync(OUT_FILE, 'utf8') === newJson) {
    console.log('✅ No change — JSON identical')
    return
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(OUT_FILE, newJson)
  const dayCount = Object.keys(days).length
  console.log(`✅ Synced ${dayCount} day(s) → public/diet-data.json`)
  for (const d of Object.values(days)) {
    const macros = d.meals.flatMap((m) => m.items).reduce(
      (acc, it) => ({ p: acc.p + (it.p || 0), c: acc.c + (it.c || 0), f: acc.f + (it.f || 0) }),
      { p: 0, c: 0, f: 0 }
    )
    console.log(
      `   ${d.date}: ${d.total} kcal | P ${Math.round(macros.p)}g / C ${Math.round(macros.c)}g / F ${Math.round(macros.f)}g`
    )
  }
}

main()
