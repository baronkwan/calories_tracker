#!/usr/bin/env node
// Try image variants against local dev /api/vision
import zlib from 'node:zlib'
const BASE = 'http://127.0.0.1:8790'
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
// Gradient-ish PNG (varies per row) — more realistic than solid
function makePng(w, h, gradient = false) {
  const stride = w * 3 + 1
  const raw = Buffer.alloc(stride * h)
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0
    for (let x = 0; x < w; x++) {
      const i = y * stride + 1 + x * 3
      if (gradient) { raw[i] = (x * 255 / w) | 0; raw[i + 1] = (y * 255 / h) | 0; raw[i + 2] = 120 }
      else { raw[i] = 230; raw[i + 1] = 120; raw[i + 2] = 40 }
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}

const login = await (await fetch(`${BASE}/api/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'bk', password: pw }),
})).json()
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` }

const variants = [
  ['512 solid', makePng(512, 512, false)],
  ['512 gradient', makePng(512, 512, true)],
  ['1024 gradient', makePng(1024, 768, true)],
]
for (const [label, png] of variants) {
  const withPrefix = `data:image/png;base64,${png.toString('base64')}`
  const t0 = Date.now()
  const res = await fetch(`${BASE}/api/vision`, {
    method: 'POST', headers: h,
    body: JSON.stringify({ imageBase64: withPrefix, text: '一碗白飯配蒸魚' }),
  })
  const body = await res.json()
  console.log(`${label}: ${res.status} (${Date.now() - t0}ms) → ${JSON.stringify(body).slice(0, 220)}`)
}
