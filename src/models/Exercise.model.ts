import mongoose from 'mongoose'

const exerciseModelSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    categories: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'ExerciseCategory',
      required: true,
      default: [],
    },
  },
  {
    timestamps: true,
  },
)

exerciseModelSchema.index({ userId: 1, name: 1 }, { unique: true })

export const ExerciseModel =
  mongoose.models.Exercise || mongoose.model('Exercise', exerciseModelSchema)
