import { useMemo, useState } from 'react'
import { X, Dumbbell, Footprints, Bike, Waves, Mountain, Flame, HeartPulse, PersonStanding, Timer, Search, Apple } from 'lucide-react'
import { EXERCISE_TYPES, estimateKcal, fmtDuration } from '../lib/exercises.js'

const TYPE_ICONS = {
  indoor_walk: Footprints,
  indoor_run: Footprints,
  walk: Footprints,
  run: Footprints,
  cycling: Bike,
  swimming: Waves,
  hiking: Mountain,
  hiit: HeartPulse,
  other: Dumbbell,
}

const QUICK = ['indoor_walk', 'indoor_run', 'walk', 'run', 'cycling', 'swimming', 'hiking', 'hiit']
const QUICK_DURATIONS = [15, 30, 45, 60]

export default function AddExerciseSheet({ date: initialDate, weightKg, onClose, onAdd }) {
  const [date, setDate] = useState(initialDate)
  const [typeId, setTypeId] = useState('indoor_walk')
  const [duration, setDuration] = useState('30')
  const [customKcal, setCustomKcal] = useState('')
  const [query, setQuery] = useState('')

  const type = EXERCISE_TYPES.find((t) => t.id === typeId) || EXERCISE_TYPES[0]
  const durMin = Number(duration)
  const validDur = Number.isFinite(durMin) && durMin > 0
  const estimated = estimateKcal(typeId, weightKg, validDur ? durMin : 0)
  const preview = typeId === 'other' && Number(customKcal) > 0 ? Math.round(Number(customKcal)) : estimated

  const results = useMemo(() => {
    const q = query.trim()
    if (!q) return EXERCISE_TYPES
    return EXERCISE_TYPES.filter((t) => t.name.includes(q))
  }, [query])

  const close = () => { onClose(); setTypeId('indoor_walk'); setDuration('30'); setCustomKcal(''); setQuery('') }

  const handleAdd = () => {
    if (!validDur) return
    onAdd({
      date,
      type: type.id,
      name: type.name,
      durationMin: durMin,
      kcal: preview,
    })
    close()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-label="新增運動">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={close} />
      <div
        className="relative w-full max-w-[520px] rounded-t-[24px] px-4 pb-6 pt-3"
        style={{ backgroundColor: 'var(--surface)', maxHeight: '82dvh', overflowY: 'auto', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[17px] font-bold">新增運動</span>
          <button aria-label="關閉" onClick={close} className="btn-press flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--surface2)', color: 'var(--text2)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Apple Health import hint */}
        <div className="mb-3 flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ backgroundColor: 'color-mix(in srgb, var(--teal) 10%, transparent)' }}>
          <Apple size={15} style={{ color: 'var(--teal)', marginTop: 1 }} />
          <div className="text-[11.5px] leading-snug" style={{ color: 'var(--text2)' }}>
            想自動匯入？用 iPhone 捷徑「取得健康樣本 → 傳送到 URL」一鍵同步 Apple 健康嘅運動記錄，設定步驟見
            <span className="font-semibold"> docs/apple-health-shortcut.md</span>（或問 Jarvis）。
          </div>
        </div>

        {/* Date + duration */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--surface2)' }}>
            <div className="mb-1 text-[10.5px] font-semibold" style={{ color: 'var(--text3)' }}>日期</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="tnum w-full bg-transparent text-[14px] font-semibold outline-none"
              style={{ color: 'var(--text)' }}
            />
          </div>
          <div className="rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--surface2)' }}>
            <div className="mb-1 flex items-center gap-1 text-[10.5px] font-semibold" style={{ color: 'var(--text3)' }}>
              <Timer size={10} /> 時長（分鐘）
            </div>
            <input
              type="number"
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="tnum w-full bg-transparent text-[14px] font-semibold outline-none"
              style={{ color: 'var(--text)' }}
            />
          </div>
        </div>

        {/* Quick durations */}
        <div className="mb-3 flex gap-1.5">
          {QUICK_DURATIONS.map((m) => (
            <button
              key={m}
              onClick={() => setDuration(String(m))}
              className="btn-press rounded-full px-3 py-1.5 text-[12px] font-semibold"
              style={{
                backgroundColor: Number(duration) === m ? 'var(--accent)' : 'var(--surface2)',
                color: Number(duration) === m ? '#fff' : 'var(--text2)',
              }}
            >
              {m} 分
            </button>
          ))}
        </div>

        {/* Quick types */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {QUICK.map((id) => {
            const t = EXERCISE_TYPES.find((x) => x.id === id)
            const active = typeId === id
            return (
              <button
                key={id}
                onClick={() => setTypeId(id)}
                className="btn-press rounded-full px-3 py-1.5 text-[12px] font-semibold"
                style={{
                  backgroundColor: active ? 'var(--orange)' : 'var(--surface2)',
                  color: active ? '#fff' : 'var(--text2)',
                }}
              >
                {t.name}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--surface2)' }}>
          <Search size={15} style={{ color: 'var(--text3)' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋運動（跑步、瑜伽、划船…）"
            className="w-full bg-transparent text-[14px] outline-none"
            style={{ color: 'var(--text)' }}
          />
        </div>

        {/* Type list */}
        <div className="max-h-[26dvh] space-y-1 overflow-y-auto pr-0.5">
          {results.map((t) => {
            const Icon = TYPE_ICONS[t.id] || Dumbbell
            const active = typeId === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTypeId(t.id)}
                className="btn-press flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left"
                style={{ backgroundColor: active ? 'color-mix(in srgb, var(--orange) 12%, transparent)' : 'var(--surface2)' }}
              >
                <div className="flex items-center gap-2">
                  <Icon size={16} style={{ color: active ? 'var(--orange)' : 'var(--text3)' }} />
                  <span className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{t.name}</span>
                </div>
                <span className="tnum text-[11px]" style={{ color: 'var(--text3)' }}>MET {t.met}</span>
              </button>
            )
          })}
          {results.length === 0 && (
            <div className="px-2 py-3 text-center text-[12px]" style={{ color: 'var(--text3)' }}>搵唔到？用「自訂運動」</div>
          )}
        </div>

        {/* kcal preview */}
        <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: 'var(--surface2)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Flame size={15} style={{ color: 'var(--orange)' }} />
              <span className="text-[13px] font-semibold">預估消耗</span>
              <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
                （{type.name} · {fmtDuration(validDur ? durMin : 0)} · {Number(weightKg) > 0 ? weightKg + ' kg' : '體重未設'})
              </span>
            </div>
            <span className="tnum text-[17px] font-bold" style={{ color: 'var(--orange)' }}>
              {preview.toLocaleString('en-US')} kcal
            </span>
          </div>
          {typeId === 'other' && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px]" style={{ color: 'var(--text3)' }}>自訂 kcal（唔填就用 MET 估算）</span>
              <input
                type="number"
                inputMode="numeric"
                value={customKcal}
                onChange={(e) => setCustomKcal(e.target.value)}
                placeholder="kcal"
                className="tnum w-24 rounded-lg px-3 py-1.5 text-right text-[13px] outline-none"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--text)' }}
              />
            </div>
          )}
        </div>

        <button
          onClick={handleAdd}
          disabled={!validDur}
          className="btn-press mt-3 w-full rounded-xl py-3 text-[15px] font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--orange)' }}
        >
          加入運動
        </button>
      </div>
    </div>
  )
}
