import mongoose from 'mongoose'

const exerciseCategorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    color: { type: String, required: true },
  },
  {
    timestamps: true,
  },
)

exerciseCategorySchema.index({ userId: 1, name: 1 }, { unique: true })

export const ExerciseCategoryModel =
  mongoose.models.ExerciseCategory || mongoose.model('ExerciseCategory', exerciseCategorySchema)
