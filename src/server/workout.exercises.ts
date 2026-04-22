import mongoose from 'mongoose'
import { createServerFn } from '@tanstack/react-start'

import { ExerciseModel } from '~/models/Exercise.model'
import { WorkoutLogModel } from '~/models/WorkoutLog.model'

import connectDB from './db'
import { appLogInfo } from './logger'
import { getAuthenticatedUserObjectId } from './workout.auth'
import {
  exerciseCreateInputSchema,
  removeExerciseInputSchema,
  renameExerciseInputSchema,
  toggleExerciseCategoryInputSchema,
  updateExerciseWeeklyGoalInputSchema,
} from './workout.schemas'

export const addWorkoutExerciseFn = createServerFn({ method: 'POST' })
  .inputValidator(exerciseCreateInputSchema)
  .handler(async ({ data }) => {
    await connectDB()
    const userId = await getAuthenticatedUserObjectId()
    const name = data.name.trim()

    await ExerciseModel.findOneAndUpdate(
      { userId, name },
      {
        $setOnInsert: {
          userId,
          name,
          categories: [],
          preferredSetType: 'reps',
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
      { userId },
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
      {
        $set: {
          weeklySetGoal: data.weeklySetGoal,
          ...(data.weeklyVolumeGoal !== undefined
            ? { weeklyVolumeGoal: data.weeklyVolumeGoal }
            : {}),
          ...(data.setTargetValue !== undefined ? { setTargetValue: data.setTargetValue } : {}),
          ...(data.preferredSetType ? { preferredSetType: data.preferredSetType } : {}),
        },
      },
      { returnDocument: 'after' },
    ).lean()

    appLogInfo('BW_WEEKLY_GOAL_UPDATED', 'Weekly exercise goal updated', {
      source: 'user',
      exerciseId: data.exerciseId,
      weeklySetGoal: data.weeklySetGoal,
      setTargetValue: data.setTargetValue,
    })

    return {
      success: true,
      preferredSetType:
        updated?.preferredSetType === 'timed'
          ? 'timed'
          : updated?.preferredSetType === 'reps'
            ? 'reps'
            : null,
      weeklySetGoal: typeof updated?.weeklySetGoal === 'number' ? updated.weeklySetGoal : null,
      weeklyVolumeGoal:
        typeof updated?.weeklyVolumeGoal === 'number' ? updated.weeklyVolumeGoal : null,
      setTargetValue: typeof updated?.setTargetValue === 'number' ? updated.setTargetValue : null,
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
    exercise.categories = exists
      ? (exercise.categories || []).filter(
          (value: mongoose.Types.ObjectId | string) => String(value) !== String(categoryObjectId),
        )
      : [...(exercise.categories || []), categoryObjectId]

    await exercise.save()
    return { success: true }
  })
