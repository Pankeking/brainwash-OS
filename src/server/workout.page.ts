import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import connectDB from './db'
import { getAuthenticatedUserObjectId } from './workout.auth'
import { getBodyMetricsDayData } from './workout.metrics'
import { getWorkoutDayData, getWorkoutWeeklyCategoryStatsData } from './workout.queries'
import { workoutDayInputSchema } from './workout.schemas'

const workoutPageInputSchema = workoutDayInputSchema.extend({
  weeks: z.number().int().min(1).max(24),
})

export const getWorkoutPageDataFn = createServerFn({ method: 'POST' })
  .inputValidator(workoutPageInputSchema)
  .handler(async ({ data }) => {
    await connectDB()
    const userId = await getAuthenticatedUserObjectId()

    const [workoutDayData, weeklyStatsData, bodyMetricsData] = await Promise.all([
      getWorkoutDayData({ selectedDay: data.selectedDay, userId }),
      getWorkoutWeeklyCategoryStatsData({ userId, weeks: data.weeks }),
      getBodyMetricsDayData({ selectedDay: data.selectedDay, userId }),
    ])

    return {
      bodyMetricsData,
      selectedDay: workoutDayData.selectedDay,
      userId: String(userId),
      weeklyStatsData,
      workoutDayData: workoutDayData.data,
    }
  })
