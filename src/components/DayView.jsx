import ProgressRing from './ProgressRing.jsx'
import MealList from './MealList.jsx'
import MacroBars from './MacroBars.jsx'

export default function DayView({ day, budget, macros, macroTargets, emptyText = '今日未有記錄' }) {
  const total = day?.total || 0
  const meals = day?.meals || []
  const remaining = budget - total

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="group-list flex flex-col items-center px-4 py-6">
        <ProgressRing total={total} budget={budget} />
        <div className="mt-4 grid w-full grid-cols-3 text-center">
          <div>
            <div className="tnum text-[17px] font-bold">{Math.round((total / budget) * 100)}%</div>
            <div className="text-[11px]" style={{ color: 'var(--text3)' }}>已用預算</div>
          </div>
          <div className="stat-divider">
            <div className="tnum text-[17px] font-bold" style={{ color: remaining >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {remaining >= 0 ? remaining.toLocaleString('en-US') : '+' + Math.abs(remaining).toLocaleString('en-US')}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text3)' }}>{remaining >= 0 ? '剩餘' : '超出'}</div>
          </div>
          <div className="stat-divider">
            <div className="tnum text-[17px] font-bold">{meals.length}</div>
            <div className="text-[11px]" style={{ color: 'var(--text3)' }}>餐數</div>
          </div>
        </div>
      </div>

      {/* Macros */}
      {macros && macroTargets && <MacroBars macros={macros} targets={macroTargets} />}

      {/* Meals */}
      <div className="flex items-center justify-between px-1">
        <h2 className="large-title !text-[22px] font-bold">飲食明細</h2>
      </div>
      <MealList meals={meals} />
      {!meals.length && (
        <div className="px-4 text-center text-[12px]" style={{ color: 'var(--text3)' }}>
          {emptyText}
        </div>
      )}
    </div>
  )
}
