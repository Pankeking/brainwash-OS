import { memo, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'

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

function ExerciseActionCard({
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
      className={`overflow-hidden rounded-[1.45rem] border border-white/8 transition-all duration-200 ${
        isExpanded
          ? 'bg-[linear-gradient(180deg,rgba(38,49,63,0.98),rgba(24,31,40,0.96))] p-3 shadow-[0_16px_34px_rgba(2,8,23,0.22)] ring-1 ring-orange-500/16'
          : 'bg-[linear-gradient(180deg,rgba(38,49,63,0.92),rgba(27,35,45,0.96))] p-3 shadow-[0_10px_22px_rgba(2,8,23,0.14)] hover:border-white/12 hover:bg-[linear-gradient(180deg,rgba(44,56,72,0.96),rgba(31,40,51,0.98))]'
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
          isExpanded ? 'mt-3 border-t border-white/8 pt-3 opacity-100' : 'max-h-0 opacity-0'
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

function areCategoryArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false
  }
  return left.every((value, index) => value === right[index])
}

function areCategoriesEqual(
  left: ExerciseActionCardProps['allCategories'],
  right: ExerciseActionCardProps['allCategories'],
) {
  if (left.length !== right.length) {
    return false
  }
  return left.every((category, index) => {
    const next = right[index]
    return category.id === next.id && category.name === next.name && category.color === next.color
  })
}

const MemoizedExerciseActionCard = memo(
  ExerciseActionCard,
  (prevProps, nextProps) =>
    prevProps.id === nextProps.id &&
    prevProps.name === nextProps.name &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.count === nextProps.count &&
    prevProps.preferredSetType === nextProps.preferredSetType &&
    prevProps.weeklySetGoal === nextProps.weeklySetGoal &&
    prevProps.setTargetValue === nextProps.setTargetValue &&
    prevProps.weekSetsDone === nextProps.weekSetsDone &&
    prevProps.stats.week.best === nextProps.stats.week.best &&
    prevProps.stats.week.avg === nextProps.stats.week.avg &&
    prevProps.stats.week.worst === nextProps.stats.week.worst &&
    prevProps.stats.month.best === nextProps.stats.month.best &&
    prevProps.stats.month.avg === nextProps.stats.month.avg &&
    prevProps.stats.month.worst === nextProps.stats.month.worst &&
    areCategoryArraysEqual(prevProps.categoryIds, nextProps.categoryIds) &&
    areCategoriesEqual(prevProps.allCategories, nextProps.allCategories),
)

export default MemoizedExerciseActionCard
