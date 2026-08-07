import { useState } from 'react'
import { login, register } from '../lib/api.js'

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = mode === 'login'
        ? await login(username, password)
        : await register(username, password, displayName || username)
      onAuth(res.user, res.token)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-6" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-full max-w-[380px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl text-[30px]" style={{ backgroundColor: 'var(--accent)' }}>
            🍎
          </div>
          <h1 className="large-title">Calorie Tracker</h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--text3)' }}>
            每日熱量 · 巨量營養 · 體重追蹤
          </p>
        </div>

        <form onSubmit={submit} className="group-list">
          <div className="row">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用戶名"
              autoCapitalize="none"
              autoComplete="username"
              className="w-full bg-transparent text-[15px] outline-none"
              style={{ color: 'var(--text)' }}
            />
          </div>
          {mode === 'register' && (
            <div className="row">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="顯示名稱（可留空）"
                className="w-full bg-transparent text-[15px] outline-none"
                style={{ color: 'var(--text)' }}
              />
            </div>
          )}
          <div className="row">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密碼（至少 6 位）"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full bg-transparent text-[15px] outline-none"
              style={{ color: 'var(--text)' }}
            />
          </div>
          <div className="row">
            <button
              type="submit"
              disabled={busy || !username || !password}
              className="btn-press w-full rounded-xl py-3 text-[15px] font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {busy ? '⋯' : mode === 'login' ? '登入' : '註冊'}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-3 rounded-xl px-4 py-2.5 text-center text-[13px] font-medium" style={{ backgroundColor: 'color-mix(in srgb, var(--red) 12%, transparent)', color: 'var(--red)' }}>
            {error}
          </div>
        )}

        <button
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
          className="mt-4 w-full text-center text-[13px] font-semibold"
          style={{ color: 'var(--accent)' }}
        >
          {mode === 'login' ? '未有帳號？註冊一個' : '已有帳號？直接登入'}
        </button>
      </div>
    </div>
  )
}
