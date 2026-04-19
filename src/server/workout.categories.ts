import mongoose from 'mongoose'
import { createServerFn } from '@tanstack/react-start'

import { ExerciseCategoryModel } from '~/models/ExerciseCategory.model'
import { ExerciseModel } from '~/models/Exercise.model'

import connectDB from './db'
import { getAuthenticatedUserObjectId } from './workout.auth'
import {
  categoryIdInputSchema,
  categoryInputSchema,
  updateCategoryColorInputSchema,
} from './workout.schemas'

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
