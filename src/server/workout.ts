import mongoose from 'mongoose'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { useAppSession } from '~/utils/session'
import { SetType, Weekday } from '~/enums/enums'
import connectDB from './db'
import { ExerciseCategoryModel } from '~/models/ExerciseCategory.model'
import { WorkoutLogModel } from '~/models/WorkoutLog.model'
import { ExerciseModel } from '~/models/Exercise.model'
import { appLogError, appLogInfo } from './logger'
import {
  createLogTimestampForDayKey,
  dayKeyFromDateInTimeZone,
  formatDayKey,
  getUtcRangeForDayKey as getUtcRangeForDayKeyInTimeZone,
  parseDayKey,
} from './dayKey'

const workoutDayInputSchema = z.object({
  selectedDay: z.string(),
})

const categoryInputSchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().min(1).max(20),
})

const categoryIdInputSchema = z.object({
  categoryId: z.string(),
})

const exerciseCreateInputSchema = z.object({
  selectedDay: z.string(),
  name: z.string().min(1).max(120),
})

const renameExerciseInputSchema = z.object({
  exerciseId: z.string(),
  nextName: z.string().min(1).max(120),
})

const updateExerciseWeeklyGoalInputSchema = z.object({
  exerciseId: z.string(),
  weeklySetGoal: z.number().int().min(1).max(999).nullable(),
})

const toggleExerciseCategoryInputSchema = z.object({
  exerciseId: z.string(),
  categoryId: z.string(),
})

const addSetInputSchema = z.object({
  selectedDay: z.string(),
  exerciseId: z.string(),
  type: z.nativeEnum(SetType),
  reps: z.number().int().min(1).optional(),
  duration: z.number().int().min(1).optional(),
})

const removeSetInputSchema = z.object({
  selectedDay: z.string(),
  logId: z.string(),
})

const removeExerciseInputSchema = z.object({
  selectedDay: z.string(),
  exerciseId: z.string(),
})

const updateCategoryColorInputSchema = z.object({
  categoryId: z.string(),
  color: z.string().min(1).max(20),
})

const weeklyCategoryStatsInputSchema = z.object({
  weeks: z.number().int().min(1).max(24),
})

const APP_TIMEZONE = 'Europe/Berlin'

function parseSelectedDayKey(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseDayKey(value).key
  }
  const legacyDate = new Date(value)
  if (Number.isNaN(legacyDate.getTime())) {
    throw new Error('Invalid selected day')
  }
  return dayKeyFromDateInTimeZone(legacyDate, APP_TIMEZONE)
}

function getLegacyWorkoutLogDateFilter(dayKey: string) {
  const range = getUtcRangeForDayKeyInTimeZone(dayKey, APP_TIMEZONE)
  return {
    date: {
      $gte: range.start,
      $lte: range.end,
    },
  }
}

async function findWorkoutLogsForDay(
  userId: mongoose.Types.ObjectId,
  dayKey: string,
  options?: { lean?: boolean },
) {
  const query = WorkoutLogModel.find({
    userId,
    $or: [{ dayKey }, getLegacyWorkoutLogDateFilter(dayKey)],
  })
  if (options?.lean) {
    return await query.lean()
  }
  return await query
}

async function findOrCreateWorkoutLogForDay(userId: mongoose.Types.ObjectId, dayKey: string) {
  const existingByDayKey = await WorkoutLogModel.findOne({
    userId,
    dayKey,
  })
  if (existingByDayKey) {
    return existingByDayKey
  }

  const weekday = getWeekdayFromDayKey(dayKey)
  const legacyWorkoutLog = await WorkoutLogModel.findOne({
    userId,
    weekday,
    ...getLegacyWorkoutLogDateFilter(dayKey),
  })
  if (legacyWorkoutLog) {
    legacyWorkoutLog.dayKey = dayKey
    return await legacyWorkoutLog.save()
  }

  const createdWorkoutLog = await WorkoutLogModel.findOneAndUpdate(
    {
      userId,
      dayKey,
    },
    {
      $setOnInsert: {
        userId,
        dayKey,
        date: createLogTimestampForDayKey(dayKey, APP_TIMEZONE),
        weekday,
        exercises: [],
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
    },
  )

  if (!createdWorkoutLog) {
    throw new Error('Failed to create workout log')
  }

  return createdWorkoutLog
}

function addDaysToDayKey(dayKey: string, days: number) {
  const parsed = parseDayKey(dayKey)
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days))
  return formatDayKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

function getWeekdayFromDayKey(dayKey: string): Weekday {
  const parsed = parseDayKey(dayKey)
  const dayIndex = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay()
  const WEEKDAYS = Object.values(Weekday)
  const enumIndex = (dayIndex + 6) % 7
  return WEEKDAYS[enumIndex]
}

function getWeekStartDayKey(dayKey: string) {
  const parsed = parseDayKey(dayKey)
  const day = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay()
  const mondayDiff = day === 0 ? -6 : 1 - day
  return addDaysToDayKey(dayKey, mondayDiff)
}

function getRollingRangeFromDayKey(dayKey: string, totalDays: number) {
  const endDayKey = parseDayKey(dayKey).key
  const startDayKey = addDaysToDayKey(endDayKey, -(totalDays - 1))
  return {
    start: getUtcRangeForDayKeyInTimeZone(startDayKey, APP_TIMEZONE).start,
    end: getUtcRangeForDayKeyInTimeZone(endDayKey, APP_TIMEZONE).end,
  }
}

function formatDayKeyForLabel(dayKey: string) {
  return new Date(`${dayKey}T12:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: APP_TIMEZONE,
  })
}

type FlatSetRecord = {
  value: number
}

function getStatsFromSets(sets: FlatSetRecord[]) {
  if (sets.length === 0) {
    return {
      best: null,
      avg: null,
      worst: null,
    }
  }

  const values = sets.map((set) => set.value)
  const best = Math.max(...values)
  const worst = Math.min(...values)
  const sum = values.reduce((acc, value) => acc + value, 0)
  const avg = Number((sum / values.length).toFixed(2))

  return { best, avg, worst }
}

function setToNumericValue(set: { type: SetType; reps?: number; duration?: number }) {
  if (set.type === SetType.REPS) {
    return typeof set.reps === 'number' ? set.reps : null
  }
  return typeof set.duration === 'number' ? set.duration : null
}

async function getAuthenticatedUserObjectId() {
  const session = await useAppSession()
  const userId = session.data.userId
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Unauthorized')
  }
  return new mongoose.Types.ObjectId(userId)
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
        start: getUtcRangeForDayKeyInTimeZone(currentWeekStartDayKey, APP_TIMEZONE).start,
        end: getUtcRangeForDayKeyInTimeZone(currentWeekEndDayKey, APP_TIMEZONE).end,
      }

      const [categories, exerciseDocs, dayLogs, monthRangeLogs] = await Promise.all([
        ExerciseCategoryModel.find({ userId }).sort({ createdAt: 1 }).lean(),
        ExerciseModel.find({ userId }).sort({ createdAt: 1 }).lean(),
        findWorkoutLogsForDay(userId, selectedDayKey, { lean: true }),
        WorkoutLogModel.find({
          userId,
          date: {
            $gte: monthRange.start,
            $lte: monthRange.end,
          },
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

      const collectSetsByExercise = (
        logs: Array<{
          exercises: Array<{
            exercise: { exerciseId: mongoose.Types.ObjectId }
            sets: Array<{ type: SetType; reps?: number; duration?: number }>
          }>
        }>,
      ) => {
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
              sets: Array<{ type: SetType; reps?: number; duration?: number }>
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
              .filter(
                (
                  log: {
                    id: string
                    exerciseId: string
                    exerciseName: string
                    type: SetType
                    value: number
                    date: string
                    timestamp: string
                  } | null,
                ): log is NonNullable<typeof log> => Boolean(log),
              )
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

export const addWorkoutCategoryFn = createServerFn({ method: 'POST' })
  .inputValidator(categoryInputSchema)
  .handler(async ({ data }) => {
    await connectDB()
    const userId = await getAuthenticatedUserObjectId()

    const existing = await ExerciseCategoryModel.findOne({
      userId,
      name: data.name.trim(),
    }).lean()
    if (existing) {
      return { success: true }
    }

    await ExerciseCategoryModel.create({
      userId,
      name: data.name.trim(),
      color: data.color,
    })

    return { success: true }
  })

export const removeWorkoutCategoryFn = createServerFn({ method: 'POST' })
  .inputValidator(categoryIdInputSchema)
  .handler(async ({ data }) => {
    await connectDB()
    const userId = await getAuthenticatedUserObjectId()
    const categoryObjectId = new mongoose.Types.ObjectId(data.categoryId)

    await ExerciseCategoryModel.deleteOne({ _id: categoryObjectId, userId })
    await ExerciseModel.updateMany({ userId }, { $pull: { categories: categoryObjectId } })

    return { success: true }
  })

export const updateWorkoutCategoryColorFn = createServerFn({ method: 'POST' })
  .inputValidator(updateCategoryColorInputSchema)
  .handler(async ({ data }) => {
    await connectDB()
    const userId = await getAuthenticatedUserObjectId()

    await ExerciseCategoryModel.updateOne(
      {
        _id: new mongoose.Types.ObjectId(data.categoryId),
        userId,
      },
      {
        $set: {
          color: data.color,
        },
      },
    )

    return { success: true }
  })

export const addWorkoutExerciseFn = createServerFn({ method: 'POST' })
  .inputValidator(exerciseCreateInputSchema)
  .handler(async ({ data }) => {
    await connectDB()
    const userId = await getAuthenticatedUserObjectId()
    const name = data.name.trim()

    await ExerciseModel.findOneAndUpdate(
      {
        userId,
        name,
      },
      {
        $setOnInsert: {
          userId,
          name,
          categories: [],
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      },
    )

    return { success: true }
  })

export const removeWorkoutExerciseFn = createServerFn({ method: 'POST' })
  .inputValidator(removeExerciseInputSchema)
  .handler(async ({ data }) => {
    await connectDB()
    const userId = await getAuthenticatedUserObjectId()
    const exerciseId = new mongoose.Types.ObjectId(data.exerciseId)

    await ExerciseModel.deleteOne({ _id: exerciseId, userId })
    await WorkoutLogModel.updateMany(
      {
        userId,
      },
      { $pull: { exercises: { 'exercise.exerciseId': exerciseId } } },
    )

    return { success: true }
  })

export const renameWorkoutExerciseFn = createServerFn({ method: 'POST' })
  .inputValidator(renameExerciseInputSchema)
  .handler(async ({ data }) => {
    await connectDB()
    const userId = await getAuthenticatedUserObjectId()
    const nextName = data.nextName.trim()

    const duplicate = await ExerciseModel.findOne({
      userId,
      name: nextName,
      _id: { $ne: new mongoose.Types.ObjectId(data.exerciseId) },
    }).lean()
    if (duplicate) {
      return { success: true }
    }

    await ExerciseModel.updateOne(
      { _id: new mongoose.Types.ObjectId(data.exerciseId), userId },
      { $set: { name: nextName } },
    )

    return { success: true }
  })

export const updateWorkoutExerciseWeeklyGoalFn = createServerFn({ method: 'POST' })
  .inputValidator(updateExerciseWeeklyGoalInputSchema)
  .handler(async ({ data }) => {
    await connectDB()
    const userId = await getAuthenticatedUserObjectId()
    const updated = await ExerciseModel.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(data.exerciseId), userId },
      { $set: { weeklySetGoal: data.weeklySetGoal } },
      { returnDocument: 'after' },
    ).lean()
    appLogInfo('BW_WEEKLY_GOAL_UPDATED', 'Weekly exercise goal updated', {
      source: 'user',
      exerciseId: data.exerciseId,
      weeklySetGoal: data.weeklySetGoal,
    })

    return {
      success: true,
      weeklySetGoal: typeof updated?.weeklySetGoal === 'number' ? updated.weeklySetGoal : null,
    }
  })

export const toggleWorkoutExerciseCategoryFn = createServerFn({ method: 'POST' })
  .inputValidator(toggleExerciseCategoryInputSchema)
  .handler(async ({ data }) => {
    await connectDB()
    const userId = await getAuthenticatedUserObjectId()
    const exerciseId = new mongoose.Types.ObjectId(data.exerciseId)
    const categoryObjectId = new mongoose.Types.ObjectId(data.categoryId)

    const exercise = await ExerciseModel.findOne({ _id: exerciseId, userId })
    if (!exercise) {
      return { success: true }
    }

    const exists = (exercise.categories || []).some(
      (value: mongoose.Types.ObjectId | string) => String(value) === String(categoryObjectId),
    )
    if (exists) {
      exercise.categories = (exercise.categories || []).filter(
        (value: mongoose.Types.ObjectId | string) => String(value) !== String(categoryObjectId),
      )
    } else {
      exercise.categories = [...(exercise.categories || []), categoryObjectId]
    }

    await exercise.save()
    return { success: true }
  })

export const addWorkoutSetFn = createServerFn({ method: 'POST' })
  .inputValidator(addSetInputSchema)
  .handler(async ({ data }) => {
    await connectDB()
    const userId = await getAuthenticatedUserObjectId()
    const selectedDayKey = parseSelectedDayKey(data.selectedDay)
    const exerciseId = new mongoose.Types.ObjectId(data.exerciseId)
    const workoutLog = await findOrCreateWorkoutLogForDay(userId, selectedDayKey)

    let exerciseEntry = workoutLog.exercises.find(
      (entry: { exercise: { exerciseId: mongoose.Types.ObjectId | string } }) =>
        String(entry.exercise.exerciseId) === String(exerciseId),
    )
    if (!exerciseEntry) {
      workoutLog.exercises.push({
        exercise: {
          exerciseId,
        },
        sets: [],
      })
      exerciseEntry = workoutLog.exercises[workoutLog.exercises.length - 1]
    }

    if (data.type === SetType.REPS && typeof data.reps === 'number') {
      exerciseEntry.sets.push({
        type: SetType.REPS,
        reps: data.reps,
        loggedAt: createLogTimestampForDayKey(selectedDayKey, APP_TIMEZONE),
      })
    }
    if (data.type === SetType.TIMED && typeof data.duration === 'number') {
      exerciseEntry.sets.push({
        type: SetType.TIMED,
        duration: data.duration,
        loggedAt: createLogTimestampForDayKey(selectedDayKey, APP_TIMEZONE),
      })
    }

    await workoutLog.save()
    appLogInfo('BW_SET_LOG_USER', 'Set logged from app UI', {
      source: 'user',
      selectedDayKey,
      exerciseId: data.exerciseId,
      type: data.type,
      reps: data.reps,
      duration: data.duration,
    })
    return { success: true }
  })

export const removeWorkoutSetFn = createServerFn({ method: 'POST' })
  .inputValidator(removeSetInputSchema)
  .handler(async ({ data }) => {
    await connectDB()
    const userId = await getAuthenticatedUserObjectId()
    const selectedDayKey = parseSelectedDayKey(data.selectedDay)
    const isTokenBasedLogId = data.logId.includes('|')
    const [exerciseKeyRaw, setKeyRaw] = data.logId.split(':')
    const workoutLogs = await findWorkoutLogsForDay(userId, selectedDayKey)

    for (const workoutLog of workoutLogs) {
      if (!isTokenBasedLogId) {
        const numericExerciseIndex = Number(exerciseKeyRaw)
        const numericSetIndex = Number(setKeyRaw)
        if (!Number.isNaN(numericExerciseIndex) && !Number.isNaN(numericSetIndex)) {
          const legacyExercise = workoutLog.exercises[numericExerciseIndex]
          if (!legacyExercise) {
            continue
          }
          legacyExercise.sets.splice(numericSetIndex, 1)
          if (legacyExercise.sets.length === 0) {
            workoutLog.exercises.splice(numericExerciseIndex, 1)
          }
          if (!workoutLog.dayKey) {
            workoutLog.dayKey = selectedDayKey
          }
          await workoutLog.save()
          return { success: true }
        }
      }

      if (isTokenBasedLogId) {
        const [exerciseIdToken, loggedAtMsToken, setTypeToken, valueToken] = data.logId.split('|')
        const exerciseIndex = workoutLog.exercises.findIndex(
          (entry: { exercise: { exerciseId: mongoose.Types.ObjectId | string } }) =>
            String(entry.exercise.exerciseId) === exerciseIdToken,
        )
        if (exerciseIndex === -1) {
          continue
        }
        const exercise = workoutLog.exercises[exerciseIndex]
        const loggedAtMs = Number(loggedAtMsToken)
        const value = Number(valueToken)
        const setIndex = exercise.sets.findIndex(
          (setEntry: { loggedAt?: Date; type?: SetType; reps?: number; duration?: number }) => {
            const setLoggedAtMs = setEntry.loggedAt ? new Date(setEntry.loggedAt).getTime() : NaN
            const setValue =
              setTypeToken === 'timed' ? Number(setEntry.duration || 0) : Number(setEntry.reps || 0)
            const setTypeMatches =
              (setTypeToken === 'timed' && setEntry.type === SetType.TIMED) ||
              (setTypeToken === 'reps' && setEntry.type === SetType.REPS)
            return setTypeMatches && setValue === value && setLoggedAtMs === loggedAtMs
          },
        )
        if (setIndex === -1) {
          continue
        }
        exercise.sets.splice(setIndex, 1)
        if (exercise.sets.length === 0) {
          workoutLog.exercises.splice(exerciseIndex, 1)
        }
        if (!workoutLog.dayKey) {
          workoutLog.dayKey = selectedDayKey
        }
        await workoutLog.save()
        return { success: true }
      }

      const exerciseIndex = workoutLog.exercises.findIndex(
        (entry: { exercise: { exerciseId: mongoose.Types.ObjectId | string } }) =>
          String(entry.exercise.exerciseId) === exerciseKeyRaw,
      )
      if (exerciseIndex === -1) {
        continue
      }
      const exercise = workoutLog.exercises[exerciseIndex]
      const setIndex = exercise.sets.findIndex(
        (setEntry: { _id?: mongoose.Types.ObjectId | string }) =>
          String(setEntry._id) === setKeyRaw,
      )
      if (setIndex === -1) {
        continue
      }
      exercise.sets.splice(setIndex, 1)
      if (exercise.sets.length === 0) {
        workoutLog.exercises.splice(exerciseIndex, 1)
      }
      if (!workoutLog.dayKey) {
        workoutLog.dayKey = selectedDayKey
      }
      await workoutLog.save()
      return { success: true }
    }

    return { success: true }
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
      const start = getUtcRangeForDayKeyInTimeZone(startDayKey, APP_TIMEZONE).start
      const end = getUtcRangeForDayKeyInTimeZone(endDayKey, APP_TIMEZONE).end
      const label = `${formatDayKeyForLabel(startDayKey)} - ${formatDayKeyForLabel(endDayKey)}`
      return { start, end, label }
    })

    const oldestStart =
      weekRanges[weekRanges.length - 1]?.start ||
      getUtcRangeForDayKeyInTimeZone(todayDayKey, APP_TIMEZONE).start
    const newestEnd =
      weekRanges[0]?.end || getUtcRangeForDayKeyInTimeZone(todayDayKey, APP_TIMEZONE).end

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

    logs.forEach((log) => {
      const weekIndex = weekRanges.findIndex(
        (range) => log.date >= range.start && log.date <= range.end,
      )
      if (weekIndex === -1) {
        return
      }

      log.exercises.forEach(
        (entry: {
          exercise: { exerciseId: mongoose.Types.ObjectId | string }
          sets: Array<{ type: SetType; reps?: number; duration?: number }>
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
    })

    return {
      weeks: weekRanges.map((range) => range.label),
      rows: Array.from(categoryRowMap.values()),
    }
  })
