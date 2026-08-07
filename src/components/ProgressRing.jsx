export default function ProgressRing({ total, budget, size = 148, stroke = 11 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = budget > 0 ? Math.min(total / budget, 1) : 0
  const status = pct < 0.8 ? 'var(--green)' : pct <= 1 ? 'var(--orange)' : 'var(--red)'
  const label = pct < 0.8 ? '未超標' : pct <= 1 ? '接近預算' : '已超標'

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={status}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="tnum text-[34px] font-extrabold" style={{ letterSpacing: '-0.02em' }}>
          {Math.round(total).toLocaleString('en-US')}
        </div>
        <div className="text-[12px] font-medium" style={{ color: 'var(--text3)' }}>
          / {budget.toLocaleString('en-US')} kcal
        </div>
        <div className="mt-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: status, backgroundColor: `color-mix(in srgb, ${status} 14%, transparent)` }}>
          {label}
        </div>
      </div>
    </div>
  )
}
