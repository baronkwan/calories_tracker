#!/usr/bin/env node
/**
 * Reverse sync: D1 (BK, user 1) → wiki markdown.
 * If BK edits a day in the dashboard, this regenerates the wiki day file so the
 * wiki stays the human-readable mirror. Content-compare first (skips unchanged).
 * Usage: node scripts/pull.mjs [baseUrl]   (requires ADMIN_KEY in env)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WIKI_DIR = path.join(process.env.HOME, 'wiki', 'general', 'health', 'diet')
const BASE = process.argv[2] || 'https://calorie-api.baronjetso.workers.dev'

const NOTE_HEADING = '## 備註'

/** Carry over the hand-written 備註 block so the hourly D1→wiki pull can't wipe it. */
function extractNotes(filePath) {
  if (!fs.existsSync(filePath)) return ''
  const raw = fs.readFileSync(filePath, 'utf8')
  const idx = raw.indexOf(NOTE_HEADING)
  return idx === -1 ? '' : raw.slice(idx).trimEnd()
}

function fmtDayFile(date, meals, total, notes = '') {
  const lines = [
    '---',
    `title: 飲食記錄 ${date}`,
    `created: ${date}`,
    `updated: ${date}`,
    'domain: general',
    'type: summary',
    'tags: [health, nutrition, record]',
    'sources: []',
    '---',
    '',
    `# 飲食記錄 ${date}`,
    '',
    '- 預算: 2073 kcal (TDEE 維持線)',
    `- 總攝入: ${total} kcal`,
    '',
  ]
  for (const meal of meals) {
    lines.push(`## ${meal.name}`, '', '| 食物 | 份量 | kcal |', '|------|------|------|')
    for (const it of meal.items) {
      lines.push(`| ${it.name} | ${it.portion || '1'} | ${it.kcal} |`)
    }
    lines.push(`| **小計** | | **${meal.total}** |`, '')
  }
  lines.push('## 小計', '', '| 項目 | kcal |', '|------|------|', `| 總攝入 | ${total} |`, '| 預算 | 2073 |', `| 剩餘 | ${2073 - total} |`, '| 狀態 | 自動同步 |')
  if (notes) lines.push('', notes)
  return lines.join('\n') + '\n'
}

// Parse current wiki day into a comparable signature
function wikiSignature(filePath) {
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf8')
  const items = []
  for (const line of raw.split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line.split('|').map((c) => c.trim()).filter((c) => c !== '')
    if (cells.length >= 3 && !cells[0].includes('食物') && !cells[0].startsWith('**') && cells[0] !== '_未記錄_' && !/^[-:]+$/.test(cells[0])) {
      items.push(`${cells[0]}|${cells[1]}|${cells[2]}`)
    }
  }
  return items.join('\n')
}

const res = await fetch(`${BASE}/api/admin/days`, {
  headers: { 'x-admin-key': process.env.ADMIN_KEY },
})
if (!res.ok) {
  console.error(`❌ pull failed: ${res.status}`)
  process.exit(1)
}
const { days } = await res.json()
fs.mkdirSync(WIKI_DIR, { recursive: true })

let updated = 0
for (const [date, day] of Object.entries(days).sort()) {
  const filePath = path.join(WIKI_DIR, `${date}.md`)
  const newContent = fmtDayFile(date, day.meals, day.total, extractNotes(filePath))
  if (wikiSignature(filePath) !== wikiSignatureFromContent(newContent)) {
    fs.writeFileSync(filePath, newContent)
    updated++
    console.log(`   ↻ wiki ${date} updated from D1`)
  }
}
console.log(`✅ Pull done: ${updated} day(s) synced D1 → wiki`)
process.exit(0)

function wikiSignatureFromContent(content) {
  const items = []
  for (const line of content.split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line.split('|').map((c) => c.trim()).filter((c) => c !== '')
    if (cells.length >= 3 && !cells[0].includes('食物') && !cells[0].startsWith('**') && cells[0] !== '_未記錄_' && !/^[-:]+$/.test(cells[0])) {
      items.push(`${cells[0]}|${cells[1]}|${cells[2]}`)
    }
  }
  return items.join('\n')
}
