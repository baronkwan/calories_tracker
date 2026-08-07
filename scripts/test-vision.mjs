#!/usr/bin/env node
// Test /api/vision: text-only + generated image paths.
import zlib from 'node:zlib'
const BASE = 'https://calorie-api.baronjetso.workers.dev'
const pw = process.env.BK_PASSWORD

function crc32(buf) {
  let c, table = []
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0 }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type)
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}
// 64x64 solid orange PNG (simulates a food-ish image)
function solidPng(w, h, r, g, b) {
  const stride = w * 3 + 1
  const raw = Buffer.alloc(stride * h)
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0
    for (let x = 0; x < w; x++) { raw[y * stride + 1 + x * 3] = r; raw[y * stride + 2 + x * 3] = g; raw[y * stride + 3 + x * 3] = b }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 2 // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const login = await (await fetch(`${BASE}/api/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'bk', password: pw }),
})).json()

// 1. Text-only
const t0 = Date.now()
const textRes = await fetch(`${BASE}/api/vision`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` },
  body: JSON.stringify({ text: '一碗雲吞麵加一碟蠔油生菜，仲有半杯凍檸茶少甜' }),
})
const textBody = await textRes.json()
console.log(`text-only: ${textRes.status} (${Date.now() - t0}ms)`)
console.log(JSON.stringify(textBody, null, 2).slice(0, 600))

// 2. Image (solid PNG as placeholder)
const png = solidPng(128, 128, 230, 120, 40)
const imageBase64 = `data:image/png;base64,${png.toString('base64')}`
const t1 = Date.now()
const imgRes = await fetch(`${BASE}/api/vision`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` },
  body: JSON.stringify({ imageBase64, text: '一碗飯配雞肉' }),
})
const imgBody = await imgRes.json()
console.log(`image: ${imgRes.status} (${Date.now() - t1}ms)`)
console.log(JSON.stringify(imgBody, null, 2).slice(0, 600))
