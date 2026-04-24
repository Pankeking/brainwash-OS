import { createServerFn } from '@tanstack/react-start'

import {
  categoryIdInputSchema,
  categoryInputSchema,
  updateCategoryColorInputSchema,
} from './workout.schemas'

async function getCategoryMutationContext() {
  const [
    { default: mongoose },
    { default: connectDB },
    { ExerciseCategoryModel },
    { ExerciseModel },
    { getAuthenticatedUserObjectId },
  ] = await Promise.all([
    import('mongoose'),
    import('./db'),
    import('~/models/ExerciseCategory.model'),
    import('~/models/Exercise.model'),
    import('./workout.auth'),
  ])
  await connectDB()
  const userId = await getAuthenticatedUserObjectId()

  return {
    ExerciseCategoryModel,
    ExerciseModel,
    mongoose,
    userId,
  }
}

export const addWorkoutCategoryFn = createServerFn({ method: 'POST' })
  .inputValidator(categoryInputSchema)
  .handler(async ({ data }) => {
    const { ExerciseCategoryModel, userId } = await getCategoryMutationContext()

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
    const { ExerciseCategoryModel, ExerciseModel, mongoose, userId } =
      await getCategoryMutationContext()
    const categoryObjectId = new mongoose.Types.ObjectId(data.categoryId)

    await ExerciseCategoryModel.deleteOne({ _id: categoryObjectId, userId })
    await ExerciseModel.updateMany({ userId }, { $pull: { categories: categoryObjectId } })

    return { success: true }
  })

export const updateWorkoutCategoryColorFn = createServerFn({ method: 'POST' })
  .inputValidator(updateCategoryColorInputSchema)
  .handler(async ({ data }) => {
    const { ExerciseCategoryModel, mongoose, userId } = await getCategoryMutationContext()

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
