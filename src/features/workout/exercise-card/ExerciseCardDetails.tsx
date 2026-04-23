import { Check, Minus, Plus, Trash2 } from 'lucide-react'
import type { PointerEvent } from 'react'

import { SetType } from '~/enums/enums'
import { formatTimedValue } from '~/features/workout/workout.formatting'

import { ExerciseCardMetaPane } from './ExerciseCardMetaPane'
import { ExerciseCardTargetEditor } from './ExerciseCardTargetEditor'
import { ExerciseCardValueStepper } from './ExerciseCardValueStepper'
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
  onSetConfirmingDelete: (value: boolean) => void
  onSetGoalDraft: (value: number | ((current: number) => number)) => void
  onSetTargetDraft: (value: string) => void
  onSetType: (value: SetType) => void
  onToggleCategory: (categoryId: string) => void
  onUpdateWeeklyGoal: (
    weeklySetGoal: number | null,
    setTargetValue: number | null,
    preferredSetType: SetType,
  ) => void
  orderedCategoryIds: string[]
  setTargetDraft: string
  setTargetPreview: string | null
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
  onSetTargetDraft,
  onSetType,
  onToggleCategory,
  onUpdateWeeklyGoal,
  orderedCategoryIds,
  setTargetDraft,
  setTargetPreview,
  setType,
  stats,
  tempValue,
  weekSetsDone,
  weeklySetGoal,
}: ExerciseCardDetailsProps) {
  const isTimed = setType === SetType.TIMED
  const smallStep = isTimed ? 5 : 1
  const largeStep = isTimed ? 30 : 5
  const tempValueLabel = isTimed ? formatTimedValue(tempValue) : String(tempValue)

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.95fr)]">
      <div className="space-y-3">
        <section className="rounded-[1.25rem] border border-white/8 bg-[#161d26]/92 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">
                Weekly rhythm
              </div>
              <div className="mt-1 text-sm font-black text-slate-100">
                {weekSetsDone} set{weekSetsDone === 1 ? '' : 's'} logged
              </div>
            </div>
            <div className="rounded-full border border-orange-400/15 bg-orange-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-orange-300">
              {hasWeeklyGoal ? `${weekSetsDone} / ${weeklySetGoal}` : 'No goal'}
            </div>
          </div>
          {hasWeeklyGoal ? (
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-orange-500 transition-all"
                style={{ width: `${goalProgressPct}%` }}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/8 px-3 py-2 text-[10px] font-bold text-slate-500">
              No weekly goal set yet
            </div>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-stretch">
            <div className="rounded-2xl border border-white/6 bg-[#202834]/85 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Sets this week
                  </div>
                  <div className="mt-1 font-mono text-xl font-black text-white">{goalDraft}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      onSetGoalDraft((value) => Math.max(1, value - 1))
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/8 bg-white/6 text-slate-200 transition-colors hover:bg-white/10"
                  >
                    <Minus size={14} />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      onSetGoalDraft((value) => value + 1)
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/8 bg-white/6 text-slate-200 transition-colors hover:bg-white/10"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
            <div className="grid gap-2 sm:w-36">
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  onUpdateWeeklyGoal(goalDraft, null, setType)
                }}
                className="flex h-10 items-center justify-center rounded-2xl bg-orange-500 px-3 text-[9px] font-black uppercase tracking-[0.2em] text-white shadow-[0_10px_24px_rgba(249,115,22,0.22)]"
              >
                Save goal
              </button>
              {weeklySetGoal !== null && (
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    onUpdateWeeklyGoal(null, null, setType)
                  }}
                  className="flex h-10 items-center justify-center rounded-2xl border border-white/8 bg-[#202834]/85 px-3 text-[9px] font-black uppercase tracking-[0.2em] text-slate-300"
                >
                  Clear goal
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[1.25rem] border border-white/8 bg-[#161d26]/92 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">
                Set plan
              </div>
              <div className="mt-1 text-sm font-black text-slate-100">
                Choose how this exercise should be logged
              </div>
            </div>
          </div>
          <div className="flex overflow-hidden rounded-2xl border border-white/8 bg-[#202834]/85 p-1">
            <button
              onClick={(event) => {
                event.stopPropagation()
                onSetType(SetType.REPS)
              }}
              className={`rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-[0.2em] transition-all ${
                setType === SetType.REPS
                  ? 'bg-orange-500 text-white shadow-[0_8px_18px_rgba(249,115,22,0.22)]'
                  : 'text-slate-400'
              }`}
            >
              Reps
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation()
                onSetType(SetType.TIMED)
              }}
              className={`rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-[0.2em] transition-all ${
                setType === SetType.TIMED
                  ? 'bg-orange-500 text-white shadow-[0_8px_18px_rgba(249,115,22,0.22)]'
                  : 'text-slate-400'
              }`}
            >
              Time
            </button>
          </div>
        </section>

        <ExerciseCardTargetEditor
          clearLabel="Clear"
          inputLabel={isTimed ? 'Target time per set (seconds)' : 'Target reps per set'}
          inputValue={setTargetDraft}
          onChange={onSetTargetDraft}
          onClear={() => onUpdateWeeklyGoal(weeklySetGoal, null, setType)}
          onSave={() =>
            onUpdateWeeklyGoal(
              weeklySetGoal,
              Number.isFinite(Number(setTargetDraft)) && Number(setTargetDraft) > 0
                ? Math.round(Number(setTargetDraft))
                : null,
              setType,
            )
          }
          previewLabel={setTargetPreview}
          saveLabel="Set"
        />

        <section className="rounded-[1.25rem] border border-white/8 bg-[#161d26]/92 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">
                Log next set
              </div>
              <div className="mt-1 text-sm font-black text-slate-100">
                {isTimed ? 'Adjust time and save the set' : 'Adjust reps and save the set'}
              </div>
            </div>
            <div className="rounded-full border border-white/8 bg-[#202834]/85 px-3 py-1 text-[10px] font-black text-slate-100">
              {tempValueLabel}
            </div>
          </div>
          <ExerciseCardValueStepper
            centerWidthClassName="w-20 sm:w-24"
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

          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <button
              onClick={(event) => (
                event.stopPropagation(),
                onAdd({ type: setType, value: tempValue })
              )}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 shadow-[0_14px_28px_rgba(249,115,22,0.24)] transition-transform active:translate-y-[1px]"
            >
              <Check size={14} className="text-white" strokeWidth={3} />
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white">
                Log set
              </span>
            </button>

            <button
              onClick={(event) => {
                event.stopPropagation()
                onSetConfirmingDelete(true)
              }}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-red-500/25 bg-red-500/6 px-4 text-[9px] font-black uppercase tracking-[0.2em] text-red-300 transition-colors hover:bg-red-500/10"
            >
              <Trash2 size={12} />
              Remove
            </button>
          </div>
        </section>
      </div>

      <ExerciseCardMetaPane
        allCategories={allCategories}
        categoryIds={categoryIds}
        onToggleCategory={onToggleCategory}
        orderedCategoryIds={orderedCategoryIds}
        stats={stats}
      />
    </div>
  )
}
