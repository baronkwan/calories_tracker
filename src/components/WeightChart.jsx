// Weight trend line chart.
//
// Weight is a LEVEL, not a quantity: it only moves by a few kg, so a 0-based axis
// (what the calorie bars need) would flatten every trend into a straight line. The
// Y range therefore zooms to the data with a little padding, snapped to 0.5 kg.
//
// One dot = one weigh-in. X is spaced evenly by measurement index (weigh-ins are
// sparse and irregular, so index spacing keeps the line readable); the dates are
// labelled underneath and the exact kg values on the first/last points.
const AXIS_W = 34
const PAD_TOP = 16
const PAD_BOTTOM = 6
const MAX_POINTS = 24

const fmtKg = (v) => (Math.round(v * 10) / 10).toFixed(1)
const fmtDate = (d) => d.slice(5).replace('-', '/')

export default function WeightChart({ log = [], goal = 'maintain', height = 150 }) {
  const all = [...log].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const pts = all.slice(-MAX_POINTS)
  const n = pts.length
  if (!n) return null

  const kgs = pts.map((p) => Number(p.kg))
  const min = Math.min(...kgs)
  const max = Math.max(...kgs)
  const span = Math.max(max - min, 1) // never zoom tighter than a 1 kg window
  const pad = Math.max(span * 0.2, 0.4)
  const lo = Math.floor((min - pad) * 2) / 2
  const hi = Math.ceil((max + pad) * 2) / 2
  const plotH = height - PAD_TOP - PAD_BOTTOM
  const yOf = (kg) => PAD_TOP + (1 - (kg - lo) / (hi - lo)) * plotH
  const xOf = (i) => (n === 1 ? 50 : (i / (n - 1)) * 100)

  const ticks = [hi, (hi + lo) / 2, lo]
  const first = pts[0]
  const last = pts[n - 1]
  const delta = n > 1 ? last.kg - first.kg : 0
  const avg = kgs.reduce((s, v) => s + v, 0) / n

  // Direction is judged against the goal: on a cut a falling line is green.
  const flat = Math.abs(delta) < 0.05
  const good = goal === 'lose' ? delta < 0 : goal === 'gain' ? delta > 0 : Math.abs(delta) <= 0.5
  const deltaColor = flat ? 'var(--text3)' : good ? 'var(--green)' : 'var(--red)'
  const xLabelIdx = n <= 4 ? pts.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1]

  return (
    <div>
      <div className="relative" style={{ height }}>
        {/* Y axis ticks + gridlines */}
        {ticks.map((t, i) => (
          <div key={`t${i}`}>
            <div
              className="tnum absolute text-right text-[10px] leading-none"
              style={{ top: yOf(t), left: 0, width: AXIS_W - 6, transform: 'translateY(-50%)', color: 'var(--text3)' }}
            >
              {fmtKg(t)}
            </div>
            <div
              className="pointer-events-none absolute border-t border-dashed"
              style={{ top: yOf(t), left: AXIS_W, right: 0, borderColor: 'var(--border)' }}
            />
          </div>
        ))}

        {/* Plot area: x is a percentage of the width, y is already in px */}
        <div className="absolute inset-y-0" style={{ left: AXIS_W, right: 4, paddingLeft: 4, paddingRight: 4 }}>
          <svg width="100%" height={height}>
            {pts.slice(1).map((p, i) => (
              <line
                key={`l${i}`}
                x1={`${xOf(i)}%`}
                y1={yOf(pts[i].kg)}
                x2={`${xOf(i + 1)}%`}
                y2={yOf(p.kg)}
                stroke="var(--accent)"
                strokeWidth={2}
                strokeLinecap="round"
              />
            ))}
            {n <= 16 &&
              pts.map((p, i) => (
                <circle
                  key={`d${i}`}
                  cx={`${xOf(i)}%`}
                  cy={yOf(p.kg)}
                  r={3.5}
                  fill="var(--accent)"
                  stroke="var(--surface)"
                  strokeWidth={1.5}
                />
              ))}
          </svg>

          {/* Latest value chip — sits left of the point so it never clips the edge */}
          <div
            className="tnum absolute rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
            style={{
              left: `${xOf(n - 1)}%`,
              top: yOf(last.kg),
              transform: 'translate(-100%, -150%)',
              marginLeft: -4,
              backgroundColor: 'var(--accent)',
            }}
          >
            {fmtKg(last.kg)}
          </div>
        </div>
      </div>

      {/* X axis dates */}
      <div className="relative mt-1 h-4" style={{ marginLeft: AXIS_W }}>
        {xLabelIdx.map((i) => (
          <span
            key={`x${i}`}
            className="tnum absolute text-[10px]"
            style={{
              left: `${xOf(i)}%`,
              transform: i === 0 ? 'none' : i === n - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
              color: 'var(--text3)',
            }}
          >
            {fmtDate(String(pts[i].date))}
          </span>
        ))}
      </div>

      {/* Summary: latest / change over the window / average */}
      <div className="mt-2 flex items-baseline justify-between text-[11px]" style={{ color: 'var(--text3)' }}>
        <span>
          最新 <span className="tnum font-semibold" style={{ color: 'var(--text)' }}>{fmtKg(last.kg)}</span> kg
        </span>
        <span>
          {n > 1 ? (
            <>
              期間變化{' '}
              <span className="tnum font-semibold" style={{ color: deltaColor }}>
                {delta > 0 ? '+' : ''}{fmtKg(delta)}
              </span>{' '}
              kg
            </>
          ) : (
            '只得一筆紀錄'
          )}
        </span>
        <span>
          平均 <span className="tnum font-semibold" style={{ color: 'var(--text2)' }}>{fmtKg(avg)}</span> kg
        </span>
      </div>
    </div>
  )
}
