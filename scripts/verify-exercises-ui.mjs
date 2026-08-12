// Headless UI verification for calorie-dashboard exercise feature.
// Direct WS connection to the page target (no session juggling).
// Seed: throwaway user via deployed API + food day + 2 exercises → check DOM.

const API = 'https://calorie-api.baronjetso.workers.dev'
const APP = 'http://localhost:4173/'
const PORT = 9340

// --- 1. Seed throwaway user + data via deployed API ---
const suffix = Date.now().toString(36)
const username = `uitest${suffix}`
const password = 'test1234'
const reg = await fetch(`${API}/api/register`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password, displayName: 'UI Test' }),
}).then((r) => r.json())
const token = reg.token

const today = new Date()
const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

await fetch(`${API}/api/day/${dateKey}`, {
  method: 'PUT', headers: H,
  body: JSON.stringify({ meals: [{ name: '早餐', items: [{ name: '麵包', portion: '2片', kcal: 500 }], total: 500 }, { name: '午餐', items: [{ name: '雞胸飯', portion: '1盒', kcal: 700 }], total: 700 }], total: 1200 }),
})
await fetch(`${API}/api/exercises`, { method: 'POST', headers: H, body: JSON.stringify({ date: dateKey, type: 'indoor_walk', durationMin: 30 }) })
await fetch(`${API}/api/exercises`, { method: 'POST', headers: H, body: JSON.stringify({ date: dateKey, type: 'indoor_run', durationMin: 20 }) })
console.log('seeded', username, dateKey)

// --- 2. Launch headless shell pointed at the app ---
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const shells = fs.readdirSync(process.env.HOME + '/Library/Caches/ms-playwright/').filter((d) => d.startsWith('chromium_headless_shell'))
if (!shells.length) { console.log('❌ no headless shell'); process.exit(1) }
const SHELL = `${process.env.HOME}/Library/Caches/ms-playwright/${shells.sort().pop()}/chrome-headless-shell-mac-arm64/chrome-headless-shell`
const profile = `/tmp/cd-shot-${suffix}`
const chrome = spawn(SHELL, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--window-size=430,932', APP], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2000))

// --- 3. Direct WS to the page target ---
const targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json())
const page = targets.find((t) => t.type === 'page' && t.url.includes('localhost:4173')) || targets.find((t) => t.type === 'page')
if (!page) { console.log('❌ no page target', targets.map((t) => t.type + ':' + t.url).join(' | ')); chrome.kill(); process.exit(1) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
let seq = 0
const pending = new Map()
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (method, params = {}) => new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })) })
await new Promise((r) => { ws.onopen = r })
await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true })

// --- 4. Seed token then reload ---
await new Promise((r) => setTimeout(r, 2500))
await send('Runtime.evaluate', { expression: `localStorage.setItem('cd-token', '${token}'); localStorage.setItem('cd-theme','light')`, returnByValue: true })
await send('Page.reload')
await new Promise((r) => setTimeout(r, 3500))

const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.error) return `CDP_ERROR: ${r.error.message}`
  if (r.result?.exceptionDetails) return `EXC: ${r.result.exceptionDetails.text}`
  return r.result?.result?.value
}

// --- 5. Assertions (Today tab) ---
const checks = []
const body0 = await ev(`document.body.innerText`)
checks.push(['app rendered (not login)', typeof body0 === 'string' && body0.includes('今日'), body0?.slice(0, 80)])

const heroCells = await ev(`[...document.querySelectorAll('.group-list .grid.text-center > div')].map(d => d.innerText)`)
checks.push(['hero has 4 stat cells', Array.isArray(heroCells) && heroCells.length === 4, heroCells])
const burnCell = Array.isArray(heroCells) ? heroCells.find((c) => c.includes('運動消耗')) : null
const burnKcal = burnCell ? parseInt(burnCell.split('\n')[0].replace(/,/g, '')) : null
checks.push(['hero 運動消耗 = 271 kcal', burnKcal === 271, burnCell])
const remainCell = Array.isArray(heroCells) ? heroCells.find((c) => c.includes('淨剩餘') || c.includes('淨超出')) : null
checks.push(['hero 淨剩餘 present', remainCell !== null, remainCell])

const exText = await ev(`document.body.innerText`)
checks.push(['運動明細 section', typeof exText === 'string' && exText.includes('運動明細')])
checks.push(['indoor walk listed + 30 分鐘', typeof exText === 'string' && exText.includes('室內步行') && exText.includes('30 分鐘')])
checks.push(['indoor run listed + 20 分鐘', typeof exText === 'string' && exText.includes('室內跑步') && exText.includes('20 分鐘')])

const shot1 = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
fs.writeFileSync(`/tmp/cd-today.png`, Buffer.from(shot1.result.data, 'base64'))

// --- 6. Daily tab buttons ---
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent?.includes('日記'))?.click()`)
await new Promise((r) => setTimeout(r, 900))
const dailyBtns = await ev(`[...document.querySelectorAll('button')].map(b => b.textContent?.trim()).filter(t => t && (t.includes('新增食物') || t.includes('影相記錄') || t.includes('新增運動')))`)
checks.push(['daily tab has 3 add buttons', Array.isArray(dailyBtns) && dailyBtns.length === 3, dailyBtns])

// --- 7. Weekly tab: 運動消耗 + 淨攝入 ---
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent?.includes('週報'))?.click()`)
await new Promise((r) => setTimeout(r, 900))
const weeklyText = await ev(`document.body.innerText`)
checks.push(['weekly 運動消耗 271', typeof weeklyText === 'string' && /運動消耗\s*\/\s*7日/.test(weeklyText) && weeklyText.includes('271'), weeklyText?.slice(0, 120)])
checks.push(['weekly 淨攝入 label', typeof weeklyText === 'string' && weeklyText.includes('淨攝入（食物 − 運動）')])
const shot2 = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
fs.writeFileSync(`/tmp/cd-weekly.png`, Buffer.from(shot2.result.data, 'base64'))

// --- 8. Monthly tab: 月運動消耗 ---
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent?.includes('月報'))?.click()`)
await new Promise((r) => setTimeout(r, 900))
const monthlyText = await ev(`document.body.innerText`)
checks.push(['monthly 月運動消耗 271', typeof monthlyText === 'string' && monthlyText.includes('月運動消耗') && monthlyText.includes('271')])

// --- 9. Add exercise sheet opens ---
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent?.includes('日記'))?.click()`)
await new Promise((r) => setTimeout(r, 700))
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent?.includes('新增運動'))?.click()`)
await new Promise((r) => setTimeout(r, 900))
const sheetText = await ev(`document.body.innerText`)
checks.push(['sheet opens (MET + 預估消耗)', typeof sheetText === 'string' && sheetText.includes('MET') && sheetText.includes('預估消耗')])
checks.push(['sheet Apple hint', typeof sheetText === 'string' && sheetText.includes('Apple 健康')])
const shot3 = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
fs.writeFileSync(`/tmp/cd-sheet.png`, Buffer.from(shot3.result.data, 'base64'))

// --- Results ---
console.log('\n===== CHECKS =====')
let pass = 0
for (const [name, ok, extra] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}${extra !== undefined ? ' — ' + JSON.stringify(extra).slice(0, 160) : ''}`)
  if (ok) pass++
}
console.log(`\n${pass}/${checks.length} passed`)

// Cleanup (API-side; D1 user cleanup via wrangler separately)
await fetch(`${API}/api/day/${dateKey}`, { method: 'DELETE', headers: H }).catch(() => {})
chrome.kill()
console.log('USERS_TO_CLEAN:', username)
process.exit(pass === checks.length ? 0 : 1)
