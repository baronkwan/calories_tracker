export default function MacroBars({ macros, targets }) {
  const rows = [
    { key: 'p', label: '蛋白質', grams: macros.p, target: targets.proteinG, color: 'var(--orange)' },
    { key: 'c', label: '碳水', grams: macros.c, target: targets.carbG, color: 'var(--teal)' },
    { key: 'f', label: '脂肪', grams: macros.f, target: targets.fatG, color: 'var(--accent)' },
  ]

  return (
    <div className="group-list px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[15px] font-semibold">巨量營養</span>
        <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
          目標：P {targets.proteinG}g / C {targets.carbG}g / F {targets.fatG}g
        </span>
      </div>
      <div className="space-y-3">
        {rows.map((r) => {
          const pct = r.target > 0 ? Math.min(r.grams / r.target, 1) : 0
          const over = r.target > 0 && r.grams > r.target
          return (
            <div key={r.key}>
              <div className="mb-1 flex items-baseline justify-between text-[12px]">
                <span className="font-medium" style={{ color: 'var(--text2)' }}>{r.label}</span>
                <span className="tnum font-semibold" style={{ color: over ? 'var(--red)' : 'var(--text)' }}>
                  {Math.round(r.grams)}<span className="text-[10px] font-medium" style={{ color: 'var(--text3)' }}> / {r.target}g</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--surface2)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct * 100}%`,
                    backgroundColor: r.color,
                    opacity: over ? 0.85 : 1,
                    transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
