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
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <div
          className={`flex items-center justify-center rounded-2xl border border-white/6 shadow-inner transition-all ${
            isExpanded
              ? 'h-11 w-11 bg-[#161d26] text-orange-400'
              : 'h-9 w-9 bg-[#161d26] text-slate-400'
          }`}
        >
          <Dumbbell size={isExpanded ? 18 : 14} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          {isEditing ? (
            <input
              autoFocus
              className="w-full rounded-xl border border-orange-500 bg-[#161d26] px-3 py-2 text-[16px] font-bold text-slate-100 focus:outline-none md:text-sm"
              value={editName}
              onChange={(event) => onSetEditName(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) =>
                event.key === 'Enter' && (onRename(editName), onSetEditing(false))
              }
            />
          ) : (
            <>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <span
                    className={`block truncate font-black tracking-tight text-balance transition-all ${
                      isExpanded ? 'text-base text-slate-50' : 'text-sm text-slate-200'
                    }`}
                  >
                    {name}
                  </span>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {count > 0 && (
                      <span
                        className={`rounded-full border border-orange-400/15 bg-orange-500/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-orange-300 ${
                          isExpanded ? '' : 'mr-0.5'
                        }`}
                      >
                        {count} sets
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
                </div>
              </div>
              {isExpanded ? (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-xs">
                  <div className="rounded-2xl border border-white/6 bg-[#161d26]/90 px-3 py-2">
                    <div className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Weekly progress
                    </div>
                    <div className="mt-1 text-sm font-black text-slate-100">
                      {hasWeeklyGoal ? `${weekSetsDone} / ${weeklySetGoal}` : weekSetsDone}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/6 bg-[#161d26]/90 px-3 py-2">
                    <div className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Goal state
                    </div>
                    <div className="mt-1 text-sm font-black text-slate-100">
                      {hasWeeklyGoal ? `${goalProgressPct}%` : 'Not set'}
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="mt-0.5 flex flex-wrap gap-1">
                {!isExpanded && count > 0 && <span className="sr-only">{count} sets logged</span>}
              </div>
              {!isExpanded && (
                <div className="mt-2">
                  <div className="flex items-center justify-between gap-2 text-[8px] font-black uppercase tracking-widest">
                    <span className="text-slate-500">Weekly</span>
                    <span className={hasWeeklyGoal ? 'text-orange-400' : 'text-slate-500'}>
                      {hasWeeklyGoal ? `${weekSetsDone} / ${weeklySetGoal}` : `${weekSetsDone} / -`}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full border border-slate-700/40 bg-[#161d26]">
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

      <div className="ml-2 flex shrink-0 items-center gap-2">
        {isEditing ? (
          <button
            onClick={(event) => (event.stopPropagation(), onRename(editName), onSetEditing(false))}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-green-400/20 bg-green-400/10 text-green-400"
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
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/8 text-slate-100 transition-colors hover:bg-white/12"
            >
              <Edit2 size={12} />
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation()
                onToggleExpand()
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
                isExpanded
                  ? 'border-orange-400 bg-orange-500 text-white'
                  : 'border-white/10 bg-white/8 text-slate-100 hover:bg-white/12'
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
