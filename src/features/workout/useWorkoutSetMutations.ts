import { useMutation, type QueryClient } from '@tanstack/react-query'

import { SetType } from '~/enums/enums'
import { addWorkoutSetFn, removeWorkoutSetFn } from '~/server/workout'

import {
  getWorkoutDayQueryKey,
  getWorkoutWeeklyCategoryStatsQueryKey,
} from './workout.query-options'
import type { WorkoutDayData, WorkoutLog } from './workout.types'

type MutationContext = {
  previousData?: WorkoutDayData
}

interface UseWorkoutSetMutationsArgs {
  onRemovedSet: () => void
  onSetLogFailed: () => void
  queryClient: QueryClient
  userId: string
  weeksToShow: number
}

export function useWorkoutSetMutations({
  onRemovedSet,
  onSetLogFailed,
  queryClient,
  userId,
  weeksToShow,
}: UseWorkoutSetMutationsArgs) {
  const refreshWorkoutDay = async (dayKey: string) => {
    const queryKey = getWorkoutDayQueryKey(userId, dayKey)
    await queryClient.invalidateQueries({ queryKey })
    await queryClient.refetchQueries({ queryKey, type: 'all' })
  }

  const invalidateWeeklyStats = () =>
    queryClient.invalidateQueries({
      queryKey: getWorkoutWeeklyCategoryStatsQueryKey(userId, weeksToShow),
    })

  const addSetMutation = useMutation({
    mutationFn: (input: {
      data: {
        selectedDay: string
        exerciseId: string
        type: SetType
        reps?: number
        duration?: number
      }
    }) => addWorkoutSetFn(input),
    onMutate: async (newSet) => {
      const dayKey = newSet.data.selectedDay
      const queryKey = getWorkoutDayQueryKey(userId, dayKey)
      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData<WorkoutDayData>(queryKey)

      if (previousData) {
        const exercise = previousData.exercises.find((item) => item.id === newSet.data.exerciseId)
        const newLog: WorkoutLog = {
          id: `temp-${Date.now()}`,
          exerciseId: newSet.data.exerciseId,
          exerciseName: exercise?.name || 'Unknown',
          type: newSet.data.type,
          value:
            newSet.data.type === SetType.REPS ? newSet.data.reps || 0 : newSet.data.duration || 0,
          date: dayKey,
          timestamp: new Date().toISOString(),
        }

        queryClient.setQueryData<WorkoutDayData>(queryKey, (current) =>
          current
            ? {
                ...current,
                exercises: current.exercises.map((item) =>
                  item.id === newSet.data.exerciseId
                    ? { ...item, weekSetsDone: item.weekSetsDone + 1 }
                    : item,
                ),
                logs: [...current.logs, newLog],
              }
            : current,
        )
      }

      return { previousData }
    },
    onError: (_error, newSet, context?: MutationContext) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          getWorkoutDayQueryKey(userId, newSet.data.selectedDay),
          context.previousData,
        )
      }
      onSetLogFailed()
    },
    onSettled: (_data, _error, variables) => {
      void refreshWorkoutDay(variables.data.selectedDay)
      void invalidateWeeklyStats()
    },
  })

  const removeSetMutation = useMutation({
    mutationFn: (input: { data: { selectedDay: string; logId: string } }) =>
      removeWorkoutSetFn(input),
    onMutate: async (variables) => {
      const dayKey = variables.data.selectedDay
      const queryKey = getWorkoutDayQueryKey(userId, dayKey)
      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData<WorkoutDayData>(queryKey)

      if (previousData) {
        const logToRemove = previousData.logs.find((log) => log.id === variables.data.logId)
        if (logToRemove) {
          queryClient.setQueryData<WorkoutDayData>(queryKey, (current) =>
            current
              ? {
                  ...current,
                  exercises: current.exercises.map((exercise) =>
                    exercise.id === logToRemove.exerciseId
                      ? { ...exercise, weekSetsDone: Math.max(0, exercise.weekSetsDone - 1) }
                      : exercise,
                  ),
                  logs: current.logs.filter((log) => log.id !== variables.data.logId),
                }
              : current,
          )
        }
      }

      return { previousData }
    },
    onError: (_error, variables, context?: MutationContext) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          getWorkoutDayQueryKey(userId, variables.data.selectedDay),
          context.previousData,
        )
      }
    },
    onSettled: (_data, _error, variables) => {
      onRemovedSet()
      void refreshWorkoutDay(variables.data.selectedDay)
      void invalidateWeeklyStats()
    },
  })

  return {
    addSetMutation,
    removeSetMutation,
  }
}
