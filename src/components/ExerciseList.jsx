import { Dumbbell, Footprints, Bike, Waves, Mountain, HeartPulse, Trash2, Plus } from 'lucide-react'
import { fmtDuration } from '../lib/exercises.js'

const TYPE_ICONS = {
  indoor_walk: Footprints,
  indoor_run: Footprints,
  walk: Footprints,
  run: Footprints,
  cycling: Bike,
  swimming: Waves,
  hiking: Mountain,
  hiit: HeartPulse,
}

export default function ExerciseList({ exercises, onDelete, onAdd }) {
  const total = (exercises || []).reduce((s, e) => s + (e.kcal || 0), 0)
  const totalMin = (exercises || []).reduce((s, e) => s + (e.duration_min || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between px-1">
        <h2 className="large-title !text-[22px] font-bold">運動明細</h2>
        {onAdd && (
          <button
            onClick={onAdd}
            className="btn-press flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold"
            style={{ color: 'var(--orange)', backgroundColor: 'color-mix(in srgb, var(--orange) 10%, transparent)' }}
          >
            <Plus size={12} /> 新增
          </button>
        )}
      </div>
      {(!exercises || exercises.length === 0) ? (
        <div className="px-4 py-6 text-center text-[12px]" style={{ color: 'var(--text3)' }}>
          未有運動記錄 — 按「新增」加入，或喺 iPhone 用捷徑匯入 Apple 健康
        </div>
      ) : (
        <div className="group-list">
          {exercises.map((e, i) => {
            const Icon = TYPE_ICONS[e.type] || Dumbbell
            return (
              <div key={e.id ?? i} className="row">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={16} strokeWidth={2} style={{ color: 'var(--orange)' }} />
                    <span className="text-[14px] font-semibold">{e.name}</span>
                    {e.source === 'apple_health' && (
                      <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ color: 'var(--teal)', backgroundColor: 'color-mix(in srgb, var(--teal) 12%, transparent)' }}>
                        Apple
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tnum text-[14px] font-bold" style={{ color: 'var(--orange)' }}>
                      {Math.round(e.kcal).toLocaleString('en-US')}
                      <span className="text-[11px] font-medium" style={{ color: 'var(--text3)' }}> kcal</span>
                    </span>
                    {onDelete && (
                      <button
                        aria-label={`刪除${e.name}`}
                        onClick={() => onDelete(e.id)}
                        className="btn-press flex h-6 w-6 items-center justify-center rounded-full"
                        style={{ color: 'var(--text3)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-1 text-[11px]" style={{ color: 'var(--text3)' }}>
                  {fmtDuration(e.duration_min)}
                </div>
              </div>
            )
          })}
          {(exercises?.length || 0) > 1 && (
            <div className="row flex items-center justify-between">
              <span className="text-[13px] font-semibold" style={{ color: 'var(--text2)' }}>全日總計</span>
              <span className="tnum text-[13px] font-bold" style={{ color: 'var(--orange)' }}>
                {Math.round(total).toLocaleString('en-US')} kcal
                <span className="ml-1 text-[11px] font-medium" style={{ color: 'var(--text3)' }}>· {fmtDuration(totalMin)}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
