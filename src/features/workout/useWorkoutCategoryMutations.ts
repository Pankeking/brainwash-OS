import { useMutation, type QueryClient } from '@tanstack/react-query'

import {
  addWorkoutCategoryFn,
  removeWorkoutCategoryFn,
  updateWorkoutCategoryColorFn,
} from '~/server/workout'

import { WORKOUT_CATEGORY_COLORS } from './workout.constants'
import {
  getWorkoutDayQueryKey,
  getWorkoutWeeklyCategoryStatsQueryKey,
} from './workout.query-options'
import type { WorkoutCategory, WorkoutDayData } from './workout.types'

type MutationContext = {
  previousData?: WorkoutDayData
}

interface UseWorkoutCategoryMutationsArgs {
  onAddedCategory: () => void
  queryClient: QueryClient
  selectedDay: string
  userId: string
  weeksToShow: number
}

export function useWorkoutCategoryMutations({
  onAddedCategory,
  queryClient,
  selectedDay,
  userId,
  weeksToShow,
}: UseWorkoutCategoryMutationsArgs) {
  const refreshWorkoutDay = async () => {
    const queryKey = getWorkoutDayQueryKey(userId, selectedDay)
    await queryClient.invalidateQueries({ queryKey })
    await queryClient.refetchQueries({ queryKey, type: 'all' })
  }

  const invalidateWeeklyStats = () =>
    queryClient.invalidateQueries({
      queryKey: getWorkoutWeeklyCategoryStatsQueryKey(userId, weeksToShow),
    })

  const addCategoryMutation = useMutation({
    mutationFn: (input: { data: { name: string; color: string } }) => addWorkoutCategoryFn(input),
    onMutate: async (newCategory) => {
      const queryKey = getWorkoutDayQueryKey(userId, selectedDay)
      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData<WorkoutDayData>(queryKey)

      if (previousData) {
        queryClient.setQueryData<WorkoutDayData>(queryKey, (current) =>
          current
            ? {
                ...current,
                categories: [
                  ...current.categories,
                  {
                    id: `temp-${Date.now()}`,
                    name: newCategory.data.name,
                    color: newCategory.data.color,
                  },
                ],
              }
            : current,
        )
      }

      return { previousData }
    },
    onSuccess: onAddedCategory,
    onError: (_error, _variables, context?: MutationContext) => {
      if (context?.previousData) {
        queryClient.setQueryData(getWorkoutDayQueryKey(userId, selectedDay), context.previousData)
      }
    },
    onSettled: () => {
      void refreshWorkoutDay()
    },
  })

  const removeCategoryMutation = useMutation({
    mutationFn: (input: { data: { categoryId: string } }) => removeWorkoutCategoryFn(input),
    onMutate: async (variables) => {
      const queryKey = getWorkoutDayQueryKey(userId, selectedDay)
      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData<WorkoutDayData>(queryKey)

      if (previousData) {
        queryClient.setQueryData<WorkoutDayData>(queryKey, (current) =>
          current
            ? {
                ...current,
                categories: current.categories.filter(
                  (category) => category.id !== variables.data.categoryId,
                ),
                exercises: current.exercises.map((exercise) => ({
                  ...exercise,
                  categoryIds: exercise.categoryIds.filter(
                    (id) => id !== variables.data.categoryId,
                  ),
                })),
              }
            : current,
        )
      }

      return { previousData }
    },
    onError: (_error, _variables, context?: MutationContext) => {
      if (context?.previousData) {
        queryClient.setQueryData(getWorkoutDayQueryKey(userId, selectedDay), context.previousData)
      }
    },
    onSettled: () => {
      void refreshWorkoutDay()
      void invalidateWeeklyStats()
    },
  })

  const updateCategoryColorMutation = useMutation({
    mutationFn: (input: { data: { categoryId: string; color: string } }) =>
      updateWorkoutCategoryColorFn(input),
    onMutate: async (variables) => {
      const queryKey = getWorkoutDayQueryKey(userId, selectedDay)
      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData<WorkoutDayData>(queryKey)

      if (previousData) {
        queryClient.setQueryData<WorkoutDayData>(queryKey, (current) =>
          current
            ? {
                ...current,
                categories: current.categories.map((category) =>
                  category.id === variables.data.categoryId
                    ? { ...category, color: variables.data.color }
                    : category,
                ),
              }
            : current,
        )
      }

      return { previousData }
    },
    onError: (_error, _variables, context?: MutationContext) => {
      if (context?.previousData) {
        queryClient.setQueryData(getWorkoutDayQueryKey(userId, selectedDay), context.previousData)
      }
    },
    onSettled: () => {
      void refreshWorkoutDay()
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
    cycleCategoryColor,
    removeCategoryMutation,
  }
}
