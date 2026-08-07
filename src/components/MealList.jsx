import { Coffee, Croissant, Sandwich, MoonStar, Cookie, Pencil, Trash2 } from 'lucide-react'

const MEAL_ICONS = {
  早餐: Coffee,
  午餐: Sandwich,
  下午茶: Croissant,
  晚餐: MoonStar,
}

export default function MealList({ meals, onEditItem, onDeleteItem, onDeleteMeal }) {
  if (!meals || meals.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--text3)' }}>
        今日未有記錄 — 話俾 Jarvis 聽食咗咩
      </div>
    )
  }

  return (
    <div className="group-list">
      {meals.map((meal, i) => {
        const Icon = MEAL_ICONS[meal.name] || Cookie
        return (
          <div key={i} className="row">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon size={17} strokeWidth={2} style={{ color: 'var(--accent)' }} />
                <span className="text-[14px] font-semibold">{meal.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="tnum text-[14px] font-bold" style={{ color: 'var(--text)' }}>
                  {Math.round(meal.total).toLocaleString('en-US')}
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text3)' }}> kcal</span>
                </span>
                {onDeleteMeal && (
                  <button
                    aria-label={`刪除${meal.name}`}
                    onClick={() => onDeleteMeal(i)}
                    className="btn-press flex h-6 w-6 items-center justify-center rounded-full"
                    style={{ color: 'var(--text3)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-1.5 space-y-1">
              {meal.items.map((it, j) => (
                <div key={j} className="group flex items-center justify-between text-[13px]">
                  <span style={{ color: 'var(--text2)' }}>
                    {it.name}
                    {it.portion && it.portion !== '1' && (
                      <span className="ml-1 text-[11px]" style={{ color: 'var(--text3)' }}>×{it.portion}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="tnum shrink-0 pl-3" style={{ color: 'var(--text3)' }}>
                      {Math.round(it.kcal).toLocaleString('en-US')}
                    </span>
                    {onEditItem && (
                      <button
                        aria-label={`編輯${it.name}`}
                        onClick={() => onEditItem(i, j)}
                        className="btn-press flex h-6 w-6 items-center justify-center rounded-full"
                        style={{ color: 'var(--text3)' }}
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                    {onDeleteItem && (
                      <button
                        aria-label={`刪除${it.name}`}
                        onClick={() => onDeleteItem(i, j)}
                        className="btn-press flex h-6 w-6 items-center justify-center rounded-full"
                        style={{ color: 'var(--text3)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
