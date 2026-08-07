import { dateKey } from '../lib/data.js'

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

export default function Heatmap({ monthDays, daysMap, budget, onSelect }) {
  const today = dateKey(new Date())

  return (
    <div>
      <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-medium" style={{ color: 'var(--text3)' }}>
        {WEEKDAY.map((w) => <div key={w}>{w}</div>)}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-2">
        {monthDays.map((d, i) => {
          if (!d) return <div key={`pad-${i}`} />
          const key = dateKey(d)
          const day = daysMap[key]
          const pct = day ? day.total / budget : 0
          let bg = 'var(--surface2)'
          if (day && day.total > 0) {
            bg = pct > 1 ? 'var(--red)' : pct > 0.8 ? 'var(--orange)' : 'var(--green)'
          }
          const isToday = key === today
          return (
            <button
              key={key}
              onClick={() => onSelect?.(d)}
              className="btn-press flex aspect-square flex-col items-center justify-center rounded-xl text-center"
              style={{
                backgroundColor: day ? `color-mix(in srgb, ${bg} ${day.total > 0 ? 88 : 20}%, transparent)` : 'var(--surface2)',
                border: isToday ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                color: day && day.total > 0 ? '#fff' : 'var(--text3)',
              }}
            >
              <span className="tnum text-[13px] font-bold leading-none">{d.getDate()}</span>
              {day && day.total > 0 && (
                <span className="tnum mt-0.5 text-[8.5px] font-semibold leading-none opacity-90">
                  {Math.round(day.total)}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px]" style={{ color: 'var(--text3)' }}>
        <span>少</span>
        {['var(--surface2)', 'var(--green)', 'var(--orange)', 'var(--red)'].map((c) => (
          <span key={c} className="h-2.5 w-2.5 rounded" style={{ backgroundColor: c, opacity: 0.8 }} />
        ))}
        <span>多</span>
      </div>
    </div>
  )
}
