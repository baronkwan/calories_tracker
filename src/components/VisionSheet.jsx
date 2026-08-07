import { useRef, useState } from 'react'
import { X, Camera, Loader2, Trash2, ScanLine } from 'lucide-react'
import { visionEstimate } from '../lib/api.js'

const MEALS = ['早餐', '午餐', '下午茶', '晚餐']

/** Resize + compress an image file to a JPEG data URL (max 1024px) */
function fileToDataURL(file, maxDim = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('圖片讀取失敗')) }
    img.src = url
  })
}

export default function VisionSheet({ onClose, onAddAll }) {
  const fileRef = useRef(null)
  const [phase, setPhase] = useState('input') // input | loading | result | error
  const [error, setError] = useState('')
  const [meal, setMeal] = useState('午餐')
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [items, setItems] = useState([])
  const [imagePreview, setImagePreview] = useState(null)

  const close = () => {
    setPhase('input'); setResult(null); setItems([]); setText(''); setError(''); setImagePreview(null)
    onClose()
  }

  const run = async (payload) => {
    setPhase('loading')
    setError('')
    try {
      const res = await visionEstimate(payload)
      setResult(res)
      setItems(res.items.map((it) => ({ ...it })))
      setPhase('result')
    } catch (e) {
      setError(e.message || 'AI 認唔到，試下再影/寫詳細啲')
      setPhase('error')
    }
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await fileToDataURL(file)
      setImagePreview(dataUrl)
      await run({ imageBase64: dataUrl, text: text.trim() || undefined })
    } catch (err) {
      setError(err.message)
      setPhase('error')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onText = () => {
    if (!text.trim()) return
    run({ text: text.trim() })
  }

  const updateItem = (i, patch) => {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }
  const removeItem = (i) => setItems((arr) => arr.filter((_, idx) => idx !== i))
  const total = items.reduce((s, it) => s + (Number(it.kcal) || 0), 0)

  const confirm = () => {
    if (!items.length) return
    onAddAll(meal, items)
    close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-label="影相記錄">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={close} />
      <div
        className="relative w-full max-w-[520px] rounded-t-[24px] px-4 pb-6 pt-3"
        style={{ backgroundColor: 'var(--surface)', maxHeight: '85dvh', overflowY: 'auto', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[17px] font-bold">📷 影相記錄</span>
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
              style={{ backgroundColor: meal === m ? 'var(--accent)' : 'var(--surface2)', color: meal === m ? '#fff' : 'var(--text2)' }}
            >
              {m}
            </button>
          ))}
        </div>

        {phase === 'input' && (
          <>
            {/* Photo */}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
            <button
              onClick={() => fileRef.current?.click()}
              className="btn-press mb-3 flex w-full flex-col items-center gap-2 rounded-2xl py-6"
              style={{ backgroundColor: 'var(--surface2)', border: '1.5px dashed var(--border)' }}
            >
              <Camera size={30} style={{ color: 'var(--accent)' }} />
              <span className="text-[14px] font-semibold">影相 / 揀相</span>
              <span className="text-[11px]" style={{ color: 'var(--text3)' }}>手機會開相機，電腦揀檔案</span>
            </button>

            {/* Or text description */}
            <div className="mb-2 text-[12px] font-semibold" style={{ color: 'var(--text3)' }}>或者寫描述：</div>
            <div className="mb-3 flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="例如：一碗雲吞麵，一碟蠔油生菜，半杯凍檸茶少甜"
                rows={2}
                className="w-full resize-none rounded-xl px-3 py-2 text-[14px] outline-none"
                style={{ backgroundColor: 'var(--surface2)', color: 'var(--text)' }}
              />
              <button
                onClick={onText}
                disabled={!text.trim()}
                className="btn-press flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-bold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <ScanLine size={15} /> 估算
              </button>
            </div>
          </>
        )}

        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 size={34} className="animate-spin" style={{ color: 'var(--accent)' }} />
            <span className="text-[13px]" style={{ color: 'var(--text2)' }}>AI 睇緊你啲嘢食…（約 3-5 秒）</span>
          </div>
        )}

        {phase === 'error' && (
          <div className="rounded-xl px-4 py-3 text-center text-[13px] font-medium" style={{ backgroundColor: 'color-mix(in srgb, var(--red) 12%, transparent)', color: 'var(--red)' }}>
            {error}
            <div className="mt-3 flex justify-center gap-2">
              <button onClick={() => setPhase('input')} className="btn-press rounded-full px-4 py-1.5 text-[12px] font-semibold" style={{ backgroundColor: 'var(--surface2)', color: 'var(--accent)' }}>
                再試一次
              </button>
            </div>
          </div>
        )}

        {phase === 'result' && result && (
          <>
            {imagePreview && (
              <img src={imagePreview} alt="餐相" className="mb-3 h-28 w-full rounded-xl object-cover" style={{ backgroundColor: 'var(--surface2)' }} />
            )}
            {result.description && (
              <div className="mb-2 rounded-xl px-3 py-2 text-[13px] font-medium" style={{ backgroundColor: 'var(--surface2)', color: 'var(--text2)' }}>
                {result.description}
              </div>
            )}
            <div className="space-y-1">
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--surface2)' }}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{it.name}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text3)' }}>{it.portion}</div>
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={it.kcal}
                    onChange={(e) => updateItem(i, { kcal: Number(e.target.value) })}
                    className="tnum w-16 rounded-lg px-2 py-1 text-right text-[13px] font-semibold outline-none"
                    style={{ backgroundColor: 'var(--surface)', color: 'var(--accent)' }}
                  />
                  <span className="text-[10px]" style={{ color: 'var(--text3)' }}>kcal</span>
                  <button aria-label="刪除" onClick={() => removeItem(i)} className="btn-press flex h-7 w-7 items-center justify-center rounded-full" style={{ color: 'var(--red)' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between px-1">
              <span className="text-[12px]" style={{ color: 'var(--text3)' }}>AI 估算 ±20%，可手動改 kcal</span>
              <span className="tnum text-[17px] font-bold" style={{ color: 'var(--accent)' }}>{total} kcal</span>
            </div>
            <button
              onClick={confirm}
              disabled={!items.length}
              className="btn-press mt-3 w-full rounded-xl py-3 text-[15px] font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              加入{meal}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
