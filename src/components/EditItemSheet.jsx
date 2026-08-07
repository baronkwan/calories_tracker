import { useState } from 'react'
import { X } from 'lucide-react'

export default function EditItemSheet({ item, onClose, onSave }) {
  const [name, setName] = useState(item?.name || '')
  const [portion, setPortion] = useState(item?.portion || '1份')
  const [kcal, setKcal] = useState(item?.kcal != null ? String(item.kcal) : '')

  const save = () => {
    const kcalNum = Number(kcal)
    if (!name.trim() || !Number.isFinite(kcalNum) || kcalNum <= 0) return
    onSave({ name: name.trim(), portion: portion.trim() || '1份', kcal: Math.round(kcalNum) })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-label="編輯食物">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div
        className="relative w-full max-w-[520px] rounded-t-[24px] px-4 pb-6 pt-3"
        style={{ backgroundColor: 'var(--surface)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[17px] font-bold">編輯食物</span>
          <button aria-label="關閉" onClick={onClose} className="btn-press flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--surface2)', color: 'var(--text2)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 text-[12px] font-semibold" style={{ color: 'var(--text3)' }}>食物名</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-[14px] outline-none"
              style={{ backgroundColor: 'var(--surface2)', color: 'var(--text)' }}
            />
          </div>
          <div>
            <div className="mb-1 text-[12px] font-semibold" style={{ color: 'var(--text3)' }}>份量</div>
            <input
              value={portion}
              onChange={(e) => setPortion(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-[14px] outline-none"
              style={{ backgroundColor: 'var(--surface2)', color: 'var(--text)' }}
            />
          </div>
          <div>
            <div className="mb-1 text-[12px] font-semibold" style={{ color: 'var(--text3)' }}>卡路里 (kcal)</div>
            <input
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              inputMode="numeric"
              className="w-full rounded-xl px-3 py-2.5 text-[14px] outline-none"
              style={{ backgroundColor: 'var(--surface2)', color: 'var(--text)' }}
            />
          </div>
          <button
            onClick={save}
            disabled={!name.trim() || !(Number(kcal) > 0)}
            className="btn-press w-full rounded-xl py-3 text-[15px] font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  )
}
