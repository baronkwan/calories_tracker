// Data aggregation helpers — derived from the days map + exercise log.

export const fmt = (n) => Math.round(n).toLocaleString('en-US')

// Last N days ending at `reference` (inclusive), oldest first.
export function lastNDays(reference, n) {
  const end = new Date(reference)
  end.setHours(0, 0, 0, 0)
  const days = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(end.getDate() - i)
    days.push(d)
  }
  return days
}

// Consecutive recorded days ending at the most recent recorded day (streak).
export function streakCount(daysMap, reference) {
  let d = new Date(reference)
  d.setHours(0, 0, 0, 0)
  let count = 0
  while (true) {
    const key = dateKey(d)
    const day = daysMap[key]
    if (day && day.total > 0) {
      count++
      d.setDate(d.getDate() - 1)
    } else {
      break
    }
  }
  return count
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
  return { total, recorded, max }
}
