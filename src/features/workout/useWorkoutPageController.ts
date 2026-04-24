import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { SetType } from '~/enums/enums'
import { parseLocaleNumberInput } from '~/lib/number-input'

import { WORKOUT_CATEGORY_COLORS } from './workout.constants'
import {
  getBodyMetricsDayQueryOptions,
  getWorkoutDayQueryOptions,
  getWorkoutWeeklyCategoryStatsQueryOptions,
} from './workout.query-options'
import {
  buildLatestLogTimestampByExercise,
  buildLogCountByExercise,
  sortExercisesForDisplay,
} from './workout.sorting'
import type {
  BodyMetricsDayData,
  WeeklyCategoryStatsData,
  WorkoutCategory,
  WorkoutExercise,
  WorkoutLog,
  WorkoutTab,
} from './workout.types'
import { useBodyMetricMutations } from './useBodyMetricMutations'
import { useWorkoutCategoryMutations } from './useWorkoutCategoryMutations'
import { useWorkoutExerciseMutations } from './useWorkoutExerciseMutations'
import { useWorkoutSetMutations } from './useWorkoutSetMutations'

interface WorkoutLoaderData {
  selectedDay: string
}

type WorkoutDayQueryData = {
  categories: WorkoutCategory[]
  exercises: WorkoutExercise[]
  logs: WorkoutLog[]
}

export function useWorkoutPageController(loaderData: WorkoutLoaderData) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<WorkoutTab>('exercises')
  const [confirmDeleteSetId, setConfirmDeleteSetId] = useState<string | null>(null)
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null)
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [isAddingExercise, setIsAddingExercise] = useState(false)
  const [metricDrafts, setMetricDrafts] = useState<Record<string, string>>({})
  const [newBodyMetricKind, setNewBodyMetricKind] = useState<'weight' | 'size'>('size')
  const [newBodyMetricLabel, setNewBodyMetricLabel] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newExerciseName, setNewExerciseName] = useState('')
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'info' } | null>(null)
  const [selectedDay, setSelectedDay] = useState(loaderData.selectedDay)
  const [timerAutoStartToken, setTimerAutoStartToken] = useState(0)
  const [weeksToShow, setWeeksToShow] = useState(4)

  const focusRunningStopwatch = () => {
    setActiveTab('time')
    setTimerAutoStartToken((current) => current + 1)
  }

  const { data, isLoading } = useQuery<WorkoutDayQueryData>(getWorkoutDayQueryOptions(selectedDay))
  const { data: weeklyStatsData, isLoading: isWeeklyStatsLoading } =
    useQuery<WeeklyCategoryStatsData>(getWorkoutWeeklyCategoryStatsQueryOptions(weeksToShow))
  const { data: bodyMetricsData } = useQuery<BodyMetricsDayData>(
    getBodyMetricsDayQueryOptions(selectedDay),
  )

  const categories: WorkoutCategory[] = data?.categories || []
  const exercises: WorkoutExercise[] = data?.exercises || []
  const logs: WorkoutLog[] = data?.logs || []

  const { addCategoryMutation, cycleCategoryColor, removeCategoryMutation } =
    useWorkoutCategoryMutations({
      onAddedCategory: () => {
        setNewCategoryName('')
        setIsAddingCategory(false)
      },
      queryClient,
      selectedDay,
      weeksToShow,
    })
  const {
    addExerciseMutation,
    removeExerciseMutation,
    renameExerciseMutation,
    toggleExerciseCategoryMutation,
    updateExerciseWeeklyGoalMutation,
  } = useWorkoutExerciseMutations({
    onAddedExercise: () => {
      setNewExerciseName('')
      setIsAddingExercise(false)
    },
    queryClient,
    selectedDay,
    weeksToShow,
  })
  const { addSetMutation, removeSetMutation } = useWorkoutSetMutations({
    onRemovedSet: () => setConfirmDeleteSetId(null),
    onSetLogFailed: () =>
      setNotice({
        message: 'Set log failed. Timer kept running.',
        tone: 'error',
      }),
    queryClient,
    weeksToShow,
  })
  const {
    createMetricDefinitionMutation,
    removeMetricDefinitionMutation,
    removeMetricMutation,
    upsertMetricMutation,
  } = useBodyMetricMutations({
    queryClient,
    selectedDay,
  })

  const filteredLogs = useMemo(() => logs.slice().reverse(), [logs])
  const logCountByExercise = useMemo(() => buildLogCountByExercise(filteredLogs), [filteredLogs])
  const latestLogTimestampByExercise = useMemo(
    () => buildLatestLogTimestampByExercise(logs),
    [logs],
  )
  const sortedExercises = useMemo(
    () => sortExercisesForDisplay(exercises, categories, latestLogTimestampByExercise),
    [categories, exercises, latestLogTimestampByExercise],
  )

  const handleAddCategory = () => {
    const trimmedName = newCategoryName.trim()
    if (!trimmedName) {
      return
    }
    const color = WORKOUT_CATEGORY_COLORS[categories.length % WORKOUT_CATEGORY_COLORS.length].hex
    addCategoryMutation.mutate({ data: { name: trimmedName, color } })
  }

  const handleAddExercise = () => {
    const trimmedName = newExerciseName.trim()
    if (!trimmedName) {
      return
    }
    addExerciseMutation.mutate({ data: { selectedDay, name: trimmedName } })
  }

  const handleAddSet = (exercise: WorkoutExercise, payload: { type: SetType; value: number }) => {
    focusRunningStopwatch()
    setNotice(null)
    addSetMutation.mutate({
      data: {
        selectedDay,
        exerciseId: exercise.id,
        type: payload.type,
        reps: payload.type === SetType.REPS ? payload.value : undefined,
        duration: payload.type === SetType.TIMED ? payload.value : undefined,
      },
    })
  }

  const handleSaveMetric = (metricKey: string) => {
    const value = parseLocaleNumberInput(metricDrafts[metricKey] || '')
    if (value === null || !Number.isFinite(value) || value <= 0) {
      setNotice({
        message: 'Enter a valid body metric value first.',
        tone: 'error',
      })
      return
    }
    upsertMetricMutation.mutate({
      data: { selectedDay, metricKey, value },
    })
    setMetricDrafts((current) => ({
      ...current,
      [metricKey]: '',
    }))
    setNotice(null)
  }

  const handleCreateBodyMetricDefinition = () => {
    const label = newBodyMetricLabel.trim()
    if (!label) {
      setNotice({
        message: 'Enter a metric name first.',
        tone: 'error',
      })
      return
    }
    createMetricDefinitionMutation.mutate({
      data: {
        label,
        kind: newBodyMetricKind,
      },
    })
    setNewBodyMetricLabel('')
    setNotice(null)
  }

  const handleUpdateExerciseWeeklyGoal = (
    exerciseId: string,
    weeklySetGoal: number | null,
    setTargetValue: number | null,
    preferredSetType: SetType,
  ) => {
    updateExerciseWeeklyGoalMutation.mutate({
      data: {
        exerciseId,
        preferredSetType: preferredSetType === SetType.TIMED ? 'timed' : 'reps',
        weeklySetGoal,
        setTargetValue,
      },
    })
  }

  useEffect(() => {
    if (!notice) {
      return
    }
    const timeoutId = setTimeout(() => {
      setNotice(null)
    }, 4000)
    return () => clearTimeout(timeoutId)
  }, [notice])

  return {
    activeTab,
    bodyMetricsData,
    categories,
    confirmDeleteSetId,
    cycleCategoryColor,
    expandedExerciseId,
    filteredLogs,
    handleAddCategory,
    handleAddExercise,
    handleAddSet,
    handleSaveMetric,
    handleUpdateExerciseWeeklyGoal,
    isAddingCategory,
    isAddingExercise,
    isLoading,
    isWeeklyStatsLoading,
    logCountByExercise,
    metricDrafts,
    newCategoryName,
    newExerciseName,
    notice,
    onAssistantWorkoutChanged: (
      nextSelectedDay: string,
      changeKind: 'set' | 'body' | 'body-definition' = 'set',
    ) => {
      setSelectedDay(nextSelectedDay)
      if (changeKind === 'set') {
        focusRunningStopwatch()
      }
    },
    createMetricDefinitionMutation,
    removeCategoryMutation,
    removeExerciseMutation,
    removeMetricDefinitionMutation,
    removeMetricMutation,
    removeSetMutation,
    renameExerciseMutation,
    selectedDay,
    setActiveTab,
    setConfirmDeleteSetId,
    setExpandedExerciseId,
    setIsAddingCategory,
    setIsAddingExercise,
    setMetricDrafts,
    setNewBodyMetricKind,
    setNewBodyMetricLabel,
    setNewCategoryName,
    setNewExerciseName,
    setSelectedDay,
    setWeeksToShow,
    sortedExercises,
    timerAutoStartToken,
    toggleExerciseCategoryMutation,
    updateExerciseWeeklyGoalMutation,
    weeklyStatsData,
    handleCreateBodyMetricDefinition,
    newBodyMetricKind,
    newBodyMetricLabel,
  }
}
