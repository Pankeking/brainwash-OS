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

export function ExerciseCardMetaPane({
  allCategories,
  categoryIds,
  onToggleCategory,
  orderedCategoryIds,
  stats,
}: ExerciseCardMetaPaneProps) {
  return (
    <div className="min-w-full snap-start pl-1">
      <div className="rounded-xl border border-slate-700 bg-[#1A1F26] p-3">
        <div className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
          Categories
        </div>
        {allCategories.length === 0 ? (
          <p className="mb-4 text-[9px] italic text-slate-600">
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
                  className="rounded-md border px-2 py-1 text-[9px] font-bold transition-all"
                  style={{
                    backgroundColor: isSelected ? `${category.color}ee` : `${category.color}22`,
                    borderColor: isSelected ? category.color : `${category.color}55`,
                    color: isSelected ? '#111827' : '#e2e8f0',
                  }}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span>{category.name}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
          Stats
        </div>
        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="text-[9px] font-black uppercase text-slate-500">Range</div>
          <div className="text-center text-[9px] font-black uppercase text-slate-500">Best</div>
          <div className="text-center text-[9px] font-black uppercase text-slate-500">
            Avg/Worst
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-[10px] font-black text-slate-300">Last 7d</div>
          <div className="text-center text-[11px] font-black text-green-400">
            {stats.week.best ?? '-'}
          </div>
          <div className="text-center text-[11px] font-black text-slate-300">
            {stats.week.avg ?? '-'} / {stats.week.worst ?? '-'}
          </div>
          <div className="text-[10px] font-black text-slate-300">Last 30d</div>
          <div className="text-center text-[11px] font-black text-green-400">
            {stats.month.best ?? '-'}
          </div>
          <div className="text-center text-[11px] font-black text-slate-300">
            {stats.month.avg ?? '-'} / {stats.month.worst ?? '-'}
          </div>
        </div>
      </div>
    </div>
  )
}
