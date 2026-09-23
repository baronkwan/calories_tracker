import { useState } from 'react'
import { Minus, Plus, Scale, TrendingUp, TrendingDown, MinusCircle } from 'lucide-react'
import {
  ACTIVITY_OPTIONS, GOAL_OPTIONS, RATE_OPTIONS,
  calcBMR, calcTDEE, calcBudget, calcMacroTargets,
} from '../lib/profile.js'
import { dateKey } from '../lib/data.js'
import { saveWeightRemote, saveProfileRemote, changePassword } from '../lib/api.js'
import APP_VERSION from '../lib/version.js'
import WeightChart from './WeightChart.jsx'

function Stepper({ label, value, onChange, min, max, suffix, step = 1 }) {
  return (
    <div className="row flex items-center justify-between">
      <span className="text-[15px]">{label}</span>
      <div className="flex items-center gap-3">
        <button
          aria-label={`減少${label}`}
          className="btn-press flex h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--surface2)', color: 'var(--accent)' }}
          onClick={() => onChange(Math.max(min, value - step))}
        >
          <Minus size={15} />
        </button>
        <span className="tnum w-20 text-center text-[15px] font-semibold">
          {value}{suffix}
        </span>
        <button
          aria-label={`增加${label}`}
          className="btn-press flex h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--surface2)', color: 'var(--accent)' }}
          onClick={() => onChange(Math.min(max, value + step))}
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  )
}

function Segmented({ options, value, onChange, labels }) {
  return (
    <div className="flex rounded-xl p-0.5" style={{ backgroundColor: 'var(--surface2)' }}>
      {options.map((opt) => {
        const active = value === opt
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className="btn-press flex-1 rounded-[10px] px-2 py-1.5 text-[12px] font-semibold"
            style={{
              backgroundColor: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text3)',
              boxShadow: active ? 'var(--shadow)' : 'none',
            }}
          >
            {labels ? labels[opt] : opt}
          </button>
        )
      })}
    </div>
  )
}

export default function ProfileTab({ profile, onSave, user, onLogout }) {
  const [draft, setDraft] = useState(profile)
  const [weightInput, setWeightInput] = useState(String(profile.weightKg))
  const [saved, setSaved] = useState(false)
  const [pw, setPw] = useState({ old: '', next: '' })
  const [pwMsg, setPwMsg] = useState('')

  const bmr = calcBMR(draft)
  const tdee = calcTDEE(draft)
  const budget = calcBudget(draft)
  const macros = calcMacroTargets(draft)
  const actLabel = ACTIVITY_OPTIONS.find((a) => a.id === draft.activity)?.label || ''

  const set = (patch) => { setDraft((d) => ({ ...d, ...patch })); setSaved(false) }

  // Weight is edited as free text so users can type any number (no premature clamp).
  // Returns the committed kg so callers can build the next draft synchronously
  // (setDraft is async — reading `draft` right after would see the OLD value).
  const commitWeight = (v) => {
    const n = Number(v)
    const kg = Number.isFinite(n) && n > 0 ? Math.min(250, Math.max(30, n)) : draft.weightKg
    set({ weightKg: kg })
    setWeightInput(String(kg))
    return kg
  }

  const handleSave = () => {
    const kg = commitWeight(weightInput) // flush any in-progress weight edit
    const next = { ...draft, weightKg: kg }
    setDraft(next)
    onSave(next)
    saveProfileRemote(next) // cloud sync
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const handleChangePassword = async () => {
    setPwMsg('')
    try {
      await changePassword(pw.old, pw.next)
      setPw({ old: '', next: '' })
      setPwMsg('✓ 密碼已更新')
    } catch (e) {
      setPwMsg(e.message)
    }
  }

  const handleLogWeight = () => {
    const kg = commitWeight(weightInput) // flush any in-progress weight edit
    const today = dateKey(new Date())
    const existing = (draft.weightLog || []).filter((w) => w.date !== today)
    const next = { ...draft, weightKg: kg, weightLog: [...existing, { date: today, kg }] }
    setDraft(next)
    onSave(next) // persist immediately
    saveWeightRemote(today, kg) // cloud sync
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const weightLog = [...(draft.weightLog || [])].sort((a, b) => a.date.localeCompare(b.date))

  const goalIcon = draft.goal === 'lose' ? TrendingDown : draft.goal === 'gain' ? TrendingUp : MinusCircle

  return (
    <div className="space-y-5">
      {/* Account card */}
      <div className="group-list flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-bold text-white" style={{ backgroundColor: 'var(--accent)' }}>
            {(user?.displayName || user?.username || '?').slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="text-[15px] font-semibold">{user?.displayName || user?.username}</div>
            <div className="text-[11px]" style={{ color: 'var(--text3)' }}>@{user?.username}</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="btn-press rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
          style={{ backgroundColor: 'var(--red)' }}
        >
          登出
        </button>
      </div>

      {/* Live calculation card */}
      <div className="group-list px-4 py-5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium" style={{ color: 'var(--text3)' }}>每日熱量預算</span>
          <span className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: 'var(--text2)' }}>
            <goalIcon size={14} /> {GOAL_OPTIONS.find((g) => g.id === draft.goal)?.label} · {actLabel}
          </span>
        </div>
        <div className="tnum mt-1 text-[44px] font-extrabold" style={{ letterSpacing: '-0.02em' }}>
          {budget.toLocaleString('en-US')}
          <span className="text-[16px] font-medium" style={{ color: 'var(--text3)' }}> kcal/日</span>
        </div>
        <div className="mt-3 grid grid-cols-3 text-center">
          <div>
            <div className="tnum text-[13px] font-bold">{Math.round(bmr)}</div>
            <div className="text-[10px]" style={{ color: 'var(--text3)' }}>BMR</div>
          </div>
          <div className="stat-divider">
            <div className="tnum text-[13px] font-bold">{Math.round(tdee)}</div>
            <div className="text-[10px]" style={{ color: 'var(--text3)' }}>TDEE</div>
          </div>
          <div className="stat-divider">
            <div className="tnum text-[13px] font-bold">{macros.proteinG}/{macros.carbG}/{macros.fatG}g</div>
            <div className="text-[10px]" style={{ color: 'var(--text3)' }}>P/C/F 目標</div>
          </div>
        </div>
      </div>

      {/* Profile form */}
      <div className="group-list">
        <div className="row">
          <span className="mb-2 block text-[15px]">性別</span>
          <Segmented options={['male', 'female']} value={draft.gender} onChange={(v) => set({ gender: v })} labels={{ male: '男', female: '女' }} />
        </div>
        <Stepper label="年齡" value={draft.age} onChange={(v) => set({ age: v })} min={15} max={90} suffix=" 歲" />
        <Stepper label="身高" value={draft.heightCm} onChange={(v) => set({ heightCm: v })} min={120} max={220} suffix=" cm" />
        <div className="row flex items-center justify-between">
          <span className="text-[15px]">體重</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              onBlur={() => commitWeight(weightInput)}
              className="tnum w-24 rounded-lg border-0 px-3 py-1.5 text-right text-[15px] font-semibold outline-none"
              style={{ backgroundColor: 'var(--surface2)', color: 'var(--text)' }}
            />
            <span className="text-[13px]" style={{ color: 'var(--text3)' }}>kg</span>
          </div>
        </div>
        <div className="row">
          <span className="mb-2 block text-[15px]">活動量</span>
          <Segmented options={ACTIVITY_OPTIONS.map((a) => a.id)} value={draft.activity} onChange={(v) => set({ activity: v })} labels={Object.fromEntries(ACTIVITY_OPTIONS.map((a) => [a.id, a.label]))} />
        </div>
        <div className="row">
          <span className="mb-2 block text-[15px]">目標</span>
          <Segmented options={GOAL_OPTIONS.map((g) => g.id)} value={draft.goal} onChange={(v) => set({ goal: v })} labels={Object.fromEntries(GOAL_OPTIONS.map((g) => [g.id, g.label]))} />
        </div>
        {draft.goal !== 'maintain' && (
          <div className="row">
            <span className="mb-2 block text-[15px]">{draft.goal === 'lose' ? '每週減重速度' : '每週增重速度'}</span>
            <Segmented options={RATE_OPTIONS.map((r) => r.id)} value={String(draft.rate)} onChange={(v) => set({ rate: Number(v) })} labels={Object.fromEntries(RATE_OPTIONS.map((r) => [r.id, r.label]))} />
          </div>
        )}
        <div className="row">
          <button
            onClick={handleSave}
            className="btn-press w-full rounded-xl py-3 text-[15px] font-bold text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {saved ? '✓ 已儲存' : '儲存設定'}
          </button>
        </div>
      </div>

      {/* Weight log */}
      <div className="group-list">
        <div className="row flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale size={16} style={{ color: 'var(--accent)' }} />
            <span className="text-[15px] font-semibold">體重記錄</span>
          </div>
          <button
            onClick={handleLogWeight}
            className="btn-press rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            + 記錄今日
          </button>
        </div>
        {weightLog.length > 0 ? (
          <div className="px-4 pb-4">
            <WeightChart log={weightLog} goal={draft.goal} />
            {weightLog.length === 1 && (
              <div className="mt-2 text-[12px]" style={{ color: 'var(--text3)' }}>
                再磅多幾次就見到趨勢線 —— 隔日或每日磅一次最靚
              </div>
            )}
          </div>
        ) : (
          <div className="px-4 pb-4 text-[12px]" style={{ color: 'var(--text3)' }}>
            按「記錄今日」開始追蹤體重變化
          </div>
        )}
      </div>

      {/* Change password */}
      <div className="group-list">
        <div className="row text-[15px] font-semibold">更改密碼</div>
        <div className="row space-y-2">
          <input
            type="password"
            value={pw.old}
            onChange={(e) => setPw((p) => ({ ...p, old: e.target.value }))}
            placeholder="舊密碼"
            className="w-full rounded-lg px-3 py-2 text-[14px] outline-none"
            style={{ backgroundColor: 'var(--surface2)', color: 'var(--text)' }}
          />
          <input
            type="password"
            value={pw.next}
            onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
            placeholder="新密碼（至少 6 位）"
            className="w-full rounded-lg px-3 py-2 text-[14px] outline-none"
            style={{ backgroundColor: 'var(--surface2)', color: 'var(--text)' }}
          />
          <button
            onClick={handleChangePassword}
            disabled={!pw.old || pw.next.length < 6}
            className="btn-press w-full rounded-xl py-2.5 text-[14px] font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            更新密碼
          </button>
          {pwMsg && <div className="text-[12px]" style={{ color: pwMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{pwMsg}</div>}
        </div>
      </div>
      <div className="pt-2 text-center text-[11px]" style={{ color: 'var(--text3)' }}>
        版本 {APP_VERSION}
      </div>
    </div>
  )
}
