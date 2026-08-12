export default function ProgressRing({ total, budget, burn = 0, size = 148, stroke = 11 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const intakePct = budget > 0 ? Math.min(total / budget, 1) : 0
  const burnPct = budget > 0 ? Math.min(burn / budget, 1) : 0
  const net = total - burn
  const netPctRaw = budget > 0 ? net / budget : 0

  // Arc color = how much of the budget was eaten (unchanged semantics).
  const intakeStatus = intakePct < 0.8 ? 'var(--green)' : intakePct <= 1 ? 'var(--orange)' : 'var(--red)'
  // Center chip = net result (exercise gives headroom).
  const status = netPctRaw < 0.8 ? 'var(--green)' : netPctRaw <= 1 ? 'var(--orange)' : 'var(--red)'
  const label = netPctRaw < 0.8 ? '未超標' : netPctRaw <= 1 ? '接近預算' : '已超標'

  // Burn arc = orange tail on the intake arc (the part that was burned off).
  const burnStart = Math.max(0, intakePct - burnPct) // fraction where orange starts
  const burnLen = intakePct - burnStart

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={intakeStatus}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - intakePct)}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)' }}
        />
        {burn > 0 && burnLen > 0.001 && (
          <g transform={`rotate(${burnStart * 360} ${size / 2} ${size / 2})`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="var(--orange)"
              strokeWidth={stroke}
              strokeDasharray={`${burnLen * c} ${c}`}
            />
          </g>
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="tnum text-[34px] font-extrabold" style={{ letterSpacing: '-0.02em' }}>
          {Math.round(net).toLocaleString('en-US')}
        </div>
        <div className="text-[12px] font-medium" style={{ color: 'var(--text3)' }}>
          / {budget.toLocaleString('en-US')} kcal
        </div>
        <div className="mt-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: status, backgroundColor: `color-mix(in srgb, ${status} 14%, transparent)` }}>
          {label}
        </div>
        {burn > 0 && (
          <div className="mt-1 flex items-center gap-1 text-[10px] font-medium" style={{ color: 'var(--text3)' }}>
            <span style={{ color: 'var(--orange)' }}>─ {Math.round(burn).toLocaleString('en-US')}</span> 運動
          </div>
        )}
      </div>
    </div>
  )
}
