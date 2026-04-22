import { useMutation, type QueryClient } from '@tanstack/react-query'

import { SetType } from '~/enums/enums'
import {
  addWorkoutExerciseFn,
  removeWorkoutExerciseFn,
  renameWorkoutExerciseFn,
  toggleWorkoutExerciseCategoryFn,
  updateWorkoutExerciseWeeklyGoalFn,
} from '~/server/workout'

import type { WorkoutDayData, WorkoutExercise } from './workout.types'

type MutationContext = {
  previousData?: WorkoutDayData
}

interface UseWorkoutExerciseMutationsArgs {
  onAddedExercise: () => void
  queryClient: QueryClient
  selectedDay: string
  weeksToShow: number
}

export function useWorkoutExerciseMutations({
  onAddedExercise,
  queryClient,
  selectedDay,
  weeksToShow,
}: UseWorkoutExerciseMutationsArgs) {
  const refreshWorkoutDay = async (dayKey: string) => {
    await queryClient.invalidateQueries({ queryKey: ['workout-day', dayKey] })
    await queryClient.refetchQueries({ queryKey: ['workout-day', dayKey], type: 'all' })
  }

  const invalidateWeeklyStats = () =>
    queryClient.invalidateQueries({ queryKey: ['workout-weekly-category-stats', weeksToShow] })

  const addExerciseMutation = useMutation({
    mutationFn: (input: { data: { selectedDay: string; name: string } }) =>
      addWorkoutExerciseFn(input),
    onMutate: async (newExercise) => {
      const dayKey = newExercise.data.selectedDay
      await queryClient.cancelQueries({ queryKey: ['workout-day', dayKey] })
      const previousData = queryClient.getQueryData<WorkoutDayData>(['workout-day', dayKey])

      if (previousData) {
        const tempExercise: WorkoutExercise = {
          id: `temp-${Date.now()}`,
          name: newExercise.data.name,
          categoryIds: [],
          preferredSetType: SetType.REPS,
          weeklySetGoal: null,
          weeklyVolumeGoal: null,
          setTargetValue: null,
          weekSetsDone: 0,
          weekVolumeDone: 0,
          stats: {
            week: { best: null, avg: null, worst: null },
            month: { best: null, avg: null, worst: null },
          },
        }

        queryClient.setQueryData<WorkoutDayData>(['workout-day', dayKey], (current) =>
          current ? { ...current, exercises: [...current.exercises, tempExercise] } : current,
        )
      }

      return { previousData }
    },
    onSuccess: onAddedExercise,
    onError: (_error, newExercise, context?: MutationContext) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          ['workout-day', newExercise.data.selectedDay],
          context.previousData,
        )
      }
    },
    onSettled: (_data, _error, variables) => {
      void refreshWorkoutDay(variables.data.selectedDay)
      void invalidateWeeklyStats()
    },
  })

  const removeExerciseMutation = useMutation({
    mutationFn: (input: { data: { selectedDay: string; exerciseId: string } }) =>
      removeWorkoutExerciseFn(input),
    onMutate: async (variables) => {
      const dayKey = variables.data.selectedDay
      await queryClient.cancelQueries({ queryKey: ['workout-day', dayKey] })
      const previousData = queryClient.getQueryData<WorkoutDayData>(['workout-day', dayKey])

      if (previousData) {
        queryClient.setQueryData<WorkoutDayData>(['workout-day', dayKey], (current) =>
          current
            ? {
                ...current,
                exercises: current.exercises.filter(
                  (exercise) => exercise.id !== variables.data.exerciseId,
                ),
                logs: current.logs.filter((log) => log.exerciseId !== variables.data.exerciseId),
              }
            : current,
        )
      }

      return { previousData }
    },
    onError: (_error, variables, context?: MutationContext) => {
      if (context?.previousData) {
        queryClient.setQueryData(['workout-day', variables.data.selectedDay], context.previousData)
      }
    },
    onSettled: (_data, _error, variables) => {
      void refreshWorkoutDay(variables.data.selectedDay)
      void invalidateWeeklyStats()
    },
  })

  const renameExerciseMutation = useMutation({
    mutationFn: (input: { data: { exerciseId: string; nextName: string } }) =>
      renameWorkoutExerciseFn(input),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['workout-day', selectedDay] })
      const previousData = queryClient.getQueryData<WorkoutDayData>(['workout-day', selectedDay])

      if (previousData) {
        queryClient.setQueryData<WorkoutDayData>(['workout-day', selectedDay], (current) =>
          current
            ? {
                ...current,
                exercises: current.exercises.map((exercise) =>
                  exercise.id === variables.data.exerciseId
                    ? { ...exercise, name: variables.data.nextName }
                    : exercise,
                ),
                logs: current.logs.map((log) =>
                  log.exerciseId === variables.data.exerciseId
                    ? { ...log, exerciseName: variables.data.nextName }
                    : log,
                ),
              }
            : current,
        )
      }

      return { previousData }
    },
    onError: (_error, _variables, context?: MutationContext) => {
      if (context?.previousData) {
        queryClient.setQueryData(['workout-day', selectedDay], context.previousData)
      }
    },
    onSettled: () => {
      void refreshWorkoutDay(selectedDay)
      void invalidateWeeklyStats()
    },
  })

  const toggleExerciseCategoryMutation = useMutation({
    mutationFn: (input: { data: { exerciseId: string; categoryId: string } }) =>
      toggleWorkoutExerciseCategoryFn(input),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['workout-day', selectedDay] })
      const previousData = queryClient.getQueryData<WorkoutDayData>(['workout-day', selectedDay])

      if (previousData) {
        queryClient.setQueryData<WorkoutDayData>(['workout-day', selectedDay], (current) =>
          current
            ? {
                ...current,
                exercises: current.exercises.map((exercise) => {
                  if (exercise.id !== variables.data.exerciseId) {
                    return exercise
                  }
                  const categoryIds = exercise.categoryIds.includes(variables.data.categoryId)
                    ? exercise.categoryIds.filter((id) => id !== variables.data.categoryId)
                    : [...exercise.categoryIds, variables.data.categoryId]
                  return { ...exercise, categoryIds }
                }),
              }
            : current,
        )
      }

      return { previousData }
    },
    onError: (_error, _variables, context?: MutationContext) => {
      if (context?.previousData) {
        queryClient.setQueryData(['workout-day', selectedDay], context.previousData)
      }
    },
    onSettled: () => {
      void refreshWorkoutDay(selectedDay)
      void invalidateWeeklyStats()
    },
  })

  const updateExerciseWeeklyGoalMutation = useMutation({
    mutationFn: (input: {
      data: {
        exerciseId: string
        preferredSetType?: 'reps' | 'timed'
        weeklySetGoal: number | null
        weeklyVolumeGoal?: number | null
        setTargetValue?: number | null
      }
    }) => updateWorkoutExerciseWeeklyGoalFn(input),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['workout-day', selectedDay] })
      const previousData = queryClient.getQueryData<WorkoutDayData>(['workout-day', selectedDay])

      if (previousData) {
        queryClient.setQueryData<WorkoutDayData>(['workout-day', selectedDay], (current) =>
          current
            ? {
                ...current,
                exercises: current.exercises.map((exercise) =>
                  exercise.id === variables.data.exerciseId
                    ? {
                        ...exercise,
                        preferredSetType:
                          variables.data.preferredSetType === 'timed'
                            ? SetType.TIMED
                            : variables.data.preferredSetType === 'reps'
                              ? SetType.REPS
                              : exercise.preferredSetType,
                        weeklySetGoal: variables.data.weeklySetGoal,
                        weeklyVolumeGoal:
                          variables.data.weeklyVolumeGoal ?? exercise.weeklyVolumeGoal,
                        setTargetValue:
                          variables.data.setTargetValue !== undefined
                            ? variables.data.setTargetValue
                            : exercise.setTargetValue,
                      }
                    : exercise,
                ),
              }
            : current,
        )
      }

      return { previousData }
    },
    onError: (_error, _variables, context?: MutationContext) => {
      if (context?.previousData) {
        queryClient.setQueryData(['workout-day', selectedDay], context.previousData)
      }
    },
    onSettled: () => {
      void refreshWorkoutDay(selectedDay)
      void invalidateWeeklyStats()
    },
  })

  return {
    addExerciseMutation,
    removeExerciseMutation,
    renameExerciseMutation,
    toggleExerciseCategoryMutation,
    updateExerciseWeeklyGoalMutation,
  }
}
