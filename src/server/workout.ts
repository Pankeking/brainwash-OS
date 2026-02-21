import mongoose from 'mongoose'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { useAppSession } from '~/utils/session'
import { SetType, Weekday } from '~/enums/enums'
import connectDB from './db'
import { ExerciseCategoryModel } from '~/models/ExerciseCategory.model'
import { WeekViewModel } from '~/models/WeekView.model'
import { WorkoutLogModel } from '~/models/WorkoutLog.model'
import { ExerciseModel } from '~/models/Exercise.model'

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
const SELECTED_DAY_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  return { year, month, day }
}

function getTimePartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value)
  const second = Number(parts.find((part) => part.type === 'second')?.value)
  return { hour, minute, second }
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getDatePartsInTimeZone(date, timeZone)
  const timeParts = getTimePartsInTimeZone(date, timeZone)
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    timeParts.hour,
    timeParts.minute,
    timeParts.second,
    date.getUTCMilliseconds(),
  )
  return asUtc - date.getTime()
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string,
) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone)
  let timestamp = utcGuess - firstOffset
  const secondOffset = getTimeZoneOffsetMs(new Date(timestamp), timeZone)
  if (secondOffset !== firstOffset) {
    timestamp = utcGuess - secondOffset
  }
  return new Date(timestamp)
}

function formatDayKey(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function dayKeyFromDateInTimeZone(date: Date, timeZone: string) {
  const parts = getDatePartsInTimeZone(date, timeZone)
  return formatDayKey(parts.year, parts.month, parts.day)
}

function parseDayKey(value: string) {
  if (!SELECTED_DAY_KEY_REGEX.test(value)) {
    throw new Error('Invalid selected day')
  }
  const [yearRaw, monthRaw, dayRaw] = value.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  const control = new Date(Date.UTC(year, month - 1, day))
  if (
    control.getUTCFullYear() !== year ||
    control.getUTCMonth() + 1 !== month ||
    control.getUTCDate() !== day
  ) {
    throw new Error('Invalid selected day')
  }
  return { year, month, day, key: formatDayKey(year, month, day) }
}

function parseSelectedDayKey(value: string) {
  if (SELECTED_DAY_KEY_REGEX.test(value)) {
    return parseDayKey(value).key
  }
  const legacyDate = new Date(value)
  if (Number.isNaN(legacyDate.getTime())) {
    throw new Error('Invalid selected day')
  }
  return dayKeyFromDateInTimeZone(legacyDate, APP_TIMEZONE)
}

function addDaysToDayKey(dayKey: string, days: number) {
  const parsed = parseDayKey(dayKey)
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days))
  return formatDayKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

function getUtcRangeForDayKey(dayKey: string) {
  const parsed = parseDayKey(dayKey)
  const start = zonedDateTimeToUtc(parsed.year, parsed.month, parsed.day, 0, 0, 0, 0, APP_TIMEZONE)
  const end = zonedDateTimeToUtc(
    parsed.year,
    parsed.month,
    parsed.day,
    23,
    59,
    59,
    999,
    APP_TIMEZONE,
  )
  return { start, end }
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

function getMonthRangeFromDayKey(dayKey: string) {
  const parsed = parseDayKey(dayKey)
  const first = formatDayKey(parsed.year, parsed.month, 1)
  const lastDate = new Date(Date.UTC(parsed.year, parsed.month, 0))
  const last = formatDayKey(parsed.year, parsed.month, lastDate.getUTCDate())
  const start = getUtcRangeForDayKey(first).start
  const end = getUtcRangeForDayKey(last).end
  return { start, end }
}

function formatDayKeyForLabel(dayKey: string) {
  return new Date(`${dayKey}T12:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: APP_TIMEZONE,
  })
}

function createLogTimestampForDayKey(dayKey: string) {
  const selected = parseDayKey(dayKey)
  const now = new Date()
  const timeParts = getTimePartsInTimeZone(now, APP_TIMEZONE)
  return zonedDateTimeToUtc(
    selected.year,
    selected.month,
    selected.day,
    timeParts.hour,
    timeParts.minute,
    timeParts.second,
    now.getMilliseconds(),
    APP_TIMEZONE,
  )
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
    await connectDB()
    const userId = await getAuthenticatedUserObjectId()
    const selectedDayKey = parseSelectedDayKey(data.selectedDay)
    const selectedDayRange = getUtcRangeForDayKey(selectedDayKey)
    const weekday = getWeekdayFromDayKey(selectedDayKey)
    const weekStartDayKey = getWeekStartDayKey(selectedDayKey)
    const weekEndDayKey = addDaysToDayKey(weekStartDayKey, 6)
    const weekRange = {
      start: getUtcRangeForDayKey(weekStartDayKey).start,
      end: getUtcRangeForDayKey(weekEndDayKey).end,
    }
    const monthRange = getMonthRangeFromDayKey(selectedDayKey)

    const [categories, weekView, workoutLog, weekRangeLogs, monthRangeLogs] = await Promise.all([
      ExerciseCategoryModel.find({ userId }).sort({ createdAt: 1 }).lean(),
      WeekViewModel.findOne({ userId, weekday }).lean(),
      WorkoutLogModel.findOne({
        userId,
        weekday,
        date: {
          $gte: selectedDayRange.start,
          $lte: selectedDayRange.end,
        },
      }).lean(),
      WorkoutLogModel.find({
        userId,
        date: {
          $gte: weekRange.start,
          $lte: weekRange.end,
        },
      }).lean(),
      WorkoutLogModel.find({
        userId,
        date: {
          $gte: monthRange.start,
          $lte: monthRange.end,
        },
      }).lean(),
    ])

    const normalizedCategories = categories.map((category) => ({
      id: String(category._id),
      name: category.name,
      color: category.color,
    }))
    const exerciseIds = Array.from(
      new Set(
        (weekView?.exercises || []).map(
          (exercise: { exerciseId: mongoose.Types.ObjectId | string }) =>
            String(exercise.exerciseId),
        ),
      ),
    )
    const exerciseDocs = exerciseIds.length
      ? await ExerciseModel.find({ _id: { $in: exerciseIds } })
          .sort({ createdAt: 1 })
          .lean()
      : []
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
      return {
        id,
        name: exercise.name,
        categoryIds: (exercise.categories || []).map(
          (categoryId: mongoose.Types.ObjectId | string) => String(categoryId),
        ),
        stats: {
          week: getStatsFromSets(weekSetsByExercise.get(id) || []),
          month: getStatsFromSets(monthSetsByExercise.get(id) || []),
        },
      }
    })

    const logs =
      workoutLog?.exercises.flatMap(
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
            .map((set: { type: SetType; reps?: number; duration?: number }, setIndex: number) => {
              const value = setToNumericValue(set)
              if (value === null) {
                return null
              }

              const baseTimestamp = workoutLog?.date
                ? new Date(workoutLog.date).getTime()
                : Date.now()
              const timestamp = new Date(baseTimestamp + setIndex * 1000).toISOString()
              return {
                id: `${exerciseIndex}:${setIndex}`,
                exerciseId,
                exerciseName: exercise.name,
                type: set.type,
                value,
                date: selectedDayKey,
                timestamp,
              }
            })
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
      ) || []

    return {
      categories: normalizedCategories,
      exercises,
      logs,
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
    const selectedDayKey = parseSelectedDayKey(data.selectedDay)
    const weekday = getWeekdayFromDayKey(selectedDayKey)
    const name = data.name.trim()

    const exercise = await ExerciseModel.findOneAndUpdate(
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

    const weekView = await WeekViewModel.findOne({ userId, weekday })
    if (!weekView) {
      await WeekViewModel.create({
        userId,
        weekday,
        exercises: [{ exerciseId: exercise._id }],
      })
      return { success: true }
    }

    const exists = weekView.exercises.some(
      (row: { exerciseId: mongoose.Types.ObjectId | string }) =>
        String(row.exerciseId) === String(exercise._id),
    )
    if (!exists) {
      weekView.exercises.push({ exerciseId: exercise._id })
      await weekView.save()
    }

    return { success: true }
  })

export const removeWorkoutExerciseFn = createServerFn({ method: 'POST' })
  .inputValidator(removeExerciseInputSchema)
  .handler(async ({ data }) => {
    await connectDB()
    const userId = await getAuthenticatedUserObjectId()
    const selectedDayKey = parseSelectedDayKey(data.selectedDay)
    const selectedDayRange = getUtcRangeForDayKey(selectedDayKey)
    const weekday = getWeekdayFromDayKey(selectedDayKey)
    const exerciseId = new mongoose.Types.ObjectId(data.exerciseId)
    await WeekViewModel.updateOne({ userId, weekday }, { $pull: { exercises: { exerciseId } } })
    await WorkoutLogModel.updateMany(
      {
        userId,
        weekday,
        date: {
          $gte: selectedDayRange.start,
          $lte: selectedDayRange.end,
        },
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
    const selectedDayRange = getUtcRangeForDayKey(selectedDayKey)
    const weekday = getWeekdayFromDayKey(selectedDayKey)
    const exerciseId = new mongoose.Types.ObjectId(data.exerciseId)

    let workoutLog = await WorkoutLogModel.findOne({
      userId,
      weekday,
      date: {
        $gte: selectedDayRange.start,
        $lte: selectedDayRange.end,
      },
    })

    if (!workoutLog) {
      workoutLog = await WorkoutLogModel.create({
        userId,
        date: createLogTimestampForDayKey(selectedDayKey),
        weekday,
        exercises: [],
      })
    }

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
      })
    }
    if (data.type === SetType.TIMED && typeof data.duration === 'number') {
      exerciseEntry.sets.push({
        type: SetType.TIMED,
        duration: data.duration,
      })
    }

    await workoutLog.save()
    return { success: true }
  })

export const removeWorkoutSetFn = createServerFn({ method: 'POST' })
  .inputValidator(removeSetInputSchema)
  .handler(async ({ data }) => {
    await connectDB()
    const userId = await getAuthenticatedUserObjectId()
    const selectedDayKey = parseSelectedDayKey(data.selectedDay)
    const selectedDayRange = getUtcRangeForDayKey(selectedDayKey)
    const weekday = getWeekdayFromDayKey(selectedDayKey)

    const [exerciseIndexRaw, setIndexRaw] = data.logId.split(':')
    const exerciseIndex = Number(exerciseIndexRaw)
    const setIndex = Number(setIndexRaw)

    if (Number.isNaN(exerciseIndex) || Number.isNaN(setIndex)) {
      return { success: true }
    }

    const workoutLog = await WorkoutLogModel.findOne({
      userId,
      weekday,
      date: {
        $gte: selectedDayRange.start,
        $lte: selectedDayRange.end,
      },
    })
    if (!workoutLog) {
      return { success: true }
    }

    const exercise = workoutLog.exercises[exerciseIndex]
    if (!exercise) {
      return { success: true }
    }

    const actualSetIndex = setIndex
    if (actualSetIndex === undefined) {
      return { success: true }
    }

    exercise.sets.splice(actualSetIndex, 1)
    if (exercise.sets.length === 0) {
      workoutLog.exercises.splice(exerciseIndex, 1)
    }

    await workoutLog.save()
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
      const start = getUtcRangeForDayKey(startDayKey).start
      const end = getUtcRangeForDayKey(endDayKey).end
      const label = `${formatDayKeyForLabel(startDayKey)} - ${formatDayKeyForLabel(endDayKey)}`
      return { start, end, label }
    })

    const oldestStart =
      weekRanges[weekRanges.length - 1]?.start || getUtcRangeForDayKey(todayDayKey).start
    const newestEnd = weekRanges[0]?.end || getUtcRangeForDayKey(todayDayKey).end

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
