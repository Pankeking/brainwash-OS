import { Check, ChevronDown, ChevronUp, Dumbbell, Edit2 } from 'lucide-react'

import type { ExerciseCardCategory } from './exercise-card.types'

interface ExerciseCardHeaderProps {
  categoryIds: string[]
  count: number
  editName: string
  hasWeeklyGoal: boolean
  isEditing: boolean
  isExpanded: boolean
  name: string
  onRename: (nextName: string) => void
  onSetEditName: (value: string) => void
  onSetEditing: (value: boolean) => void
  onToggleExpand: () => void
  orderedCategories: ExerciseCardCategory[]
  weekSetsDone: number
  weeklySetGoal: number | null
  goalProgressPct: number
}

export function ExerciseCardHeader({
  categoryIds,
  count,
  editName,
  goalProgressPct,
  hasWeeklyGoal,
  isEditing,
  isExpanded,
  name,
  onRename,
  onSetEditName,
  onSetEditing,
  onToggleExpand,
  orderedCategories,
  weekSetsDone,
  weeklySetGoal,
}: ExerciseCardHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 flex-1">
        <div
          className={`transition-all rounded-xl flex items-center justify-center shadow-inner ${
            isExpanded
              ? 'w-10 h-10 bg-[#1A1F26] text-orange-500'
              : 'w-8 h-8 bg-[#1A1F26] text-slate-400'
          }`}
        >
          <Dumbbell size={isExpanded ? 18 : 14} />
        </div>

        <div className="flex flex-col flex-1 leading-tight">
          {isEditing ? (
            <input
              autoFocus
              className="bg-[#1A1F26] border border-orange-500 rounded px-2 py-1 text-[16px] md:text-xs font-bold text-slate-100 focus:outline-none w-full"
              value={editName}
              onChange={(event) => onSetEditName(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) =>
                event.key === 'Enter' && (onRename(editName), onSetEditing(false))
              }
            />
          ) : (
            <>
              <span
                className={`font-black tracking-tight transition-all ${
                  isExpanded ? 'text-base text-slate-100' : 'text-sm text-slate-300'
                }`}
              >
                {name}
              </span>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {!isExpanded && count > 0 && (
                  <span className="mr-1 text-[8px] font-black uppercase tracking-widest text-orange-500">
                    {count} Sets
                  </span>
                )}
                {!isExpanded &&
                  orderedCategories
                    .filter((category) => categoryIds.includes(category.id))
                    .map((category) => (
                      <span
                        key={category.id}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                    ))}
              </div>
              {!isExpanded && (
                <div className="mt-1.5">
                  <div className="flex items-center justify-between gap-2 text-[8px] font-black uppercase tracking-widest">
                    <span className="text-slate-500">Weekly</span>
                    <span className={hasWeeklyGoal ? 'text-orange-400' : 'text-slate-500'}>
                      {hasWeeklyGoal ? `${weekSetsDone} / ${weeklySetGoal}` : `${weekSetsDone} / -`}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full border border-slate-700/40 bg-[#1A1F26]">
                    <div
                      className={`h-full transition-all ${hasWeeklyGoal ? 'bg-orange-500' : 'bg-slate-700'}`}
                      style={{ width: `${hasWeeklyGoal ? goalProgressPct : 100}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="ml-2 flex items-center gap-2">
        {isEditing ? (
          <button
            onClick={(event) => (event.stopPropagation(), onRename(editName), onSetEditing(false))}
            className="w-8 h-8 flex items-center justify-center text-green-400 bg-green-400/10 rounded-lg border border-green-400/20"
          >
            <Check size={16} />
          </button>
        ) : (
          <>
            <button
              onClick={(event) => {
                event.stopPropagation()
                onSetEditing(true)
              }}
              className="w-8 h-8 flex items-center justify-center text-slate-100 bg-white/10 rounded-lg border border-white/10"
            >
              <Edit2 size={12} />
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation()
                onToggleExpand()
              }}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${
                isExpanded
                  ? 'bg-orange-500 text-white border-orange-400'
                  : 'bg-white/10 text-slate-100 border-white/10'
              }`}
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
