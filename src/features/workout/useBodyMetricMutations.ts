import { useMutation, type QueryClient } from '@tanstack/react-query'

import {
  createBodyMetricDefinitionFn,
  removeBodyMetricDefinitionFn,
  removeBodyMetricFn,
  upsertBodyMetricFn,
} from '~/server/workout'

import { getBodyMetricsDayQueryKey } from './workout.query-options'
import type { BodyMetricsDayData } from './workout.types'

interface UseBodyMetricMutationsArgs {
  queryClient: QueryClient
  selectedDay: string
  userId: string
}

export function useBodyMetricMutations({
  queryClient,
  selectedDay,
  userId,
}: UseBodyMetricMutationsArgs) {
  const refreshBodyMetrics = async () => {
    const queryKey = getBodyMetricsDayQueryKey(userId, selectedDay)
    await queryClient.invalidateQueries({ queryKey })
    await queryClient.refetchQueries({ queryKey, type: 'all' })
  }

  const upsertMetricMutation = useMutation({
    mutationFn: (input: { data: { selectedDay: string; metricKey: string; value: number } }) =>
      upsertBodyMetricFn(input),
    onSettled: () => {
      void refreshBodyMetrics()
    },
  })

  const removeMetricMutation = useMutation({
    mutationFn: (input: { data: { selectedDay: string; entryId: string } }) =>
      removeBodyMetricFn(input),
    onMutate: async (variables) => {
      const queryKey = getBodyMetricsDayQueryKey(userId, selectedDay)
      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData<BodyMetricsDayData>(queryKey)

      if (previousData) {
        queryClient.setQueryData<BodyMetricsDayData>(queryKey, {
          ...previousData,
          entries: previousData.entries.filter((entry) => entry.id !== variables.data.entryId),
        })
      }

      return { previousData }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          getBodyMetricsDayQueryKey(userId, selectedDay),
          context.previousData,
        )
      }
    },
    onSettled: () => {
      void refreshBodyMetrics()
    },
  })

  const createMetricDefinitionMutation = useMutation({
    mutationFn: (input: { data: { label: string; kind: 'weight' | 'size' } }) =>
      createBodyMetricDefinitionFn(input),
    onSettled: () => {
      void refreshBodyMetrics()
    },
  })

  const removeMetricDefinitionMutation = useMutation({
    mutationFn: (input: { data: { metricKey: string } }) => removeBodyMetricDefinitionFn(input),
    onSettled: () => {
      void refreshBodyMetrics()
    },
  })

  return {
    createMetricDefinitionMutation,
    removeMetricDefinitionMutation,
    removeMetricMutation,
    upsertMetricMutation,
  }
}
