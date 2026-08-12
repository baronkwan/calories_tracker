import ProgressRing from './ProgressRing.jsx'
import MealList from './MealList.jsx'
import MacroBars from './MacroBars.jsx'
import ExerciseList from './ExerciseList.jsx'
import { Trash2 } from 'lucide-react'

export default function DayView({ day, budget, macros, macroTargets, exercises = [], emptyText = '今日未有記錄', onEditItem, onDeleteItem, onDeleteMeal, onDeleteDay, onAddExercise, onDeleteExercise }) {
  const total = day?.total || 0
  const meals = day?.meals || []
  const burn = (exercises || []).reduce((s, e) => s + (e.kcal || 0), 0)
  const net = total - burn
  const remaining = budget - net

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="group-list flex flex-col items-center px-4 py-6">
        <ProgressRing total={total} budget={budget} burn={burn} />
        <div className="mt-4 grid w-full grid-cols-4 text-center">
          <div>
            <div className="tnum text-[17px] font-bold">{Math.round((total / budget) * 100)}%</div>
            <div className="text-[11px]" style={{ color: 'var(--text3)' }}>已用預算</div>
          </div>
          <div className="stat-divider">
            <div className="tnum text-[17px] font-bold" style={{ color: remaining >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {remaining >= 0 ? remaining.toLocaleString('en-US') : '+' + Math.abs(remaining).toLocaleString('en-US')}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text3)' }}>{remaining >= 0 ? '淨剩餘' : '淨超出'}</div>
          </div>
          <div className="stat-divider">
            <div className="tnum text-[17px] font-bold">{meals.length}</div>
            <div className="text-[11px]" style={{ color: 'var(--text3)' }}>餐數</div>
          </div>
          <div className="stat-divider">
            <div className="tnum text-[17px] font-bold" style={{ color: 'var(--orange)' }}>{Math.round(burn).toLocaleString('en-US')}</div>
            <div className="text-[11px]" style={{ color: 'var(--text3)' }}>運動消耗</div>
          </div>
        </div>
      </div>

      {/* Macros */}
      {macros && macroTargets && <MacroBars macros={macros} targets={macroTargets} />}

      {/* Meals */}
      <div className="flex items-center justify-between px-1">
        <h2 className="large-title !text-[22px] font-bold">飲食明細</h2>
        {onDeleteDay && (day?.meals?.length || 0) > 0 && (
          <button
            onClick={() => onDeleteDay(day.date)}
            className="btn-press flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold"
            style={{ color: 'var(--red)', backgroundColor: 'color-mix(in srgb, var(--red) 10%, transparent)' }}
          >
            <Trash2 size={12} /> 刪除呢日
          </button>
        )}
      </div>
      <MealList
        meals={meals}
        onEditItem={(mi, ii) => onEditItem?.(day.date, mi, ii)}
        onDeleteItem={(mi, ii) => onDeleteItem?.(day.date, mi, ii)}
        onDeleteMeal={(mi) => onDeleteMeal?.(day.date, mi)}
      />
      {!meals.length && (
        <div className="px-4 text-center text-[12px]" style={{ color: 'var(--text3)' }}>
          {emptyText}
        </div>
      )}

      {/* Exercises */}
      <ExerciseList
        exercises={exercises}
        onAdd={onAddExercise}
        onDelete={onDeleteExercise ? (id) => onDeleteExercise(day.date, id) : undefined}
      />
    </div>
  )
}
