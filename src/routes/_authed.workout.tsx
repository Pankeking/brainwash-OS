import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { Chat, WeeklyCalendar, WorkoutTimers } from '~/components/components'
import { SetType } from '~/enums/enums'
import { dayKeyFromDateInTimeZone } from '~/server/dayKey'
import { getWorkoutDayFn, getWorkoutWeeklyCategoryStatsFn } from '~/server/workout'

import { WORKOUT_CATEGORY_COLORS, WORKOUT_TIME_ZONE } from '~/features/workout/workout.constants'
import { formatWorkoutDayLabel } from '~/features/workout/workout.format'
import { WorkoutCategoriesTab } from '~/features/workout/WorkoutCategoriesTab'
import { WorkoutExercisesTab } from '~/features/workout/WorkoutExercisesTab'
import { WorkoutHistoryTab } from '~/features/workout/WorkoutHistoryTab'
import { WorkoutTabBar } from '~/features/workout/WorkoutTabBar'
import type {
  WeeklyCategoryStatsData,
  WorkoutCategory,
  WorkoutExercise,
  WorkoutLog,
  WorkoutTab,
} from '~/features/workout/workout.types'
import { useWorkoutMutations } from '~/features/workout/useWorkoutMutations'

export const Route = createFileRoute('/_authed/workout')({
  loader: async () => {
    const selectedDay = dayKeyFromDateInTimeZone(new Date(), WORKOUT_TIME_ZONE)
    const [workoutDayData, weeklyStatsData] = await Promise.all([
      getWorkoutDayFn({ data: { selectedDay } }),
      getWorkoutWeeklyCategoryStatsFn({ data: { weeks: 4 } }),
    ])

    return {
      selectedDay,
      workoutDayData,
      weeklyStatsData,
    }
  },
  component: WorkoutView,
})

function WorkoutView() {
  const loaderData = Route.useLoaderData()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<WorkoutTab>('exercises')
  const [confirmDeleteSetId, setConfirmDeleteSetId] = useState<string | null>(null)
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null)
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [isAddingExercise, setIsAddingExercise] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newExerciseName, setNewExerciseName] = useState('')
  const [selectedDay, setSelectedDay] = useState(loaderData.selectedDay)
  const [timerAutoStartToken, setTimerAutoStartToken] = useState(0)
  const [weeksToShow, setWeeksToShow] = useState(4)

  const focusRunningStopwatch = () => {
    setActiveTab('time')
    setTimerAutoStartToken((current) => current + 1)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['workout-day', selectedDay],
    queryFn: () => getWorkoutDayFn({ data: { selectedDay } }),
    initialData: selectedDay === loaderData.selectedDay ? loaderData.workoutDayData : undefined,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const { data: weeklyStatsData, isLoading: isWeeklyStatsLoading } =
    useQuery<WeeklyCategoryStatsData>({
      queryKey: ['workout-weekly-category-stats', weeksToShow],
      queryFn: () => getWorkoutWeeklyCategoryStatsFn({ data: { weeks: weeksToShow } }),
      initialData: weeksToShow === 4 ? loaderData.weeklyStatsData : undefined,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    })

  const categories: WorkoutCategory[] = data?.categories || []
  const exercises: WorkoutExercise[] = data?.exercises || []
  const logs: WorkoutLog[] = data?.logs || []

  const {
    addCategoryMutation,
    addExerciseMutation,
    addSetMutation,
    cycleCategoryColor,
    invalidateWeeklyStats,
    refreshWorkoutDay,
    removeCategoryMutation,
    removeExerciseMutation,
    removeSetMutation,
    renameExerciseMutation,
    toggleExerciseCategoryMutation,
    updateExerciseWeeklyGoalMutation,
  } = useWorkoutMutations({
    onAddedCategory: () => {
      setNewCategoryName('')
      setIsAddingCategory(false)
    },
    onAddedExercise: () => {
      setNewExerciseName('')
      setIsAddingExercise(false)
    },
    onRemovedSet: () => {
      setConfirmDeleteSetId(null)
    },
    onStartStopwatch: focusRunningStopwatch,
    queryClient,
    selectedDay,
    weeksToShow,
  })

  const handleAddCategory = () => {
    const trimmedName = newCategoryName.trim()
    if (!trimmedName) {
      return
    }

    const color = WORKOUT_CATEGORY_COLORS[categories.length % WORKOUT_CATEGORY_COLORS.length].hex
    addCategoryMutation.mutate({
      data: {
        name: trimmedName,
        color,
      },
    })
  }

  const handleAddExercise = () => {
    const trimmedName = newExerciseName.trim()
    if (!trimmedName) {
      return
    }

    addExerciseMutation.mutate({
      data: {
        selectedDay,
        name: trimmedName,
      },
    })
  }

  const handleAddSet = (exercise: WorkoutExercise, payload: { type: SetType; value: number }) => {
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

  const handleAssistantWorkoutChanged = (nextSelectedDay: string) => {
    setSelectedDay(nextSelectedDay)
    focusRunningStopwatch()
    void refreshWorkoutDay(nextSelectedDay)
    void invalidateWeeklyStats()
  }

  const filteredLogs = useMemo(() => logs.slice().reverse(), [logs])

  const logCountByExercise = useMemo(() => {
    const counts = new Map<string, number>()
    for (const log of filteredLogs) {
      counts.set(log.exerciseId, (counts.get(log.exerciseId) || 0) + 1)
    }
    return counts
  }, [filteredLogs])

  const latestLogTimestampByExercise = useMemo(() => {
    const timestamps = new Map<string, number>()
    for (const log of logs) {
      const timestamp = new Date(log.timestamp).getTime()
      const previousTimestamp = timestamps.get(log.exerciseId) || 0
      if (timestamp > previousTimestamp) {
        timestamps.set(log.exerciseId, timestamp)
      }
    }
    return timestamps
  }, [logs])

  const sortedExercises = useMemo(() => {
    const hasGoal = (exercise: WorkoutExercise) =>
      exercise.weeklySetGoal !== null && exercise.weeklySetGoal > 0
    const isGoalCompleted = (exercise: WorkoutExercise) =>
      hasGoal(exercise) && exercise.weekSetsDone >= (exercise.weeklySetGoal || 0)
    const isBottomPriority = (exercise: WorkoutExercise) =>
      !hasGoal(exercise) || isGoalCompleted(exercise)

    return exercises.slice().sort((left, right) => {
      const leftBottomPriority = isBottomPriority(left)
      const rightBottomPriority = isBottomPriority(right)
      if (leftBottomPriority !== rightBottomPriority) {
        return leftBottomPriority ? 1 : -1
      }

      const leftLastLog = latestLogTimestampByExercise.get(left.id) || 0
      const rightLastLog = latestLogTimestampByExercise.get(right.id) || 0
      if (leftLastLog !== rightLastLog) {
        return rightLastLog - leftLastLog
      }

      return left.name.localeCompare(right.name)
    })
  }, [exercises, latestLogTimestampByExercise])

  return (
    <div className="min-h-screen bg-[#1A1F26] text-slate-100 p-5 font-sans pb-32">
      <header className="flex justify-between items-center mb-6 pt-2">
        <Link to="/" className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
          <ChevronLeft size={24} />
        </Link>
        <div className="bg-[#2A333E] px-3 py-1 rounded-md text-[10px] font-black tracking-widest border border-slate-700 uppercase text-slate-400">
          {formatWorkoutDayLabel(selectedDay)}
        </div>
      </header>

      <WeeklyCalendar selectedDay={selectedDay} onSelectDay={setSelectedDay} />
      <WorkoutTabBar activeTab={activeTab} onChange={setActiveTab} />

      {isLoading ? (
        <div className="text-slate-400 text-center py-10 text-sm">Loading workout data...</div>
      ) : (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className={activeTab === 'time' ? 'block' : 'hidden'}>
            <WorkoutTimers autoStartStopwatchToken={timerAutoStartToken} />
          </div>

          {activeTab === 'categories' && (
            <WorkoutCategoriesTab
              categories={categories}
              isAddingCategory={isAddingCategory}
              isWeeklyStatsLoading={isWeeklyStatsLoading}
              newCategoryName={newCategoryName}
              onAddCategory={handleAddCategory}
              onCycleCategoryColor={cycleCategoryColor}
              onRemoveCategory={(categoryId) =>
                removeCategoryMutation.mutate({
                  data: {
                    categoryId,
                  },
                })
              }
              onSetIsAddingCategory={setIsAddingCategory}
              onSetNewCategoryName={setNewCategoryName}
              onShowMoreWeeks={() => setWeeksToShow((current) => current + 4)}
              weeklyStatsData={weeklyStatsData}
            />
          )}

          {activeTab === 'exercises' && (
            <WorkoutExercisesTab
              categories={categories}
              expandedExerciseId={expandedExerciseId}
              isAddingExercise={isAddingExercise}
              logCountByExercise={logCountByExercise}
              newExerciseName={newExerciseName}
              onAddExercise={handleAddExercise}
              onAddSet={handleAddSet}
              onRemoveExercise={(exerciseId) =>
                removeExerciseMutation.mutate({
                  data: {
                    selectedDay,
                    exerciseId,
                  },
                })
              }
              onRenameExercise={(exerciseId, nextName) =>
                renameExerciseMutation.mutate({
                  data: {
                    exerciseId,
                    nextName,
                  },
                })
              }
              onSetExpandedExerciseId={setExpandedExerciseId}
              onSetIsAddingExercise={setIsAddingExercise}
              onSetNewExerciseName={setNewExerciseName}
              onToggleExerciseCategory={(exerciseId, categoryId) =>
                toggleExerciseCategoryMutation.mutate({
                  data: {
                    exerciseId,
                    categoryId,
                  },
                })
              }
              onUpdateExerciseWeeklyGoal={(exerciseId, weeklySetGoal) =>
                updateExerciseWeeklyGoalMutation.mutate({
                  data: {
                    exerciseId,
                    weeklySetGoal,
                  },
                })
              }
              sortedExercises={sortedExercises}
            />
          )}

          {activeTab === 'history' && (
            <WorkoutHistoryTab
              confirmDeleteSetId={confirmDeleteSetId}
              logs={filteredLogs}
              onConfirmDeleteSetId={setConfirmDeleteSetId}
              onRemoveSet={(logId) =>
                removeSetMutation.mutate({
                  data: {
                    selectedDay,
                    logId,
                  },
                })
              }
            />
          )}
        </section>
      )}

      <Chat
        context={{
          selectedDay,
          activeTab,
        }}
        onWorkoutDataChanged={handleAssistantWorkoutChanged}
      />
    </div>
  )
}
