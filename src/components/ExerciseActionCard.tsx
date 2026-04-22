import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'

import { SetType } from '~/enums/enums'
import { sortCategoriesByColor, sortCategoryIdsByColor } from '~/features/workout/workout.sorting'

import { ExerciseCardDeleteConfirm } from '~/features/workout/exercise-card/ExerciseCardDeleteConfirm'
import { ExerciseCardDetails } from '~/features/workout/exercise-card/ExerciseCardDetails'
import { ExerciseCardHeader } from '~/features/workout/exercise-card/ExerciseCardHeader'
import type { ExerciseActionCardProps } from '~/features/workout/exercise-card/exercise-card.types'
import { formatTimedValue } from '~/features/workout/workout.formatting'

function getInitialStoredValue(storageKey: string, fallback: number) {
  if (typeof window === 'undefined') {
    return fallback
  }
  const raw = window.localStorage.getItem(storageKey)
  if (!raw) {
    return fallback
  }
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.max(1, Math.round(parsed))
}

export default function ExerciseActionCard({
  id,
  name,
  categoryIds,
  allCategories,
  onAdd,
  onRemove,
  onRename,
  onToggleCategory,
  onUpdateWeeklyGoal,
  onToggleExpand,
  isExpanded,
  count,
  preferredSetType,
  weeklySetGoal,
  setTargetValue,
  weekSetsDone,
  stats,
}: ExerciseActionCardProps) {
  const repsStorageKey = useMemo(() => `workout-last-value:${id}:${SetType.REPS}`, [id])
  const timedStorageKey = useMemo(() => `workout-last-value:${id}:${SetType.TIMED}`, [id])
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [editName, setEditName] = useState(name)
  const [goalDraft, setGoalDraft] = useState(weeklySetGoal ?? 10)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [repsValue, setRepsValue] = useState(10)
  const [setTargetDraft, setSetTargetDraft] = useState(setTargetValue ? String(setTargetValue) : '')
  const [setType, setSetType] = useState(preferredSetType)
  const [storageReady, setStorageReady] = useState(false)
  const [timedValue, setTimedValue] = useState(30)

  const tempValue = setType === SetType.REPS ? repsValue : timedValue
  const hasWeeklyGoal = weeklySetGoal !== null && weeklySetGoal > 0
  const goalProgressPct =
    hasWeeklyGoal && weeklySetGoal
      ? Math.min(100, Math.round((weekSetsDone / weeklySetGoal) * 100))
      : 0
  const setTargetPreview =
    setTargetDraft && Number.isFinite(Number(setTargetDraft)) && Number(setTargetDraft) > 0
      ? setType === SetType.TIMED
        ? formatTimedValue(Math.round(Number(setTargetDraft)))
        : String(Math.round(Number(setTargetDraft)))
      : typeof setTargetValue === 'number'
        ? setType === SetType.TIMED
          ? formatTimedValue(setTargetValue)
          : String(setTargetValue)
        : null
  const orderedCategories = useMemo(() => sortCategoriesByColor(allCategories), [allCategories])
  const orderedCategoryIds = useMemo(
    () =>
      sortCategoryIdsByColor(
        allCategories.map((category) => category.id),
        allCategories,
      ),
    [allCategories],
  )

  const stopHold = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current)
      holdIntervalRef.current = null
    }
  }

  const updateCurrentValue = (delta: number) => {
    if (setType === SetType.REPS) {
      setRepsValue((current) => Math.max(1, current + delta))
      return
    }
    setTimedValue((current) => Math.max(1, current + delta))
  }

  const startHold = (delta: number) => {
    updateCurrentValue(delta)
    stopHold()
    holdTimeoutRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => {
        updateCurrentValue(delta)
      }, 90)
    }, 300)
  }

  const getHoldHandlers = (delta: number) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      startHold(delta)
    },
    onPointerUp: stopHold,
    onPointerLeave: stopHold,
    onPointerCancel: stopHold,
  })

  useEffect(() => {
    setRepsValue(getInitialStoredValue(repsStorageKey, 10))
    setTimedValue(getInitialStoredValue(timedStorageKey, 30))
    setStorageReady(true)
  }, [repsStorageKey, timedStorageKey])

  useEffect(() => {
    if (!storageReady || typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(repsStorageKey, String(repsValue))
  }, [repsStorageKey, repsValue, storageReady])

  useEffect(() => {
    if (!storageReady || typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(timedStorageKey, String(timedValue))
  }, [timedStorageKey, timedValue, storageReady])

  useEffect(() => () => stopHold(), [])

  useEffect(() => {
    setGoalDraft(weeklySetGoal ?? 10)
  }, [weeklySetGoal])

  useEffect(() => {
    setSetType(preferredSetType)
  }, [preferredSetType])

  useEffect(() => {
    setSetTargetDraft(setTargetValue ? String(setTargetValue) : '')
  }, [setTargetValue])

  return (
    <div
      onClick={() => !isExpanded && !isEditing && onToggleExpand(id)}
      className={`overflow-hidden rounded-2xl border-t border-white/5 transition-all duration-300 ${
        isExpanded
          ? 'p-3 bg-[#2A333E] shadow-[0_8px_0_0_#14181d] ring-1 ring-orange-500/30'
          : 'p-3 bg-[#2A333E] shadow-[0_4px_0_0_#14181d] hover:bg-[#323d4a]'
      }`}
    >
      <ExerciseCardHeader
        categoryIds={categoryIds}
        count={count}
        editName={editName}
        goalProgressPct={goalProgressPct}
        hasWeeklyGoal={hasWeeklyGoal}
        isEditing={isEditing}
        isExpanded={isExpanded}
        name={name}
        onRename={onRename}
        onSetEditName={setEditName}
        onSetEditing={setIsEditing}
        onToggleExpand={() => {
          onToggleExpand(id)
          setIsConfirmingDelete(false)
        }}
        orderedCategories={orderedCategories}
        weekSetsDone={weekSetsDone}
        weeklySetGoal={weeklySetGoal}
      />

      <div
        className={`transition-all duration-300 ${
          isExpanded
            ? 'mt-2 max-h-[680px] border-t border-slate-700/30 pt-2 opacity-100'
            : 'max-h-0 opacity-0'
        }`}
      >
        {isConfirmingDelete ? (
          <ExerciseCardDeleteConfirm
            name={name}
            onCancel={() => setIsConfirmingDelete(false)}
            onConfirm={onRemove}
          />
        ) : (
          <ExerciseCardDetails
            allCategories={allCategories}
            categoryIds={categoryIds}
            getHoldHandlers={getHoldHandlers}
            goalDraft={goalDraft}
            goalProgressPct={goalProgressPct}
            hasWeeklyGoal={hasWeeklyGoal}
            onAdd={onAdd}
            onSetConfirmingDelete={setIsConfirmingDelete}
            onSetGoalDraft={setGoalDraft}
            onSetTargetDraft={setSetTargetDraft}
            onSetType={setSetType}
            onToggleCategory={onToggleCategory}
            onUpdateWeeklyGoal={onUpdateWeeklyGoal}
            orderedCategoryIds={orderedCategoryIds}
            setTargetDraft={setTargetDraft}
            setTargetPreview={setTargetPreview}
            setType={setType}
            stats={stats}
            tempValue={tempValue}
            weekSetsDone={weekSetsDone}
            weeklySetGoal={weeklySetGoal}
          />
        )}
      </div>
    </div>
  )
}
