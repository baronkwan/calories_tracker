// Data aggregation helpers — all derived from diet-data.json days map.

export const fmt = (n) => Math.round(n).toLocaleString('en-US')

export function statusOf(total, budget) {
  const pct = budget > 0 ? (total / budget) * 100 : 0
  if (pct < 80) return { key: 'ok', label: '未超標', color: 'var(--green)', pct }
  if (pct <= 100) return { key: 'close', label: '接近預算', color: 'var(--orange)', pct }
  return { key: 'over', label: '已超標', color: 'var(--red)', pct }
}

export function weekDays(reference) {
  const end = new Date(reference)
  end.setHours(0, 0, 0, 0)
  const dayOfWeek = end.getDay() // 0=Sun
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(end.getDate() - i)
    days.push(d)
  }
  return days
}

export function monthDays(year, month) {
  const first = new Date(year, month, 1)
  const count = new Date(year, month + 1, 0).getDate()
  const lead = first.getDay() // 0=Sun
  const days = []
  for (let i = 0; i < lead; i++) days.push(null)
  for (let d = 1; d <= count; d++) days.push(new Date(year, month, d))
  return days
}

export function dateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function dayTotal(day) {
  return day ? day.total : 0
}

export function monthAgg(daysMap, year, month) {
  let total = 0
  let overDays = 0
  let recorded = 0
  let max = { date: null, kcal: 0 }
  for (const [key, day] of Object.entries(daysMap)) {
    const d = new Date(key + 'T00:00:00')
    if (d.getFullYear() === year && d.getMonth() === month) {
      recorded++
      total += day.total
      if (day.total > 0 && day.total > max.kcal) max = { date: key, kcal: day.total }
    }
  }
  return { total, recorded, overDays, max }
}
