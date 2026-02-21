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

function parseSelectedDay(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid selected day')
  }
  date.setHours(0, 0, 0, 0)
  return date
}

function getWeekdayFromDate(date: Date): Weekday {
  const day = date.getDay()
  if (day === 0) return Weekday.SUNDAY
  if (day === 1) return Weekday.MONDAY
  if (day === 2) return Weekday.TUESDAY
  if (day === 3) return Weekday.WEDNESDAY
  if (day === 4) return Weekday.THURSDAY
  if (day === 5) return Weekday.FRIDAY
  return Weekday.SATURDAY
}

function normalizeDayStart(value: Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function getWeekStart(date: Date) {
  const day = date.getDay()
  const mondayDiff = day === 0 ? -6 : 1 - day
  const result = new Date(date)
  result.setDate(result.getDate() + mondayDiff)
  return normalizeDayStart(result)
}

function getWeekEnd(weekStart: Date) {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
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
    const selectedDate = parseSelectedDay(data.selectedDay)
    const weekday = getWeekdayFromDate(selectedDate)

    const [categories, weekView, workoutLog, weekRangeLogs, monthRangeLogs] = await Promise.all([
      ExerciseCategoryModel.find({ userId }).sort({ createdAt: 1 }).lean(),
      WeekViewModel.findOne({ userId, weekday }).lean(),
      WorkoutLogModel.findOne({ userId, date: selectedDate, weekday }).lean(),
      WorkoutLogModel.find({
        userId,
        date: {
          $gte: getWeekStart(selectedDate),
          $lte: getWeekEnd(getWeekStart(selectedDate)),
        },
      }).lean(),
      WorkoutLogModel.find({
        userId,
        date: {
          $gte: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
          $lte: new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth() + 1,
            0,
            23,
            59,
            59,
            999,
          ),
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

              const timestamp = new Date(selectedDate.getTime() + setIndex * 1000).toISOString()
              return {
                id: `${exerciseIndex}:${setIndex}`,
                exerciseId,
                exerciseName: exercise.name,
                type: set.type,
                value,
                date: data.selectedDay,
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
    const selectedDate = parseSelectedDay(data.selectedDay)
    const weekday = getWeekdayFromDate(selectedDate)
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
    const selectedDate = parseSelectedDay(data.selectedDay)
    const weekday = getWeekdayFromDate(selectedDate)
    const exerciseId = new mongoose.Types.ObjectId(data.exerciseId)
    await WeekViewModel.updateOne({ userId, weekday }, { $pull: { exercises: { exerciseId } } })
    await WorkoutLogModel.updateMany(
      { userId, date: selectedDate, weekday },
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
    const selectedDate = parseSelectedDay(data.selectedDay)
    const weekday = getWeekdayFromDate(selectedDate)
    const exerciseId = new mongoose.Types.ObjectId(data.exerciseId)

    let workoutLog = await WorkoutLogModel.findOne({
      userId,
      date: selectedDate,
      weekday,
    })

    if (!workoutLog) {
      workoutLog = await WorkoutLogModel.create({
        userId,
        date: selectedDate,
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
    const selectedDate = parseSelectedDay(data.selectedDay)
    const weekday = getWeekdayFromDate(selectedDate)

    const [exerciseIndexRaw, setIndexRaw] = data.logId.split(':')
    const exerciseIndex = Number(exerciseIndexRaw)
    const setIndex = Number(setIndexRaw)

    if (Number.isNaN(exerciseIndex) || Number.isNaN(setIndex)) {
      return { success: true }
    }

    const workoutLog = await WorkoutLogModel.findOne({
      userId,
      date: selectedDate,
      weekday,
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

    const now = new Date()
    const currentWeekStart = getWeekStart(now)

    const weekRanges = Array.from({ length: data.weeks }).map((_, index) => {
      const start = new Date(currentWeekStart)
      start.setDate(start.getDate() - index * 7)
      const end = getWeekEnd(start)
      const label = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      return { start, end, label }
    })

    const oldestStart = weekRanges[weekRanges.length - 1]?.start || currentWeekStart
    const newestEnd = weekRanges[0]?.end || getWeekEnd(currentWeekStart)

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
