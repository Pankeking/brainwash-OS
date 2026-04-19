import { Check, Minus, Plus, Trash2 } from 'lucide-react'
import type { PointerEvent } from 'react'

import { SetType } from '~/enums/enums'

import type { ExerciseCardCategory } from './exercise-card.types'

interface ExerciseCardDetailsProps {
  allCategories: ExerciseCardCategory[]
  categoryIds: string[]
  getHoldHandlers: (delta: number) => {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void
    onPointerUp: () => void
    onPointerLeave: () => void
    onPointerCancel: () => void
  }
  goalDraft: number
  goalProgressPct: number
  hasWeeklyGoal: boolean
  onAdd: (payload: { type: SetType; value: number }) => void
  onRemove: () => void
  onSetConfirmingDelete: (value: boolean) => void
  onSetGoalDraft: (value: number | ((current: number) => number)) => void
  onSetType: (value: SetType) => void
  onToggleCategory: (categoryId: string) => void
  onUpdateWeeklyGoal: (weeklySetGoal: number | null) => void
  orderedCategoryIds: string[]
  setType: SetType
  stats: {
    week: { best: number | null; avg: number | null; worst: number | null }
    month: { best: number | null; avg: number | null; worst: number | null }
  }
  tempValue: number
  weekSetsDone: number
  weeklySetGoal: number | null
}

export function ExerciseCardDetails({
  allCategories,
  categoryIds,
  getHoldHandlers,
  goalDraft,
  goalProgressPct,
  hasWeeklyGoal,
  onAdd,
  onSetConfirmingDelete,
  onSetGoalDraft,
  onSetType,
  onToggleCategory,
  onUpdateWeeklyGoal,
  orderedCategoryIds,
  setType,
  stats,
  tempValue,
  weekSetsDone,
  weeklySetGoal,
}: ExerciseCardDetailsProps) {
  return (
    <div className="overflow-x-auto snap-x snap-mandatory">
      <div className="flex w-full">
        <div className="min-w-full snap-start pr-1">
          <div className="mb-4">
            <span className="block mb-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
              Goal
            </span>
            <div className="rounded-xl border border-slate-700 bg-[#1A1F26] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Sets this calendar week
                </div>
                <div className="text-[9px] font-black uppercase tracking-widest text-orange-400">
                  {weekSetsDone}
                  {hasWeeklyGoal ? ` / ${weeklySetGoal}` : ''}
                </div>
              </div>
              {hasWeeklyGoal ? (
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-orange-500 transition-all"
                    style={{ width: `${goalProgressPct}%` }}
                  />
                </div>
              ) : (
                <div className="mt-2 text-[9px] font-bold text-slate-500">No weekly goal set</div>
              )}
              <div className="mt-2 flex items-center gap-1">
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    onSetGoalDraft((value) => Math.max(1, value - 1))
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#2A333E] text-slate-300"
                >
                  <Minus size={12} />
                </button>
                <div className="w-12 text-center font-mono text-sm font-black text-white">
                  {goalDraft}
                </div>
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    onSetGoalDraft((value) => value + 1)
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#2A333E] text-slate-300"
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    onUpdateWeeklyGoal(goalDraft)
                  }}
                  className="ml-auto h-7 rounded-lg bg-orange-600 px-2.5 text-[9px] font-black uppercase tracking-widest"
                >
                  Save
                </button>
                {weeklySetGoal !== null && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      onUpdateWeeklyGoal(null)
                    }}
                    className="h-7 rounded-lg bg-slate-700 px-2.5 text-[9px] font-black uppercase tracking-widest text-slate-300"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              Set Type
            </span>
            <div className="flex overflow-hidden rounded-lg border border-slate-700">
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  onSetType(SetType.REPS)
                }}
                className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest ${
                  setType === SetType.REPS
                    ? 'bg-orange-500 text-white'
                    : 'bg-[#1A1F26] text-slate-400'
                }`}
              >
                Reps
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  onSetType(SetType.TIMED)
                }}
                className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest ${
                  setType === SetType.TIMED
                    ? 'bg-orange-500 text-white'
                    : 'bg-[#1A1F26] text-slate-400'
                }`}
              >
                Time
              </button>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              {setType === SetType.REPS ? 'Reps' : 'Seconds'}
            </span>
            <div className="flex items-center gap-1 rounded-xl border border-slate-700 bg-[#1A1F26] p-0.5">
              <button
                {...getHoldHandlers(-5)}
                className="w-9 h-7 flex items-center justify-center rounded-lg bg-[#2A333E] text-[10px] font-black text-slate-300"
              >
                -5
              </button>
              <button
                {...getHoldHandlers(-1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#2A333E] text-slate-300"
              >
                <Minus size={12} />
              </button>
              <div className="w-12 text-center font-mono text-sm font-black text-white">
                {tempValue}
              </div>
              <button
                {...getHoldHandlers(1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#2A333E] text-slate-300"
              >
                <Plus size={12} />
              </button>
              <button
                {...getHoldHandlers(5)}
                className="w-9 h-7 flex items-center justify-center rounded-lg bg-[#2A333E] text-[10px] font-black text-slate-300"
              >
                +5
              </button>
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-4">
            <button
              onClick={(event) => (
                event.stopPropagation(),
                onAdd({ type: setType, value: tempValue })
              )}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-2.5 shadow-[0_3px_0_0_#9a3412] transition-all active:translate-y-1 active:shadow-none"
            >
              <Check size={14} className="text-white" strokeWidth={3} />
              <span className="text-[10px] font-black uppercase tracking-widest text-white">
                Log Set
              </span>
            </button>

            <button
              onClick={(event) => {
                event.stopPropagation()
                onSetConfirmingDelete(true)
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 py-2 text-[9px] font-black uppercase tracking-widest text-red-500 transition-all hover:bg-red-500/10"
            >
              <Trash2 size={12} />
              Remove from Bank
            </button>
          </div>
        </div>

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
                      {category.name}
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
      </div>
    </div>
  )
}
