import { useMemo, useState } from 'react'
import { X, Plus, Minus, Search } from 'lucide-react'

const MEALS = ['早餐', '午餐', '下午茶', '晚餐']

function portionLabel(food, qty) {
  const p = food.portion || ''
  const wm = p.match(/^(\d+(?:\.\d+)?)\s*(g|ml)/i)
  if (wm) return `${Math.round(qty * parseFloat(wm[1]))}${wm[2]}`
  const cm = p.match(/^1\s*(.+)$/)
  if (cm) return `${qty}${cm[1]}`
  return `${qty} 份`
}

export default function AddFoodSheet({ foods, onClose, onAdd }) {
  const [meal, setMeal] = useState('早餐')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [qty, setQty] = useState(1)
  const [custom, setCustom] = useState({ name: '', kcal: '' })

  const results = useMemo(() => {
    const q = query.trim()
    if (!q) return foods.slice(0, 10)
    return foods.filter((f) => f.name.includes(q)).slice(0, 10)
  }, [foods, query])

  const pick = (food) => { setSelected(food); setQty(1) }
  const close = () => { onClose(); setSelected(null); setQuery(''); setQty(1); setCustom({ name: '', kcal: '' }) }

  const handleAdd = () => {
    if (selected) {
      const food = selected
      const mult = qty
      onAdd(meal, {
        name: food.name,
        portion: portionLabel(food, mult),
        kcal: Math.round(food.kcal * mult),
        p: food.p ? Math.round(food.p * mult * 10) / 10 : 0,
        c: food.c ? Math.round(food.c * mult * 10) / 10 : 0,
        f: food.f ? Math.round(food.f * mult * 10) / 10 : 0,
      })
    } else if (custom.name.trim() && Number(custom.kcal) > 0) {
      onAdd(meal, { name: custom.name.trim(), portion: '1份', kcal: Math.round(Number(custom.kcal)) })
    }
    close()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-label="新增食物">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={close} />
      <div
        className="relative w-full max-w-[520px] rounded-t-[24px] px-4 pb-6 pt-3"
        style={{ backgroundColor: 'var(--surface)', maxHeight: '78dvh', overflowY: 'auto', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[17px] font-bold">新增食物</span>
          <button aria-label="關閉" onClick={close} className="btn-press flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--surface2)', color: 'var(--text2)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Meal selector */}
        <div className="mb-3 flex gap-1.5">
          {MEALS.map((m) => (
            <button
              key={m}
              onClick={() => setMeal(m)}
              className="btn-press rounded-full px-3.5 py-1.5 text-[12px] font-semibold"
              style={{
                backgroundColor: meal === m ? 'var(--accent)' : 'var(--surface2)',
                color: meal === m ? '#fff' : 'var(--text2)',
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--surface2)' }}>
          <Search size={15} style={{ color: 'var(--text3)' }} />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null) }}
            placeholder="搜尋食物（菠蘿油、雞胸…）"
            className="w-full bg-transparent text-[14px] outline-none"
            style={{ color: 'var(--text)' }}
          />
        </div>

        {selected ? (
          <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--surface2)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-semibold">{selected.name}</div>
                <div className="text-[11px]" style={{ color: 'var(--text3)' }}>
                  {selected.portion || '1份'} · {Math.round(selected.kcal)} kcal
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button aria-label="減少" className="btn-press flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--surface)', color: 'var(--accent)' }} onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  <Minus size={15} />
                </button>
                <span className="tnum w-6 text-center text-[15px] font-bold">{qty}</span>
                <button aria-label="增加" className="btn-press flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--surface)', color: 'var(--accent)' }} onClick={() => setQty((q) => q + 1)}>
                  <Plus size={15} />
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[12px]" style={{ color: 'var(--text2)' }}>份量：{portionLabel(selected, qty)}</span>
              <span className="tnum text-[15px] font-bold" style={{ color: 'var(--accent)' }}>
                {Math.round(selected.kcal * qty)} kcal
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {results.map((f) => (
                <button
                  key={f.name}
                  onClick={() => pick(f)}
                  className="btn-press flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left"
                  style={{ backgroundColor: 'var(--surface2)' }}
                >
                  <div>
                    <div className="text-[13px] font-medium">{f.name}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text3)' }}>{f.portion || '1份'}</div>
                  </div>
                  <span className="tnum text-[12px] font-semibold" style={{ color: 'var(--text2)' }}>{Math.round(f.kcal)} kcal</span>
                </button>
              ))}
            </div>

            {query.trim() && results.length === 0 && (
              <div className="mt-2 rounded-xl p-3" style={{ backgroundColor: 'var(--surface2)' }}>
                <div className="mb-2 text-[12px]" style={{ color: 'var(--text3)' }}>搵唔到？自訂食物：</div>
                <div className="flex gap-2">
                  <input
                    value={custom.name}
                    onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))}
                    placeholder="食物名"
                    className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                    style={{ backgroundColor: 'var(--surface)', color: 'var(--text)' }}
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    value={custom.kcal}
                    onChange={(e) => setCustom((c) => ({ ...c, kcal: e.target.value }))}
                    placeholder="kcal"
                    className="tnum w-24 rounded-lg px-3 py-2 text-right text-[13px] outline-none"
                    style={{ backgroundColor: 'var(--surface)', color: 'var(--text)' }}
                  />
                </div>
              </div>
            )}
          </>
        )}

        <button
          onClick={handleAdd}
          disabled={!selected && !(custom.name.trim() && Number(custom.kcal) > 0)}
          className="btn-press mt-3 w-full rounded-xl py-3 text-[15px] font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          加入{meal}
        </button>
      </div>
    </div>
  )
}
