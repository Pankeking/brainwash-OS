import { Check, Tag, X } from 'lucide-react'

import { WORKOUT_CATEGORY_COLORS } from './workout.constants'
import type { WeeklyCategoryStatsData, WorkoutCategory } from './workout.types'

interface WorkoutCategoriesTabProps {
  categories: WorkoutCategory[]
  isAddingCategory: boolean
  isWeeklyStatsLoading: boolean
  newCategoryName: string
  onAddCategory: () => void
  onCycleCategoryColor: (category: WorkoutCategory) => void
  onRemoveCategory: (categoryId: string) => void
  onSetIsAddingCategory: (value: boolean) => void
  onSetNewCategoryName: (value: string) => void
  onShowMoreWeeks: () => void
  weeklyStatsData?: WeeklyCategoryStatsData
}

export function WorkoutCategoriesTab({
  categories,
  isAddingCategory,
  isWeeklyStatsLoading,
  newCategoryName,
  onAddCategory,
  onCycleCategoryColor,
  onRemoveCategory,
  onSetIsAddingCategory,
  onSetNewCategoryName,
  onShowMoreWeeks,
  weeklyStatsData,
}: WorkoutCategoriesTabProps) {
  return (
    <>
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3 px-1">
          <h2 className="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase flex items-center gap-2">
            <Tag size={12} className="text-orange-500" /> Categories
          </h2>
          <button
            onClick={() => onSetIsAddingCategory(!isAddingCategory)}
            className="text-orange-500 text-[9px] font-black uppercase tracking-widest"
          >
            {isAddingCategory ? 'Cancel' : '+ New Category'}
          </button>
        </div>

        {isAddingCategory && (
          <div className="mb-4 animate-in zoom-in-95 duration-200">
            <div className="bg-[#2A333E] p-2 rounded-xl border border-orange-500/30 flex items-center gap-2">
              <input
                autoFocus
                placeholder="e.g. Upper Body"
                className="bg-transparent border-none focus:ring-0 text-[16px] md:text-xs font-bold text-white flex-1"
                value={newCategoryName}
                onChange={(event) => onSetNewCategoryName(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && onAddCategory()}
              />
              <button onClick={onAddCategory} className="p-1.5 bg-orange-500 rounded-lg">
                <Check size={14} />
              </button>
            </div>
          </div>
        )}

        {categories.length === 0 ? (
          <div className="px-1 py-4 border border-dashed border-slate-800 rounded-xl text-center">
            <p className="text-[8px] font-black uppercase text-slate-600 tracking-tighter">
              No categories created yet
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 px-1">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center gap-1.5 bg-[#2A333E] px-2 py-1 rounded-lg border border-slate-700 cursor-pointer"
                onClick={() => onCycleCategoryColor(category)}
                title={`Color: ${
                  WORKOUT_CATEGORY_COLORS.find((option) => option.hex === category.color)?.name ||
                  'Custom'
                }`}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
                <span className="text-[10px] font-bold text-slate-300">{category.name}</span>
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemoveCategory(category.id)
                  }}
                  className="ml-1 text-slate-600 hover:text-red-500"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-slate-600">
            <Tag size={12} />
            <h3 className="text-[10px] font-black uppercase tracking-widest">
              Weekly Category Sets
            </h3>
          </div>
          <button
            onClick={onShowMoreWeeks}
            className="text-[9px] font-black uppercase tracking-widest text-orange-400"
          >
            Load More Weeks
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          {isWeeklyStatsLoading ? (
            <div className="p-4 text-[10px] text-slate-400">Loading weekly category stats...</div>
          ) : (
            <table className="min-w-full text-[10px]">
              <thead>
                <tr className="bg-[#232a33]">
                  <th className="text-left px-3 py-2 text-slate-400 uppercase tracking-widest">
                    Category
                  </th>
                  {(weeklyStatsData?.weeks || []).map((week) => (
                    <th
                      key={week}
                      className="px-3 py-2 text-slate-400 uppercase tracking-widest whitespace-nowrap"
                    >
                      {week}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(weeklyStatsData?.rows || []).map((row) => (
                  <tr key={row.categoryId} className="border-t border-slate-800">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: row.color }}
                        />
                        <span className="text-slate-200 font-bold">{row.name}</span>
                      </div>
                    </td>
                    {row.counts.map((count, index) => (
                      <td
                        key={`${row.categoryId}-${index}`}
                        className="px-3 py-2 text-center text-slate-300"
                      >
                        {count}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
