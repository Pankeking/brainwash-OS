import { useMutation, type QueryClient } from '@tanstack/react-query'

import { removeBodyMetricFn, upsertBodyMetricFn } from '~/server/workout'

import type { BodyMetricsDayData } from './workout.types'

interface UseBodyMetricMutationsArgs {
  queryClient: QueryClient
  selectedDay: string
}

export function useBodyMetricMutations({ queryClient, selectedDay }: UseBodyMetricMutationsArgs) {
  const refreshBodyMetrics = async () => {
    await queryClient.invalidateQueries({ queryKey: ['body-metrics-day', selectedDay] })
    await queryClient.refetchQueries({ queryKey: ['body-metrics-day', selectedDay], type: 'all' })
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
      await queryClient.cancelQueries({ queryKey: ['body-metrics-day', selectedDay] })
      const previousData = queryClient.getQueryData<BodyMetricsDayData>([
        'body-metrics-day',
        selectedDay,
      ])

      if (previousData) {
        queryClient.setQueryData<BodyMetricsDayData>(['body-metrics-day', selectedDay], {
          ...previousData,
          entries: previousData.entries.filter((entry) => entry.id !== variables.data.entryId),
        })
      }

      return { previousData }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['body-metrics-day', selectedDay], context.previousData)
      }
    },
    onSettled: () => {
      void refreshBodyMetrics()
    },
  })

  return {
    removeMetricMutation,
    upsertMetricMutation,
  }
}
