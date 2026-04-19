import type mongoose from 'mongoose'
import { createServerFn } from '@tanstack/react-start'

import type { SetType } from '~/enums/enums'
import { ExerciseCategoryModel } from '~/models/ExerciseCategory.model'
import { ExerciseModel } from '~/models/Exercise.model'
import { WorkoutLogModel } from '~/models/WorkoutLog.model'

import connectDB from './db'
import { appLogError, appLogInfo } from './logger'
import { dayKeyFromDateInTimeZone, getUtcRangeForDayKey } from './dayKey'
import { getAuthenticatedUserObjectId } from './workout.auth'
import { weeklyCategoryStatsInputSchema, workoutDayInputSchema } from './workout.schemas'
import {
  APP_TIMEZONE,
  addDaysToDayKey,
  type FlatSetRecord,
  findWorkoutLogsForDay,
  formatDayKeyForLabel,
  getRollingRangeFromDayKey,
  getStatsFromSets,
  getWeekStartDayKey,
  parseSelectedDayKey,
  setToNumericValue,
} from './workout.utils'

function collectSetsByExercise(
  logs: Array<{
    exercises: Array<{
      exercise: { exerciseId: mongoose.Types.ObjectId }
      sets: Array<{ type: SetType; reps?: number; duration?: number }>
    }>
  }>,
) {
  const grouped = new Map<string, FlatSetRecord[]>()
  for (const log of logs) {
    for (const entry of log.exercises) {
      const id = String(entry.exercise.exerciseId)
      if (!grouped.has(id)) {
        grouped.set(id, [])
      }
      const current = grouped.get(id)
      if (!current) {
        continue
      }
      for (const set of entry.sets) {
        const value = setToNumericValue(set)
        if (value !== null) {
          current.push({ value })
        }
      }
    }
  }
  return grouped
}

export const getWorkoutDayFn = createServerFn({ method: 'POST' })
  .inputValidator(workoutDayInputSchema)
  .handler(async ({ data }) => {
    try {
      await connectDB()
      const userId = await getAuthenticatedUserObjectId()
      const selectedDayKey = parseSelectedDayKey(data.selectedDay)
      const todayDayKey = dayKeyFromDateInTimeZone(new Date(), APP_TIMEZONE)
      const weekRange = getRollingRangeFromDayKey(todayDayKey, 7)
      const monthRange = getRollingRangeFromDayKey(todayDayKey, 30)
      const currentWeekStartDayKey = getWeekStartDayKey(todayDayKey)
      const currentWeekEndDayKey = addDaysToDayKey(currentWeekStartDayKey, 6)
      const currentWeekRange = {
        start: getUtcRangeForDayKey(currentWeekStartDayKey, APP_TIMEZONE).start,
        end: getUtcRangeForDayKey(currentWeekEndDayKey, APP_TIMEZONE).end,
      }

      const [categories, exerciseDocs, dayLogs, monthRangeLogs] = await Promise.all([
        ExerciseCategoryModel.find({ userId }).sort({ createdAt: 1 }).lean(),
        ExerciseModel.find({ userId }).sort({ createdAt: 1 }).lean(),
        findWorkoutLogsForDay(userId, selectedDayKey, { lean: true }),
        WorkoutLogModel.find({
          userId,
          date: { $gte: monthRange.start, $lte: monthRange.end },
        }).lean(),
      ])

      const currentWeekLogs = monthRangeLogs.filter(
        (log) => log.date >= currentWeekRange.start && log.date <= currentWeekRange.end,
      )
      const weekRangeLogs = monthRangeLogs.filter(
        (log) => log.date >= weekRange.start && log.date <= weekRange.end,
      )

      const normalizedCategories = categories.map((category) => ({
        id: String(category._id),
        name: category.name,
        color: category.color,
      }))
      const exerciseById = new Map(exerciseDocs.map((exercise) => [String(exercise._id), exercise]))

      const weekSetsByExercise = collectSetsByExercise(
        currentWeekLogs as Array<{
          exercises: Array<{
            exercise: { exerciseId: mongoose.Types.ObjectId }
            sets: Array<{ type: SetType; reps?: number; duration?: number }>
          }>
        }>,
      )
      const rollingWeekSetsByExercise = collectSetsByExercise(
        weekRangeLogs as Array<{
          exercises: Array<{
            exercise: { exerciseId: mongoose.Types.ObjectId }
            sets: Array<{ type: SetType; reps?: number; duration?: number }>
          }>
        }>,
      )
      const monthSetsByExercise = collectSetsByExercise(
        monthRangeLogs as Array<{
          exercises: Array<{
            exercise: { exerciseId: mongoose.Types.ObjectId }
            sets: Array<{ type: SetType; reps?: number; duration?: number }>
          }>
        }>,
      )

      const exercises = exerciseDocs.map((exercise) => {
        const id = String(exercise._id)
        const weekSetRecords = weekSetsByExercise.get(id) || []
        const rollingWeekSetRecords = rollingWeekSetsByExercise.get(id) || []
        const parsedWeeklyGoal =
          exercise.weeklySetGoal === null || exercise.weeklySetGoal === undefined
            ? null
            : Number(exercise.weeklySetGoal)
        return {
          id,
          name: exercise.name,
          categoryIds: (exercise.categories || []).map(
            (categoryId: mongoose.Types.ObjectId | string) => String(categoryId),
          ),
          weeklySetGoal: Number.isFinite(parsedWeeklyGoal) ? parsedWeeklyGoal : null,
          weekSetsDone: weekSetRecords.length,
          stats: {
            week: getStatsFromSets(rollingWeekSetRecords),
            month: getStatsFromSets(monthSetsByExercise.get(id) || []),
          },
        }
      })

      const logs = dayLogs.flatMap((workoutLog) =>
        workoutLog.exercises.flatMap(
          (
            entry: {
              exercise: { exerciseId: mongoose.Types.ObjectId | string }
              sets: Array<{ type: SetType; reps?: number; duration?: number; loggedAt?: Date }>
            },
            exerciseIndex: number,
          ) => {
            const exerciseId = String(entry.exercise.exerciseId)
            const exercise = exerciseById.get(exerciseId)
            if (!exercise) {
              return []
            }
            return entry.sets
              .map(
                (
                  set: { type: SetType; reps?: number; duration?: number; loggedAt?: Date },
                  setIndex: number,
                ) => {
                  const value = setToNumericValue(set)
                  if (value === null) {
                    return null
                  }

                  const fallbackTimestamp = workoutLog?.date
                    ? new Date(workoutLog.date).getTime()
                    : Date.now()
                  const timestamp = set.loggedAt
                    ? new Date(set.loggedAt).toISOString()
                    : new Date(fallbackTimestamp + setIndex * 1000).toISOString()

                  return {
                    id: `${exerciseIndex}:${setIndex}`,
                    exerciseId,
                    exerciseName: exercise.name,
                    type: set.type,
                    value,
                    date: selectedDayKey,
                    timestamp,
                  }
                },
              )
              .filter((log): log is NonNullable<typeof log> => Boolean(log))
          },
        ),
      )

      appLogInfo('BW_WORKOUT_DAY_FETCHED', 'Workout day data fetched', {
        selectedDayKey,
        exerciseCount: exercises.length,
        logCount: logs.length,
      })

      return {
        categories: normalizedCategories,
        exercises,
        logs,
      }
    } catch (error) {
      appLogError('BW_WORKOUT_DAY_FETCH_FAILED', 'Failed to fetch workout day data', {
        selectedDay: data.selectedDay,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  })

export const getWorkoutWeeklyCategoryStatsFn = createServerFn({ method: 'POST' })
  .inputValidator(weeklyCategoryStatsInputSchema)
  .handler(async ({ data }) => {
    await connectDB()
    const userId = await getAuthenticatedUserObjectId()

    const todayDayKey = dayKeyFromDateInTimeZone(new Date(), APP_TIMEZONE)
    const currentWeekStartDayKey = getWeekStartDayKey(todayDayKey)
    const weekRanges = Array.from({ length: data.weeks }).map((_, index) => {
      const startDayKey = addDaysToDayKey(currentWeekStartDayKey, -index * 7)
      const endDayKey = addDaysToDayKey(startDayKey, 6)
      const start = getUtcRangeForDayKey(startDayKey, APP_TIMEZONE).start
      const end = getUtcRangeForDayKey(endDayKey, APP_TIMEZONE).end
      const label = `${formatDayKeyForLabel(startDayKey)} - ${formatDayKeyForLabel(endDayKey)}`
      return { start, end, label }
    })

    const oldestStart =
      weekRanges[weekRanges.length - 1]?.start ||
      getUtcRangeForDayKey(todayDayKey, APP_TIMEZONE).start
    const newestEnd = weekRanges[0]?.end || getUtcRangeForDayKey(todayDayKey, APP_TIMEZONE).end

    const [categories, exercises, logs] = await Promise.all([
      ExerciseCategoryModel.find({ userId }).sort({ createdAt: 1 }).lean(),
      ExerciseModel.find({ userId }).lean(),
      WorkoutLogModel.find({
        userId,
        date: { $gte: oldestStart, $lte: newestEnd },
      }).lean(),
    ])

    const exerciseById = new Map(exercises.map((exercise) => [String(exercise._id), exercise]))
    const categoryRowMap = new Map(
      categories.map((category) => [
        String(category._id),
        {
          categoryId: String(category._id),
          name: category.name,
          color: category.color,
          counts: Array.from({ length: weekRanges.length }).map(() => 0),
        },
      ]),
    )

    logs.forEach(
      (log: {
        date: Date
        exercises: Array<{
          exercise: { exerciseId: mongoose.Types.ObjectId | string }
          sets: Array<unknown>
        }>
      }) => {
        const weekIndex = weekRanges.findIndex(
          (range) => log.date >= range.start && log.date <= range.end,
        )
        if (weekIndex === -1) {
          return
        }

        log.exercises.forEach(
          (entry: {
            exercise: { exerciseId: mongoose.Types.ObjectId | string }
            sets: Array<unknown>
          }) => {
            const exercise = exerciseById.get(String(entry.exercise.exerciseId))
            if (!exercise) {
              return
            }
            const setCount = entry.sets.length
            exercise.categories.forEach((categoryId: mongoose.Types.ObjectId | string) => {
              const row = categoryRowMap.get(String(categoryId))
              if (row) {
                row.counts[weekIndex] += setCount
              }
            })
          },
        )
      },
    )

    return {
      weeks: weekRanges.map((range) => range.label),
      rows: Array.from(categoryRowMap.values()),
    }
  })
