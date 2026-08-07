import { fmt } from '../lib/data.js'

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

export default function WeeklyChart({ days, budget }) {
  const n = days.length
  const maxVal = Math.max(budget, ...days.map((d) => d.kcal || 0), 1)
  const height = 180
  const padTop = 18

  // For 30/90-day views, show a sparse label every ~7 days to avoid clutter.
  const labelStep = n <= 7 ? 1 : Math.ceil(n / 7)

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {/* budget line */}
        <line
          x1="0" x2="100" y1={padTop + (1 - budget / maxVal) * (height - padTop - 10)}
          y2={padTop + (1 - budget / maxVal) * (height - padTop - 10)}
          stroke="var(--accent)"
          strokeWidth="0.5"
          strokeDasharray="1.5 1.2"
          opacity="0.7"
        />
        {days.map((d, i) => {
          const h = (d.kcal / maxVal) * (height - padTop - 10)
          const x = i * (100 / n) + 100 / n / 2 - 100 / n / 4
          const w = 100 / n / 2
          const color = !d.kcal
            ? 'var(--border)'
            : d.kcal > budget
              ? 'var(--red)'
              : d.kcal > budget * 0.8
                ? 'var(--orange)'
                : 'var(--green)'
          return (
            <g key={d.key}>
              <rect
                x={x}
                y={padTop + (height - padTop - 10) - h}
                width={w}
                height={Math.max(h, d.kcal ? 2 : 3)}
                rx="1"
                fill={color}
                opacity={d.kcal ? 0.9 : 0.35}
              />
            </g>
          )
        })}
      </svg>
      <div className="mt-1 grid text-center" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {days.map((d, i) => (
          <div key={d.key} className="flex flex-col items-center gap-0.5">
            {n <= 7 ? (
              <>
                <span className="tnum text-[11px] font-semibold" style={{ color: d.isToday ? 'var(--accent)' : 'var(--text2)' }}>
                  {d.date.getDate()}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text3)' }}>
                  {WEEKDAY[d.date.getDay()]}
                </span>
                <span className="tnum text-[10px] font-medium" style={{ color: d.kcal ? (d.kcal > budget ? 'var(--red)' : 'var(--text2)') : 'var(--text3)' }}>
                  {d.kcal ? fmt(d.kcal) : '—'}
                </span>
              </>
            ) : i % labelStep === 0 || d.isToday ? (
              <span className="tnum text-[9px] font-medium" style={{ color: d.isToday ? 'var(--accent)' : 'var(--text3)' }}>
                {d.date.getMonth() + 1}/{d.date.getDate()}
              </span>
            ) : (
              <span className="text-[9px]" style={{ color: 'transparent' }}>·</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
