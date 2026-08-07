import { useEffect, useMemo, useState } from 'react'
import { Flame, CalendarDays, BarChart3, CalendarRange, UserRound, Sun, Moon, ChevronLeft, ChevronRight, Plus, Camera } from 'lucide-react'
import DayView from './components/DayView.jsx'
import WeeklyChart from './components/WeeklyChart.jsx'
import Heatmap from './components/Heatmap.jsx'
import ProfileTab from './components/ProfileTab.jsx'
import AuthScreen from './components/AuthScreen.jsx'
import AddFoodSheet from './components/AddFoodSheet.jsx'
import VisionSheet from './components/VisionSheet.jsx'
import { fmt, weekDays, monthDays, monthAgg, dateKey, dayTotal } from './lib/data.js'
import { loadProfile, saveProfile, calcBudget, calcMacroTargets, dayMacros } from './lib/profile.js'
import { setToken, getToken, fetchDays, putDay, fetchProfileRemote, fetchWeightsRemote, fetchFoods } from './lib/api.js'

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
  const [showAdd, setShowAdd] = useState(false)
  const [showVision, setShowVision] = useState(false)
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
      const [daysRes, profileRes, weightsRes, foodsRes] = await Promise.allSettled([
        fetchDays(), fetchProfileRemote(), fetchWeightsRemote(), fetchFoods(),
      ])
      if (cancelled) return
      const foods = foodsRes.status === 'fulfilled' ? foodsRes.value : []
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

  const now = useMemo(() => new Date(), [])
  const todayKey = dateKey(now)

  const weekRef = useMemo(() => (tab === 'weekly' ? selectedDate : now), [tab, selectedDate, now])

  const week = useMemo(
    () =>
      weekDays(weekRef).map((d) => {
        const key = dateKey(d)
        return { key, date: d, isToday: key === todayKey, kcal: dayTotal(daysMap[key]) }
      }),
    [weekRef, daysMap, todayKey]
  )
  const weekTotal = week.reduce((s, d) => s + d.kcal, 0)
  const weekRecorded = week.filter((d) => d.kcal > 0)
  const weekAvg = weekRecorded.length ? weekTotal / weekRecorded.length : 0
  const weekOver = week.filter((d) => d.kcal > budget).length

  const monthBase = useMemo(() => new Date(now.getFullYear(), now.getMonth() + monthOffset, 1), [now, monthOffset])
  const mYear = monthBase.getFullYear()
  const mMonth = monthBase.getMonth()
  const mDays = useMemo(() => monthDays(mYear, mMonth), [mYear, mMonth])
  const mStats = useMemo(() => monthAgg(daysMap, mYear, mMonth), [daysMap, mYear, mMonth])

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
    setData({ budget: 2073, days: {}, foods: [] })
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
          <DayView
            day={selectedDay}
            budget={budget}
            macros={dayMacros(selectedDay)}
            macroTargets={macroTargets}
            emptyText="呢日未有記錄"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="btn-press flex items-center justify-center gap-2 rounded-xl py-3 text-[15px] font-bold text-white"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Plus size={17} /> 新增食物
            </button>
            <button
              onClick={() => setShowVision(true)}
              className="btn-press flex items-center justify-center gap-2 rounded-xl py-3 text-[15px] font-bold"
              style={{ backgroundColor: 'var(--surface)', border: '1.5px solid var(--accent)', color: 'var(--accent)' }}
            >
              <Camera size={17} /> 影相記錄
            </button>
          </div>
        </div>
      )}

      {/* Weekly */}
      {tab === 'weekly' && (
        <div className="space-y-5">
          <div className="group-list px-4 py-4">
            <WeeklyChart days={week} budget={budget} />
          </div>
          <div className="grid grid-cols-3 text-center">
            <div>
              <div className="tnum text-[20px] font-bold">{fmt(weekTotal)}</div>
              <div className="text-[11px]" style={{ color: 'var(--text3)' }}>本週總攝入</div>
            </div>
            <div className="stat-divider">
              <div className="tnum text-[20px] font-bold">{fmt(weekAvg)}</div>
              <div className="text-[11px]" style={{ color: 'var(--text3)' }}>日均（有記錄日）</div>
            </div>
            <div className="stat-divider">
              <div className="tnum text-[20px] font-bold" style={{ color: weekOver ? 'var(--red)' : 'var(--green)' }}>
                {weekOver}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--text3)' }}>超標日 / 7</div>
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
          <div className="grid grid-cols-3 text-center">
            <div>
              <div className="tnum text-[20px] font-bold">{fmt(mStats.total)}</div>
              <div className="text-[11px]" style={{ color: 'var(--text3)' }}>月總攝入</div>
            </div>
            <div className="stat-divider">
              <div className="tnum text-[20px] font-bold">{mStats.recorded ? fmt(mStats.total / mStats.recorded) : '—'}</div>
              <div className="text-[11px]" style={{ color: 'var(--text3)' }}>日均 / {mStats.recorded}日</div>
            </div>
            <div className="stat-divider">
              <div className="tnum text-[20px] font-bold">{mStats.recorded ? fmt(mStats.max.kcal) : '—'}</div>
              <div className="text-[11px]" style={{ color: 'var(--text3)' }}>最高日</div>
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
