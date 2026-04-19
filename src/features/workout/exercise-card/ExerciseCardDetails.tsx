import { Check, Minus, Plus, Trash2 } from 'lucide-react'
import type { PointerEvent } from 'react'

import { SetType } from '~/enums/enums'

import { ExerciseCardMetaPane } from './ExerciseCardMetaPane'
import { ExerciseCardValueStepper } from './ExerciseCardValueStepper'
import type { ExerciseCardCategory } from './exercise-card.types'

function formatTimedValue(value: number) {
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return `${minutes}m:${String(seconds).padStart(2, '0')}s`
}

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
  onSetConfirmingDelete: (value: boolean) => void
  onSetGoalDraft: (value: number | ((current: number) => number)) => void
  onSetVolumeGoalDraft: (value: number | ((current: number) => number)) => void
  onSetType: (value: SetType) => void
  onToggleCategory: (categoryId: string) => void
  onUpdateWeeklyGoal: (
    weeklySetGoal: number | null,
    weeklyVolumeGoal: number | null,
    preferredSetType: SetType,
  ) => void
  orderedCategoryIds: string[]
  setType: SetType
  stats: {
    week: { best: number | null; avg: number | null; worst: number | null }
    month: { best: number | null; avg: number | null; worst: number | null }
  }
  tempValue: number
  volumeGoalDraft: number
  weekSetsDone: number
  weekVolumeDone: number
  weeklySetGoal: number | null
  weeklyVolumeGoal: number | null
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
  onSetVolumeGoalDraft,
  onSetType,
  onToggleCategory,
  onUpdateWeeklyGoal,
  orderedCategoryIds,
  setType,
  stats,
  tempValue,
  volumeGoalDraft,
  weekSetsDone,
  weekVolumeDone,
  weeklySetGoal,
  weeklyVolumeGoal,
}: ExerciseCardDetailsProps) {
  const isTimed = setType === SetType.TIMED
  const smallStep = isTimed ? 5 : 1
  const largeStep = isTimed ? 30 : 5
  const volumeSmallStep = isTimed ? 15 : 5
  const volumeLargeStep = isTimed ? 60 : 25
  const tempValueLabel = isTimed ? formatTimedValue(tempValue) : String(tempValue)
  const weekVolumeDoneLabel = isTimed ? formatTimedValue(weekVolumeDone) : String(weekVolumeDone)
  const weeklyVolumeGoalLabel =
    weeklyVolumeGoal !== null
      ? isTimed
        ? formatTimedValue(weeklyVolumeGoal)
        : String(weeklyVolumeGoal)
      : null
  const volumeGoalDraftLabel = isTimed ? formatTimedValue(volumeGoalDraft) : String(volumeGoalDraft)

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
                    onUpdateWeeklyGoal(goalDraft, volumeGoalDraft, setType)
                  }}
                  className="ml-auto h-7 rounded-lg bg-orange-600 px-2.5 text-[9px] font-black uppercase tracking-widest"
                >
                  Save
                </button>
                {weeklySetGoal !== null && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      onUpdateWeeklyGoal(null, weeklyVolumeGoal, setType)
                    }}
                    className="h-7 rounded-lg bg-slate-700 px-2.5 text-[9px] font-black uppercase tracking-widest text-slate-300"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="mt-3 border-t border-slate-700/40 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {isTimed ? 'Weekly target time' : 'Weekly target reps'}
                  </div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-orange-400">
                    {weekVolumeDoneLabel}
                    {weeklyVolumeGoalLabel ? ` / ${weeklyVolumeGoalLabel}` : ''}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <ExerciseCardValueStepper
                    decrementLargeLabel={`-${volumeLargeStep}`}
                    decrementSmallLabel={`-${volumeSmallStep}`}
                    displayValue={volumeGoalDraftLabel}
                    incrementLargeLabel={`+${volumeLargeStep}`}
                    incrementSmallLabel={`+${volumeSmallStep}`}
                    onDecrementLarge={() =>
                      onSetVolumeGoalDraft((value) => Math.max(1, value - volumeLargeStep))
                    }
                    onDecrementSmall={() =>
                      onSetVolumeGoalDraft((value) => Math.max(1, value - volumeSmallStep))
                    }
                    onIncrementLarge={() =>
                      onSetVolumeGoalDraft((value) => value + volumeLargeStep)
                    }
                    onIncrementSmall={() =>
                      onSetVolumeGoalDraft((value) => value + volumeSmallStep)
                    }
                  />
                </div>
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
              {isTimed ? 'Time' : 'Reps'}
            </span>
            <ExerciseCardValueStepper
              centerWidthClassName="w-20"
              decrementLargeLabel={`-${largeStep}`}
              decrementLargeButtonProps={getHoldHandlers(-largeStep)}
              decrementSmallLabel={`-${smallStep}`}
              decrementSmallButtonProps={getHoldHandlers(-smallStep)}
              displayValue={tempValueLabel}
              incrementLargeLabel={`+${largeStep}`}
              incrementLargeButtonProps={getHoldHandlers(largeStep)}
              incrementSmallLabel={`+${smallStep}`}
              incrementSmallButtonProps={getHoldHandlers(smallStep)}
              onDecrementLarge={() => undefined}
              onDecrementSmall={() => undefined}
              onIncrementLarge={() => undefined}
              onIncrementSmall={() => undefined}
            />
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

        <ExerciseCardMetaPane
          allCategories={allCategories}
          categoryIds={categoryIds}
          onToggleCategory={onToggleCategory}
          orderedCategoryIds={orderedCategoryIds}
          stats={stats}
        />
      </div>
    </div>
  )
}
