import { useEffect, useMemo, useState } from 'react'
import { Flame, CalendarDays, BarChart3, CalendarRange, UserRound, Sun, Moon, ChevronLeft, ChevronRight, Plus, Camera, Dumbbell } from 'lucide-react'
import DayView from './components/DayView.jsx'
import WeeklyChart from './components/WeeklyChart.jsx'
import Heatmap from './components/Heatmap.jsx'
import ProfileTab from './components/ProfileTab.jsx'
import AuthScreen from './components/AuthScreen.jsx'
import AddFoodSheet from './components/AddFoodSheet.jsx'
import AddExerciseSheet from './components/AddExerciseSheet.jsx'
import VisionSheet from './components/VisionSheet.jsx'
import EditItemSheet from './components/EditItemSheet.jsx'
import { fmt, lastNDays, streakCount, monthDays, monthAgg, dateKey, dayTotal } from './lib/data.js'
import { loadProfile, saveProfile, calcBudget, calcMacroTargets, dayMacros } from './lib/profile.js'
import { dayExercises, dayBurn } from './lib/exercises.js'
import { setToken, getToken, fetchDays, putDay, deleteDay, fetchProfileRemote, fetchWeightsRemote, fetchFoods, fetchExercises, addExercise, deleteExercise } from './lib/api.js'

const TABS = [
  { id: 'today', label: '今日', icon: Flame },
  { id: 'daily', label: '日記', icon: CalendarDays },
  { id: 'weekly', label: '週報', icon: BarChart3 },
  { id: 'monthly', label: '月報', icon: CalendarRange },
  { id: 'profile', label: '個人', icon: UserRound },
]

const MONTHS_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六']

export default function App() {
  const [authed, setAuthed] = useState(() => Boolean(getToken()))
  const [user, setUser] = useState(null)
  const [data, setData] = useState({ budget: 2073, days: {}, foods: [] })
  const [tab, setTab] = useState('today')
  const [dark, setDark] = useState(false)
  const [profile, setProfile] = useState(() => loadProfile())
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [monthOffset, setMonthOffset] = useState(0)
  const [reportRange, setReportRange] = useState(7) // 7 | 30 | 90
  const [showAdd, setShowAdd] = useState(false)
  const [showVision, setShowVision] = useState(false)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [exerciseDate, setExerciseDate] = useState(() => dateKey(new Date()))
  const [exercises, setExercises] = useState([])
  const [editingItem, setEditingItem] = useState(null) // { date, mealIdx, itemIdx, item }
  const [confirmDeleteDay, setConfirmDeleteDay] = useState(null) // date string
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('cd-theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initial = stored ? stored === 'dark' : prefersDark
    setDark(initial)
    document.documentElement.classList.toggle('dark', initial)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('cd-theme', dark ? 'dark' : 'light')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.content = dark ? '#000000' : '#f2f2f7'
  }, [dark])

  // Load user data once authenticated
  useEffect(() => {
    if (!authed) return
    let cancelled = false
    setLoadError('')
    ;(async () => {
      // allSettled: a failing call (e.g. profile) must NOT blank the days view
      const [daysRes, profileRes, weightsRes, foodsRes, exRes] = await Promise.allSettled([
        fetchDays(), fetchProfileRemote(), fetchWeightsRemote(), fetchFoods(), fetchExercises(),
      ])
      if (cancelled) return
      const foods = foodsRes.status === 'fulfilled' ? foodsRes.value : []
      if (exRes.status === 'fulfilled') setExercises(exRes.value)
      if (daysRes.status === 'fulfilled') {
        // API returns { days: {…} } — unwrap before storing
        const daysMap = daysRes.value.days || {}
        setData({ budget: 2073, generatedAt: new Date().toISOString(), days: daysMap, foods })
      } else {
        setData((d) => ({ ...d, foods }))
        setLoadError(daysRes.reason?.message || '載入失敗')
        if (daysRes.reason?.status === 401) handleLogout()
      }
      if (profileRes.status === 'fulfilled' && profileRes.value) {
        const merged = { ...loadProfile(), ...profileRes.value }
        if (weightsRes.status === 'fulfilled' && weightsRes.value.length) {
          merged.weightLog = weightsRes.value.map((w) => ({ date: w.date, kg: w.kg }))
        }
        setProfile(merged)
        saveProfile(merged)
      }
    })()
    return () => { cancelled = true }
  }, [authed])

  const budget = useMemo(() => calcBudget(profile), [profile])
  const macroTargets = useMemo(() => calcMacroTargets(profile), [profile])
  const daysMap = data.days || {}

  // Best current weight for exercise kcal preview. MUST match worker
  // currentWeightKg priority (profile.weightKg → latest weight_log → 60)
  // so the sheet preview equals the stored kcal.
  const currentWeight = profile.weightKg

  const now = useMemo(() => new Date(), [])
  const todayKey = dateKey(now)

  // Report range (7/30/90 days ending today) — richer metrics for 週報
  const rangeDays = useMemo(
    () =>
      lastNDays(now, reportRange).map((d) => {
        const key = dateKey(d)
        return { key, date: d, isToday: key === todayKey, kcal: dayTotal(daysMap[key]), burn: dayBurn(exercises, key) }
      }),
    [reportRange, now, daysMap, todayKey, exercises]
  )
  const rangeStats = useMemo(() => {
    const recorded = rangeDays.filter((d) => d.kcal > 0)
    const total = rangeDays.reduce((s, d) => s + d.kcal, 0)
    const burn = rangeDays.reduce((s, d) => s + d.burn, 0)
    const max = recorded.reduce((m, d) => (d.kcal > m.kcal ? { kcal: d.kcal, key: d.key } : m), { kcal: 0, key: null })
    const min = recorded.reduce((m, d) => (m.key === null || d.kcal < m.kcal ? { kcal: d.kcal, key: d.key } : m), { kcal: 0, key: null })
    return {
      total,
      burn,
      net: total - burn,
      recordedCount: recorded.length,
      totalDays: rangeDays.length,
      avgRecorded: recorded.length ? total / recorded.length : 0,
      avgAll: rangeDays.length ? total / rangeDays.length : 0,
      overCount: recorded.filter((d) => d.kcal > budget).length,
      max,
      min,
      streak: streakCount(daysMap, now),
    }
  }, [rangeDays, budget, daysMap, now])

  const monthBase = useMemo(() => new Date(now.getFullYear(), now.getMonth() + monthOffset, 1), [now, monthOffset])
  const mYear = monthBase.getFullYear()
  const mMonth = monthBase.getMonth()
  const mDays = useMemo(() => monthDays(mYear, mMonth), [mYear, mMonth])
  const mStats = useMemo(() => monthAgg(daysMap, mYear, mMonth), [daysMap, mYear, mMonth])
  const monthBurn = useMemo(() => {
    const prefix = `${mYear}-${String(mMonth + 1).padStart(2, '0')}`
    return exercises.filter((e) => e.date.startsWith(prefix)).reduce((s, e) => s + (e.kcal || 0), 0)
  }, [exercises, mYear, mMonth])

  const selectedKey = dateKey(selectedDate)
  const selectedDay = daysMap[selectedKey]
  const todayDay = daysMap[todayKey]

  const headerTitle =
    tab === 'today' ? '今日' : tab === 'daily' ? '日記' : tab === 'weekly' ? '本週' : tab === 'monthly' ? '本月' : '個人'

  const handleAuth = (u, t) => {
    setToken(t)
    setUser(u)
    setAuthed(true)
  }

  const handleLogout = () => {
    setToken(null)
    setUser(null)
    setAuthed(false)
    localStorage.removeItem('cd-profile') // never leak one user's profile to the next
    setData({ budget: 2073, days: {}, foods: [] })
    setExercises([])
    setProfile(loadProfile())
  }

  const handleSaveProfile = (p) => {
    saveProfile(p)
    setProfile(p)
    // cloud sync (fire-and-forget via api layer in ProfileTab)
  }

  const handleAddItem = async (dateObj, mealName, item) => {
    const key = dateKey(dateObj)
    const day = daysMap[key] || { date: key, meals: [], total: 0 }
    const meals = (day.meals || []).map((m) => ({ ...m, items: [...m.items] }))
    let meal = meals.find((m) => m.name === mealName)
    if (!meal) {
      meal = { name: mealName, items: [], total: 0 }
      meals.push(meal)
    }
    meal.items.push(item)
    meal.total = meal.items.reduce((s, it) => s + it.kcal, 0)
    const total = meals.reduce((s, m) => s + m.total, 0)
    setData((d) => ({ ...d, days: { ...d.days, [key]: { date: key, meals, total } } }))
    try { await putDay(key, meals, total) } catch (e) { console.error('save failed', e) }
  }

  const handleAddAllItems = async (dateObj, mealName, newItems) => {
    const key = dateKey(dateObj)
    const day = daysMap[key] || { date: key, meals: [], total: 0 }
    const meals = (day.meals || []).map((m) => ({ ...m, items: [...m.items] }))
    let meal = meals.find((m) => m.name === mealName)
    if (!meal) {
      meal = { name: mealName, items: [], total: 0 }
      meals.push(meal)
    }
    meal.items.push(...newItems)
    meal.total = meal.items.reduce((s, it) => s + it.kcal, 0)
    const total = meals.reduce((s, m) => s + m.total, 0)
    setData((d) => ({ ...d, days: { ...d.days, [key]: { date: key, meals, total } } }))
    try { await putDay(key, meals, total) } catch (e) { console.error('save failed', e) }
  }

  // Recompute meal/day totals after an item-level change, then persist.
  const persistDay = async (key, meals) => {
    const total = meals.reduce((s, m) => s + (m.total || 0), 0)
    setData((d) => ({ ...d, days: { ...d.days, [key]: { date: key, meals, total } } }))
    try { await putDay(key, meals, total) } catch (e) { console.error('save failed', e) }
  }

  const handleEditItem = (date, mealIdx, itemIdx) => {
    const item = daysMap[date]?.meals?.[mealIdx]?.items?.[itemIdx]
    if (!item) return
    setEditingItem({ date, mealIdx, itemIdx, item: { ...item } })
  }

  const handleSaveItem = async (patch) => {
    if (!editingItem) return
    const { date, mealIdx, itemIdx } = editingItem
    const day = daysMap[date] || { date, meals: [], total: 0 }
    const meals = (day.meals || []).map((m, mi) => {
      if (mi !== mealIdx) return { ...m, items: [...m.items] }
      const items = m.items.map((it, ii) => (ii === itemIdx ? { ...it, ...patch } : it))
      return { ...m, items, total: items.reduce((s, it) => s + (it.kcal || 0), 0) }
    })
    setEditingItem(null)
    await persistDay(date, meals)
  }

  const handleDeleteItem = async (date, mealIdx, itemIdx) => {
    const day = daysMap[date] || { date, meals: [], total: 0 }
    const meals = (day.meals || []).map((m, mi) => {
      if (mi !== mealIdx) return { ...m, items: [...m.items] }
      const items = m.items.filter((_, ii) => ii !== itemIdx)
      return { ...m, items, total: items.reduce((s, it) => s + (it.kcal || 0), 0) }
    }).filter((m) => m.items.length > 0) // drop empty meals
    await persistDay(date, meals)
  }

  const handleDeleteMeal = async (date, mealIdx) => {
    const day = daysMap[date] || { date, meals: [], total: 0 }
    const meals = (day.meals || []).filter((_, mi) => mi !== mealIdx)
    await persistDay(date, meals)
  }

  const handleDeleteDay = async (date) => {
    setConfirmDeleteDay(null)
    setData((d) => {
      const days = { ...d.days }
      delete days[date]
      return { ...d, days }
    })
    try { await deleteDay(date) } catch (e) { console.error('delete failed', e) }
  }

  // Exercises: server-authoritative kcal — await POST, then append the stored row.
  // kcal override only for 自訂運動 (other); typed exercises use the server's MET calc.
  const handleAddExercise = async (payload) => {
    try {
      const res = await addExercise(payload.date, payload.type, payload.durationMin, payload.type === 'other' ? payload.kcal : undefined, payload.name)
      setExercises((xs) => [
        ...xs,
        { id: res.id, date: payload.date, type: payload.type, name: payload.name, duration_min: payload.durationMin, kcal: res.kcal, source: 'manual' },
      ])
    } catch (e) { console.error('exercise save failed', e) }
  }

  const handleDeleteExercise = async (date, id) => {
    setExercises((xs) => xs.filter((x) => x.id !== id))
    try { await deleteExercise(id) } catch (e) { console.error('exercise delete failed', e) }
  }

  const openAddExercise = (dateKeyStr) => {
    setExerciseDate(dateKeyStr)
    setShowAddExercise(true)
  }

  if (!authed) return <AuthScreen onAuth={handleAuth} />

  return (
    <div className="mx-auto min-h-dvh max-w-[520px] px-4 pb-28 pt-4">
      {/* Header */}
      <header className="mb-4 flex items-center justify-between">
        <h1 className="large-title">{headerTitle}</h1>
        <button
          aria-label="切換深淺色"
          onClick={() => setDark((d) => !d)}
          className="btn-press flex h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </header>

      {loadError && (
        <div className="mb-4 rounded-xl px-4 py-2.5 text-[13px] font-medium" style={{ backgroundColor: 'color-mix(in srgb, var(--red) 12%, transparent)', color: 'var(--red)' }}>
          ⚠️ 載入失敗：{loadError}
        </div>
      )}

      {/* Today */}
      {tab === 'today' && (
        <DayView
          day={todayDay}
          budget={budget}
          macros={dayMacros(todayDay)}
          macroTargets={macroTargets}
          exercises={dayExercises(exercises, todayKey)}
          onAddExercise={() => openAddExercise(todayKey)}
          onDeleteExercise={handleDeleteExercise}
          emptyText="今日未有記錄 — 按＋新增食物"
        />
      )}

      {/* Daily */}
      {tab === 'daily' && (
        <div className="space-y-5">
          <div className="group-list flex items-center justify-between px-2 py-1.5">
            <button
              aria-label="前一天"
              className="btn-press flex h-9 w-9 items-center justify-center rounded-full"
              style={{ color: 'var(--accent)' }}
              onClick={() => setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))}
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <div className="text-[15px] font-semibold">
                {selectedDate.getFullYear()}年{MONTHS_ZH[selectedDate.getMonth()]}
              </div>
              <div className="text-[12px]" style={{ color: 'var(--text3)' }}>
                {selectedDate.getDate()}日 星期{WEEKDAY_ZH[selectedDate.getDay()]}
              </div>
            </div>
            <button
              aria-label="後一天"
              className="btn-press flex h-9 w-9 items-center justify-center rounded-full"
              style={{ color: 'var(--accent)' }}
              onClick={() => setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))}
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="btn-press flex items-center justify-center gap-1.5 rounded-xl py-3 text-[14px] font-bold text-white"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Plus size={16} /> 新增食物
            </button>
            <button
              onClick={() => setShowVision(true)}
              className="btn-press flex items-center justify-center gap-1.5 rounded-xl py-3 text-[14px] font-bold"
              style={{ backgroundColor: 'var(--surface)', border: '1.5px solid var(--accent)', color: 'var(--accent)' }}
            >
              <Camera size={16} /> 影相記錄
            </button>
            <button
              onClick={() => openAddExercise(selectedKey)}
              className="btn-press flex items-center justify-center gap-1.5 rounded-xl py-3 text-[14px] font-bold"
              style={{ backgroundColor: 'var(--surface)', border: '1.5px solid var(--orange)', color: 'var(--orange)' }}
            >
              <Dumbbell size={16} /> 新增運動
            </button>
          </div>
          <DayView
            day={selectedDay}
            budget={budget}
            macros={dayMacros(selectedDay)}
            macroTargets={macroTargets}
            exercises={dayExercises(exercises, selectedKey)}
            onAddExercise={() => openAddExercise(selectedKey)}
            onDeleteExercise={handleDeleteExercise}
            emptyText="呢日未有記錄"
            onEditItem={handleEditItem}
            onDeleteItem={handleDeleteItem}
            onDeleteMeal={handleDeleteMeal}
            onDeleteDay={(date) => setConfirmDeleteDay(date)}
          />
        </div>
      )}

      {/* Weekly / range report */}
      {tab === 'weekly' && (
        <div className="space-y-5">
          {/* Range selector */}
          <div className="group-list grid grid-cols-3 gap-1 p-1">
            {[7, 30, 90].map((n) => (
              <button
                key={n}
                onClick={() => setReportRange(n)}
                className="btn-press rounded-xl py-2 text-[13px] font-bold"
                style={{
                  backgroundColor: reportRange === n ? 'var(--accent)' : 'transparent',
                  color: reportRange === n ? '#fff' : 'var(--text2)',
                }}
              >
                {n === 7 ? '本週' : n === 30 ? '30日' : '90日'}
              </button>
            ))}
          </div>

          <div className="group-list px-4 py-4">
            <WeeklyChart days={rangeDays} budget={budget} />
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="group-list px-4 py-3">
              <div className="tnum text-[20px] font-bold">{fmt(rangeStats.total)}</div>
              <div className="text-[11px]" style={{ color: 'var(--text3)' }}>總攝入 / {rangeStats.totalDays}日</div>
            </div>
            <div className="group-list px-4 py-3">
              <div className="tnum text-[20px] font-bold">{fmt(rangeStats.avgRecorded)}</div>
              <div className="text-[11px]" style={{ color: 'var(--text3)' }}>日均（{rangeStats.recordedCount}日有記錄）</div>
            </div>
            <div className="group-list px-4 py-3">
              <div className="tnum text-[20px] font-bold" style={{ color: rangeStats.overCount ? 'var(--red)' : 'var(--green)' }}>
                {rangeStats.overCount}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--text3)' }}>超標日 / {rangeStats.recordedCount}記錄日</div>
            </div>
            <div className="group-list px-4 py-3">
              <div className="tnum text-[20px] font-bold" style={{ color: 'var(--orange)' }}>🔥 {rangeStats.streak}</div>
              <div className="text-[11px]" style={{ color: 'var(--text3)' }}>連續記錄日</div>
            </div>
          </div>

          {/* Exercise + net stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="group-list px-4 py-3">
              <div className="tnum text-[20px] font-bold" style={{ color: 'var(--orange)' }}>{fmt(rangeStats.burn)}</div>
              <div className="text-[11px]" style={{ color: 'var(--text3)' }}>運動消耗 / {rangeStats.totalDays}日</div>
            </div>
            <div className="group-list px-4 py-3">
              <div className="tnum text-[20px] font-bold" style={{ color: rangeStats.net > budget * rangeStats.totalDays ? 'var(--red)' : 'var(--green)' }}>
                {fmt(rangeStats.net)}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--text3)' }}>淨攝入（食物 − 運動）</div>
            </div>
          </div>

          {/* Best / worst days */}
          <div className="grid grid-cols-2 gap-2">
            <div className="group-list px-4 py-3">
              <div className="text-[11px] font-semibold" style={{ color: 'var(--text3)' }}>最高攝入日</div>
              {rangeStats.max.key ? (
                <>
                  <div className="tnum text-[17px] font-bold" style={{ color: 'var(--red)' }}>{fmt(rangeStats.max.kcal)}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text3)' }}>{rangeStats.max.key} · 超 {fmt(rangeStats.max.kcal - budget)}</div>
                </>
              ) : (
                <div className="text-[13px]" style={{ color: 'var(--text3)' }}>—</div>
              )}
            </div>
            <div className="group-list px-4 py-3">
              <div className="text-[11px] font-semibold" style={{ color: 'var(--text3)' }}>最低攝入日</div>
              {rangeStats.min.key ? (
                <>
                  <div className="tnum text-[17px] font-bold" style={{ color: 'var(--green)' }}>{fmt(rangeStats.min.kcal)}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text3)' }}>{rangeStats.min.key} · 少 {fmt(budget - rangeStats.min.kcal)}</div>
                </>
              ) : (
                <div className="text-[13px]" style={{ color: 'var(--text3)' }}>—</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Monthly */}
      {tab === 'monthly' && (
        <div className="space-y-5">
          <div className="group-list flex items-center justify-between px-2 py-1.5">
            <button
              aria-label="上個月"
              className="btn-press flex h-9 w-9 items-center justify-center rounded-full"
              style={{ color: 'var(--accent)' }}
              onClick={() => setMonthOffset((o) => o - 1)}
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-[15px] font-semibold">{mYear}年{MONTHS_ZH[mMonth]}</div>
            <button
              aria-label="下個月"
              className="btn-press flex h-9 w-9 items-center justify-center rounded-full"
              style={{ color: 'var(--accent)' }}
              onClick={() => setMonthOffset((o) => Math.min(o + 1, 0))}
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="group-list px-4 py-4">
            <Heatmap monthDays={mDays} daysMap={daysMap} budget={budget} onSelect={(d) => { setSelectedDate(d); setTab('daily') }} />
          </div>
          <div className="grid grid-cols-4 text-center">
            <div>
              <div className="tnum text-[17px] font-bold">{fmt(mStats.total)}</div>
              <div className="text-[10.5px]" style={{ color: 'var(--text3)' }}>月總攝入</div>
            </div>
            <div className="stat-divider">
              <div className="tnum text-[17px] font-bold">{mStats.recorded ? fmt(mStats.total / mStats.recorded) : '—'}</div>
              <div className="text-[10.5px]" style={{ color: 'var(--text3)' }}>日均</div>
            </div>
            <div className="stat-divider">
              <div className="tnum text-[17px] font-bold">{mStats.recorded ? fmt(mStats.max.kcal) : '—'}</div>
              <div className="text-[10.5px]" style={{ color: 'var(--text3)' }}>最高日</div>
            </div>
            <div className="stat-divider">
              <div className="tnum text-[17px] font-bold" style={{ color: 'var(--orange)' }}>{fmt(monthBurn)}</div>
              <div className="text-[10.5px]" style={{ color: 'var(--text3)' }}>月運動消耗</div>
            </div>
          </div>
        </div>
      )}

      {/* Profile */}
      {tab === 'profile' && <ProfileTab profile={profile} onSave={handleSaveProfile} user={user} onLogout={handleLogout} />}

      {/* Add food sheet */}
      {showAdd && (
        <AddFoodSheet
          foods={data.foods || []}
          onClose={() => setShowAdd(false)}
          onAdd={(mealName, item) => handleAddItem(selectedDate, mealName, item)}
        />
      )}

      {/* Vision sheet */}
      {showVision && (
        <VisionSheet
          onClose={() => setShowVision(false)}
          onAddAll={(mealName, items) => handleAddAllItems(selectedDate, mealName, items)}
        />
      )}

      {/* Add exercise sheet */}
      {showAddExercise && (
        <AddExerciseSheet
          date={exerciseDate}
          weightKg={currentWeight}
          onClose={() => setShowAddExercise(false)}
          onAdd={handleAddExercise}
        />
      )}

      {/* Edit item sheet */}
      {editingItem && (
        <EditItemSheet
          item={editingItem.item}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveItem}
        />
      )}

      {/* Delete day confirm */}
      {confirmDeleteDay && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" role="dialog" aria-label="刪除確認">
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setConfirmDeleteDay(null)} />
          <div className="relative w-[85%] max-w-[340px] rounded-2xl p-5" style={{ backgroundColor: 'var(--surface)' }}>
            <div className="text-center text-[16px] font-bold">刪除呢日記錄？</div>
            <div className="mt-1 text-center text-[13px]" style={{ color: 'var(--text3)' }}>
              {confirmDeleteDay} 嘅飲食記錄會永久刪除，無法復原。
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirmDeleteDay(null)}
                className="btn-press rounded-xl py-2.5 text-[14px] font-semibold"
                style={{ backgroundColor: 'var(--surface2)', color: 'var(--text2)' }}
              >
                取消
              </button>
              <button
                onClick={() => handleDeleteDay(confirmDeleteDay)}
                className="btn-press rounded-xl py-2.5 text-[14px] font-bold text-white"
                style={{ backgroundColor: 'var(--red)' }}
              >
                刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <nav
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[520px] -translate-x-1/2 border-t backdrop-blur-xl"
        style={{ backgroundColor: 'color-mix(in srgb, var(--bg) 82%, transparent)', borderColor: 'var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-5">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="btn-press flex flex-col items-center gap-0.5 py-2"
                style={{ color: active ? 'var(--accent)' : 'var(--text3)' }}
              >
                <Icon size={21} strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-medium">{t.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
