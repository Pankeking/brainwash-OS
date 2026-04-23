import type { ExerciseCardCategory } from './exercise-card.types'

interface ExerciseCardMetaPaneProps {
  allCategories: ExerciseCardCategory[]
  categoryIds: string[]
  onToggleCategory: (categoryId: string) => void
  orderedCategoryIds: string[]
  stats: {
    week: { best: number | null; avg: number | null; worst: number | null }
    month: { best: number | null; avg: number | null; worst: number | null }
  }
}

function renderStatValue(value: number | null) {
  return value ?? '-'
}

export function ExerciseCardMetaPane({
  allCategories,
  categoryIds,
  onToggleCategory,
  orderedCategoryIds,
  stats,
}: ExerciseCardMetaPaneProps) {
  return (
    <div className="rounded-[1.25rem] border border-white/8 bg-[#161d26]/92 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="mb-2 text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">
        Categories
      </div>
      {allCategories.length === 0 ? (
        <p className="mb-4 rounded-2xl border border-dashed border-white/8 px-3 py-3 text-[10px] italic text-slate-500">
          Create categories above to tag this exercise
        </p>
      ) : (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {orderedCategoryIds.map((categoryId) => {
            const category = allCategories.find((item) => item.id === categoryId)
            if (!category) {
              return null
            }
            const isSelected = categoryIds.includes(category.id)
            return (
              <button
                key={category.id}
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleCategory(category.id)
                }}
                className="rounded-2xl border px-2.5 py-1.5 text-[10px] font-bold transition-all"
                style={{
                  backgroundColor: isSelected ? `${category.color}ee` : `${category.color}22`,
                  borderColor: isSelected ? category.color : `${category.color}55`,
                  color: isSelected ? '#111827' : '#e2e8f0',
                }}
              >
                <span>{category.name}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="mb-2 text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">
        Stats
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <div className="rounded-2xl border border-white/6 bg-[#202834]/85 p-2.5">
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
            Last 7d
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div>
              <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-500">
                Best
              </div>
              <div className="mt-1 text-sm font-black text-green-400">
                {renderStatValue(stats.week.best)}
              </div>
            </div>
            <div>
              <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-500">
                Avg
              </div>
              <div className="mt-1 text-sm font-black text-slate-100">
                {renderStatValue(stats.week.avg)}
              </div>
            </div>
            <div>
              <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-500">
                Worst
              </div>
              <div className="mt-1 text-sm font-black text-slate-300">
                {renderStatValue(stats.week.worst)}
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/6 bg-[#202834]/85 p-2.5">
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
            Last 30d
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div>
              <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-500">
                Best
              </div>
              <div className="mt-1 text-sm font-black text-green-400">
                {renderStatValue(stats.month.best)}
              </div>
            </div>
            <div>
              <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-500">
                Avg
              </div>
              <div className="mt-1 text-sm font-black text-slate-100">
                {renderStatValue(stats.month.avg)}
              </div>
            </div>
            <div>
              <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-500">
                Worst
              </div>
              <div className="mt-1 text-sm font-black text-slate-300">
                {renderStatValue(stats.month.worst)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
