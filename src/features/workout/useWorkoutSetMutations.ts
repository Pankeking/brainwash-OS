import { useMutation, type QueryClient } from '@tanstack/react-query'

import { SetType } from '~/enums/enums'
import { addWorkoutSetFn, removeWorkoutSetFn } from '~/server/workout'

import type { WorkoutDayData, WorkoutLog } from './workout.types'

type MutationContext = {
  previousData?: WorkoutDayData
}

interface UseWorkoutSetMutationsArgs {
  onRemovedSet: () => void
  onSetLogFailed: () => void
  queryClient: QueryClient
  weeksToShow: number
}

export function useWorkoutSetMutations({
  onRemovedSet,
  onSetLogFailed,
  queryClient,
  weeksToShow,
}: UseWorkoutSetMutationsArgs) {
  const refreshWorkoutDay = async (dayKey: string) => {
    await queryClient.invalidateQueries({ queryKey: ['workout-day', dayKey] })
    await queryClient.refetchQueries({ queryKey: ['workout-day', dayKey], type: 'all' })
  }

  const invalidateWeeklyStats = () =>
    queryClient.invalidateQueries({ queryKey: ['workout-weekly-category-stats', weeksToShow] })

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
      await queryClient.cancelQueries({ queryKey: ['workout-day', dayKey] })
      const previousData = queryClient.getQueryData<WorkoutDayData>(['workout-day', dayKey])

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

        queryClient.setQueryData<WorkoutDayData>(['workout-day', dayKey], (current) =>
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
        queryClient.setQueryData(['workout-day', newSet.data.selectedDay], context.previousData)
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
      await queryClient.cancelQueries({ queryKey: ['workout-day', dayKey] })
      const previousData = queryClient.getQueryData<WorkoutDayData>(['workout-day', dayKey])

      if (previousData) {
        const logToRemove = previousData.logs.find((log) => log.id === variables.data.logId)
        if (logToRemove) {
          queryClient.setQueryData<WorkoutDayData>(['workout-day', dayKey], (current) =>
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
        queryClient.setQueryData(['workout-day', variables.data.selectedDay], context.previousData)
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
