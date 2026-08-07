// API layer — Cloudflare Worker + D1, JWT auth.
// All requests carry the Bearer token. No static fallback: data is per-user
// (showing BK's snapshot to another account would be a privacy leak).

export const API_BASE = 'https://calorie-api.baronjetso.workers.dev'

let token = null
try { token = localStorage.getItem('cd-token') || null } catch { token = null }

export function getToken() { return token }
export function setToken(t) {
  token = t
  try {
    if (t) localStorage.setItem('cd-token', t)
    else localStorage.removeItem('cd-token')
  } catch { /* ignore */ }
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(body.error || `API ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

export const login = (username, password) =>
  api('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) })

export const register = (username, password, displayName) =>
  api('/api/register', { method: 'POST', body: JSON.stringify({ username, password, displayName }) })

export const fetchDays = () => api('/api/days')
export const putDay = (date, meals, total) =>
  api(`/api/day/${date}`, { method: 'PUT', body: JSON.stringify({ meals, total }) })

export const fetchProfileRemote = async () => {
  try { return (await api('/api/profile')).profile } catch { return null }
}
export const saveProfileRemote = (profile) =>
  api('/api/profile', { method: 'PUT', body: JSON.stringify({ profile }) })

export const fetchWeightsRemote = async () => {
  try { return (await api('/api/weight')).weights || [] } catch { return [] }
}
export const saveWeightRemote = (date, kg) =>
  api('/api/weight', { method: 'PUT', body: JSON.stringify({ date, kg }) })

export const fetchFoods = async () => {
  try { return (await api('/api/foods')).foods || [] } catch { return [] }
}

export const changePassword = (oldPassword, newPassword) =>
  api('/api/password', { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) })

export const visionEstimate = (payload) =>
  api('/api/vision', { method: 'POST', body: JSON.stringify(payload) })
