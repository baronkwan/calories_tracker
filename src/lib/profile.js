// Profile engine — Mifflin-St Jeor TDEE + goal-adjusted budget + macro targets.

export const ACTIVITY_OPTIONS = [
  { id: 'sedentary', label: '久坐', mult: 1.2 },
  { id: 'light', label: '輕度', mult: 1.375 },
  { id: 'moderate', label: '中度', mult: 1.55 },
  { id: 'active', label: '活躍', mult: 1.725 },
]

export const GOAL_OPTIONS = [
  { id: 'lose', label: '減脂' },
  { id: 'maintain', label: '維持' },
  { id: 'gain', label: '增肌' },
]

export const RATE_OPTIONS = [
  { id: '0.25', label: '0.25 kg/週' },
  { id: '0.5', label: '0.5 kg/週' },
  { id: '0.75', label: '0.75 kg/週' },
  { id: '1', label: '1 kg/週' },
]

// Neutral defaults — NOT any specific user's real data. Each user must set
// their own; new accounts must never inherit someone else's body metrics.
export const DEFAULT_PROFILE = {
  gender: 'female',
  age: 30,
  heightCm: 165,
  weightKg: 60,
  activity: 'sedentary',
  goal: 'maintain',
  rate: 0.5, // kg/week for lose/gain
  weightLog: [], // [{ date, kg }]
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem('cd-profile')
    if (!raw) return { ...DEFAULT_PROFILE }
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_PROFILE }
  }
}

export function saveProfile(p) {
  localStorage.setItem('cd-profile', JSON.stringify(p))
}

export function calcBMR(p) {
  // Mifflin-St Jeor
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age
  return p.gender === 'female' ? base - 161 : base + 5
}

export function calcTDEE(p) {
  const act = ACTIVITY_OPTIONS.find((a) => a.id === p.activity) || ACTIVITY_OPTIONS[0]
  return calcBMR(p) * act.mult
}

export function calcBudget(p) {
  const tdee = calcTDEE(p)
  let adj = 0
  if (p.goal === 'lose') adj = -Math.round(p.rate * 1000)
  if (p.goal === 'gain') adj = Math.round(p.rate * 1000)
  return Math.max(1200, Math.round(tdee + adj))
}

export function calcMacroTargets(p) {
  const budget = calcBudget(p)
  const proteinG = Math.round((p.goal === 'lose' ? 1.8 : p.goal === 'gain' ? 2.0 : 1.6) * p.weightKg)
  const fatPct = p.goal === 'lose' ? 0.25 : 0.3
  const fatG = Math.round((budget * fatPct) / 9)
  const carbG = Math.round((budget - proteinG * 4 - fatG * 9) / 4)
  return { budget, proteinG, fatG, carbG }
}

export function dayMacros(day) {
  if (!day) return { p: 0, c: 0, f: 0 }
  return day.meals.reduce(
    (acc, m) =>
      m.items.reduce((a, it) => ({ p: a.p + (it.p || 0), c: a.c + (it.c || 0), f: a.f + (it.f || 0) }), acc),
    { p: 0, c: 0, f: 0 }
  )
}
