import {
  getBodyMetricsDayFn,
  getWorkoutDayFn,
  getWorkoutWeeklyCategoryStatsFn,
} from '~/server/workout'

export function getWorkoutDayQueryKey(userId: string, selectedDay: string) {
  return ['workout-day', userId, selectedDay] as const
}

export function getWorkoutWeeklyCategoryStatsQueryKey(userId: string, weeks: number) {
  return ['workout-weekly-category-stats', userId, weeks] as const
}

export function getBodyMetricsDayQueryKey(userId: string, selectedDay: string) {
  return ['body-metrics-day', userId, selectedDay] as const
}

export function getWorkoutDayQueryOptions(userId: string, selectedDay: string) {
  return {
    queryKey: getWorkoutDayQueryKey(userId, selectedDay),
    queryFn: () => getWorkoutDayFn({ data: { selectedDay } }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  }
}

export function getWorkoutWeeklyCategoryStatsQueryOptions(userId: string, weeks: number) {
  return {
    queryKey: getWorkoutWeeklyCategoryStatsQueryKey(userId, weeks),
    queryFn: () => getWorkoutWeeklyCategoryStatsFn({ data: { weeks } }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  }
}

export function getBodyMetricsDayQueryOptions(userId: string, selectedDay: string) {
  return {
    queryKey: getBodyMetricsDayQueryKey(userId, selectedDay),
    queryFn: () => getBodyMetricsDayFn({ data: { selectedDay } }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  }
}
