import type { QueryClient } from '@tanstack/react-query'

export function clearWorkoutUserQueries(queryClient: QueryClient, userId?: string | null) {
  if (userId) {
    queryClient.removeQueries({ queryKey: ['workout-day', userId] })
    queryClient.removeQueries({ queryKey: ['workout-weekly-category-stats', userId] })
    queryClient.removeQueries({ queryKey: ['body-metrics-day', userId] })
    return
  }

  queryClient.removeQueries({ queryKey: ['workout-day'] })
  queryClient.removeQueries({ queryKey: ['workout-weekly-category-stats'] })
  queryClient.removeQueries({ queryKey: ['body-metrics-day'] })
}
