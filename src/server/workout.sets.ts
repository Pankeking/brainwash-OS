import mongoose from 'mongoose'
import { createServerFn } from '@tanstack/react-start'

import { SetType } from '~/enums/enums'

import connectDB from './db'
import { createLogTimestampForDayKey } from './dayKey'
import { appLogInfo } from './logger'
import { getAuthenticatedUserObjectId } from './workout.auth'
import { addSetInputSchema, removeSetInputSchema } from './workout.schemas'
import {
  APP_TIMEZONE,
  findOrCreateWorkoutLogForDay,
  findWorkoutLogsForDay,
  parseSelectedDayKey,
} from './workout.utils'

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
        exercise: { exerciseId },
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
