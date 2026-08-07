#!/usr/bin/env node
// Reset BK password — generates a new random password, updates D1 (via SQL is done by shell),
// prints the new password. Run: node scripts/reset-bk-password.mjs
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'

const pw = randomBytes(6).toString('hex')
const hash = await bcrypt.hash(pw, 10)
console.log(`BK_PASSWORD=${pw}`)
console.log(`HASH=${hash}`)
