// Exercise catalog + kcal estimation.
// MET values from the Compendium of Physical Activities.
// MUST stay in sync with worker/index.js EXERCISE_TYPES — the server is
// authoritative for stored kcal; this table is only for live UI preview.
// kcal = MET × weight(kg) × hours

export const EXERCISE_TYPES = [
  { id: 'indoor_walk', name: '室內步行', met: 3.5 },
  { id: 'indoor_run', name: '室內跑步', met: 8.3 },
  { id: 'walk', name: '步行', met: 3.5 },
  { id: 'run', name: '跑步', met: 8.3 },
  { id: 'cycling', name: '單車', met: 6.8 },
  { id: 'swimming', name: '游泳', met: 5.8 },
  { id: 'hiking', name: '行山', met: 6.0 },
  { id: 'yoga', name: '瑜伽', met: 2.5 },
  { id: 'strength', name: '重量訓練', met: 3.5 },
  { id: 'elliptical', name: '橢圓機', met: 5.0 },
  { id: 'stair_stepper', name: '樓梯機', met: 6.0 },
  { id: 'rowing', name: '划船機', met: 7.0 },
  { id: 'dance', name: '跳舞', met: 5.0 },
  { id: 'pilates', name: '普拉提', met: 3.0 },
  { id: 'hiit', name: '高強度間歇', met: 8.0 },
  { id: 'tai_chi', name: '太極', met: 3.0 },
  { id: 'jump_rope', name: '跳繩', met: 11.0 },
  { id: 'basketball', name: '籃球', met: 6.5 },
  { id: 'badminton', name: '羽毛球', met: 5.5 },
  { id: 'football', name: '足球', met: 7.0 },
  { id: 'tennis', name: '網球', met: 7.3 },
  { id: 'table_tennis', name: '乒乓球', met: 4.0 },
  { id: 'golf', name: '高爾夫', met: 4.8 },
  { id: 'stairs', name: '行樓梯', met: 4.0 },
  { id: 'other', name: '自訂運動', met: 4.0 },
]

export const EXERCISE_MET = Object.fromEntries(EXERCISE_TYPES.map((t) => [t.id, t]))

// Best practical kcal estimate (server recomputes authoritatively on save).
export function estimateKcal(typeId, weightKg, durationMin) {
  const t = EXERCISE_MET[typeId] || EXERCISE_MET.other
  const kg = Number(weightKg) > 0 ? Number(weightKg) : 60
  return Math.max(1, Math.round(t.met * kg * (Number(durationMin) || 0) / 60))
}

// Exercises for a given day key, oldest first.
export function dayExercises(exercises, key) {
  return (exercises || []).filter((e) => e.date === key).sort((a, b) => a.id - b.id)
}

export function dayBurn(exercises, key) {
  return (exercises || []).filter((e) => e.date === key).reduce((s, e) => s + (e.kcal || 0), 0)
}

export function fmtDuration(min) {
  const m = Math.round(Number(min) || 0)
  if (m < 60) return `${m} 分鐘`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} 小時 ${rest} 分` : `${h} 小時`
}
