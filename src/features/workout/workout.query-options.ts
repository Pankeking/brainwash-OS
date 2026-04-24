import {
  getBodyMetricsDayFn,
  getWorkoutDayFn,
  getWorkoutWeeklyCategoryStatsFn,
} from '~/server/workout'

export function getWorkoutDayQueryOptions(selectedDay: string) {
  return {
    queryKey: ['workout-day', selectedDay] as const,
    queryFn: () => getWorkoutDayFn({ data: { selectedDay } }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  }
}

export function getWorkoutWeeklyCategoryStatsQueryOptions(weeks: number) {
  return {
    queryKey: ['workout-weekly-category-stats', weeks] as const,
    queryFn: () => getWorkoutWeeklyCategoryStatsFn({ data: { weeks } }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  }
}

export function getBodyMetricsDayQueryOptions(selectedDay: string) {
  return {
    queryKey: ['body-metrics-day', selectedDay] as const,
    queryFn: () => getBodyMetricsDayFn({ data: { selectedDay } }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  }
}
