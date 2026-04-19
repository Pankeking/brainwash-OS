import { useMutation, type QueryClient } from '@tanstack/react-query'

import { SetType } from '~/enums/enums'
import {
  addWorkoutCategoryFn,
  addWorkoutExerciseFn,
  addWorkoutSetFn,
  removeWorkoutCategoryFn,
  removeWorkoutExerciseFn,
  removeWorkoutSetFn,
  renameWorkoutExerciseFn,
  toggleWorkoutExerciseCategoryFn,
  updateWorkoutCategoryColorFn,
  updateWorkoutExerciseWeeklyGoalFn,
} from '~/server/workout'

import { WORKOUT_CATEGORY_COLORS } from './workout.constants'
import type { WorkoutCategory, WorkoutDayData, WorkoutExercise, WorkoutLog } from './workout.types'

type MutationContext = {
  previousData?: WorkoutDayData
}

interface UseWorkoutMutationsArgs {
  onAddedCategory: () => void
  onAddedExercise: () => void
  onRemovedSet: () => void
  onStartStopwatch: () => void
  queryClient: QueryClient
  selectedDay: string
  weeksToShow: number
}

export function useWorkoutMutations({
  onAddedCategory,
  onAddedExercise,
  onRemovedSet,
  onStartStopwatch,
  queryClient,
  selectedDay,
  weeksToShow,
}: UseWorkoutMutationsArgs) {
  const refreshWorkoutDay = async (dayKey: string) => {
    await queryClient.invalidateQueries({
      queryKey: ['workout-day', dayKey],
    })
    await queryClient.refetchQueries({
      queryKey: ['workout-day', dayKey],
      type: 'all',
    })
  }

  const invalidateWeeklyStats = () =>
    queryClient.invalidateQueries({
      queryKey: ['workout-weekly-category-stats', weeksToShow],
    })

  const addCategoryMutation = useMutation({
    mutationFn: (input: { data: { name: string; color: string } }) => addWorkoutCategoryFn(input),
    onMutate: async (newCategory) => {
      const dayKey = selectedDay
      await queryClient.cancelQueries({ queryKey: ['workout-day', dayKey] })
      const previousData = queryClient.getQueryData<WorkoutDayData>(['workout-day', dayKey])

      if (previousData) {
        const tempCategory: WorkoutCategory = {
          id: `temp-${Date.now()}`,
          name: newCategory.data.name,
          color: newCategory.data.color,
        }
        queryClient.setQueryData<WorkoutDayData>(['workout-day', dayKey], (current) => {
          if (!current) {
            return current
          }

          return {
            ...current,
            categories: [...current.categories, tempCategory],
          }
        })
      }

      return { previousData }
    },
    onSuccess: () => {
      onAddedCategory()
    },
    onError: (_error, _variables, context?: MutationContext) => {
      if (context?.previousData) {
        queryClient.setQueryData(['workout-day', selectedDay], context.previousData)
      }
    },
    onSettled: () => {
      void refreshWorkoutDay(selectedDay)
    },
  })

  const removeCategoryMutation = useMutation({
    mutationFn: (input: { data: { categoryId: string } }) => removeWorkoutCategoryFn(input),
    onMutate: async (variables) => {
      const dayKey = selectedDay
      await queryClient.cancelQueries({ queryKey: ['workout-day', dayKey] })
      const previousData = queryClient.getQueryData<WorkoutDayData>(['workout-day', dayKey])

      if (previousData) {
        queryClient.setQueryData<WorkoutDayData>(['workout-day', dayKey], (current) => {
          if (!current) {
            return current
          }

          return {
            ...current,
            categories: current.categories.filter(
              (category) => category.id !== variables.data.categoryId,
            ),
            exercises: current.exercises.map((exercise) => ({
              ...exercise,
              categoryIds: exercise.categoryIds.filter((id) => id !== variables.data.categoryId),
            })),
          }
        })
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

  const updateCategoryColorMutation = useMutation({
    mutationFn: (input: { data: { categoryId: string; color: string } }) =>
      updateWorkoutCategoryColorFn(input),
    onMutate: async (variables) => {
      const dayKey = selectedDay
      await queryClient.cancelQueries({ queryKey: ['workout-day', dayKey] })
      const previousData = queryClient.getQueryData<WorkoutDayData>(['workout-day', dayKey])

      if (previousData) {
        queryClient.setQueryData<WorkoutDayData>(['workout-day', dayKey], (current) => {
          if (!current) {
            return current
          }

          return {
            ...current,
            categories: current.categories.map((category) =>
              category.id === variables.data.categoryId
                ? { ...category, color: variables.data.color }
                : category,
            ),
          }
        })
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
          weeklySetGoal: null,
          weekSetsDone: 0,
          stats: {
            week: { best: null, avg: null, worst: null },
            month: { best: null, avg: null, worst: null },
          },
        }

        queryClient.setQueryData<WorkoutDayData>(['workout-day', dayKey], (current) => {
          if (!current) {
            return current
          }

          return {
            ...current,
            exercises: [...current.exercises, tempExercise],
          }
        })
      }

      return { previousData }
    },
    onSuccess: () => {
      onAddedExercise()
    },
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
        queryClient.setQueryData<WorkoutDayData>(['workout-day', dayKey], (current) => {
          if (!current) {
            return current
          }

          return {
            ...current,
            exercises: current.exercises.filter(
              (exercise) => exercise.id !== variables.data.exerciseId,
            ),
            logs: current.logs.filter((log) => log.exerciseId !== variables.data.exerciseId),
          }
        })
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
      const dayKey = selectedDay
      await queryClient.cancelQueries({ queryKey: ['workout-day', dayKey] })
      const previousData = queryClient.getQueryData<WorkoutDayData>(['workout-day', dayKey])

      if (previousData) {
        queryClient.setQueryData<WorkoutDayData>(['workout-day', dayKey], (current) => {
          if (!current) {
            return current
          }

          return {
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
        })
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
      const dayKey = selectedDay
      await queryClient.cancelQueries({ queryKey: ['workout-day', dayKey] })
      const previousData = queryClient.getQueryData<WorkoutDayData>(['workout-day', dayKey])

      if (previousData) {
        queryClient.setQueryData<WorkoutDayData>(['workout-day', dayKey], (current) => {
          if (!current) {
            return current
          }

          return {
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
        })
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
    mutationFn: (input: { data: { exerciseId: string; weeklySetGoal: number | null } }) =>
      updateWorkoutExerciseWeeklyGoalFn(input),
    onMutate: async (variables) => {
      const dayKey = selectedDay
      await queryClient.cancelQueries({ queryKey: ['workout-day', dayKey] })
      const previousData = queryClient.getQueryData<WorkoutDayData>(['workout-day', dayKey])

      if (previousData) {
        queryClient.setQueryData<WorkoutDayData>(['workout-day', dayKey], (current) => {
          if (!current) {
            return current
          }

          return {
            ...current,
            exercises: current.exercises.map((exercise) =>
              exercise.id === variables.data.exerciseId
                ? { ...exercise, weeklySetGoal: variables.data.weeklySetGoal }
                : exercise,
            ),
          }
        })
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

        queryClient.setQueryData<WorkoutDayData>(['workout-day', dayKey], (current) => {
          if (!current) {
            return current
          }

          return {
            ...current,
            exercises: current.exercises.map((item) =>
              item.id === newSet.data.exerciseId
                ? { ...item, weekSetsDone: item.weekSetsDone + 1 }
                : item,
            ),
            logs: [...current.logs, newLog],
          }
        })
      }

      return { previousData }
    },
    onSuccess: () => {
      onStartStopwatch()
    },
    onError: (_error, newSet, context?: MutationContext) => {
      if (context?.previousData) {
        queryClient.setQueryData(['workout-day', newSet.data.selectedDay], context.previousData)
      }
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
          queryClient.setQueryData<WorkoutDayData>(['workout-day', dayKey], (current) => {
            if (!current) {
              return current
            }

            return {
              ...current,
              exercises: current.exercises.map((exercise) =>
                exercise.id === logToRemove.exerciseId
                  ? { ...exercise, weekSetsDone: Math.max(0, exercise.weekSetsDone - 1) }
                  : exercise,
              ),
              logs: current.logs.filter((log) => log.id !== variables.data.logId),
            }
          })
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

  const cycleCategoryColor = (category: WorkoutCategory) => {
    const currentIndex = WORKOUT_CATEGORY_COLORS.findIndex(
      (option) => option.hex === category.color,
    )
    const nextColor = WORKOUT_CATEGORY_COLORS[(currentIndex + 1) % WORKOUT_CATEGORY_COLORS.length]

    updateCategoryColorMutation.mutate({
      data: {
        categoryId: category.id,
        color: nextColor.hex,
      },
    })
  }

  return {
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
  }
}
