import mongoose from 'mongoose'

type ExerciseModelDoc = {
  userId: mongoose.Types.ObjectId
  name: string
  categories: mongoose.Types.ObjectId[]
  weeklySetGoal?: number | null
}

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
    weeklySetGoal: {
      type: Number,
      min: 1,
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

exerciseModelSchema.index({ userId: 1, name: 1 }, { unique: true })

const existingExerciseModel = mongoose.models.Exercise

if (existingExerciseModel && !existingExerciseModel.schema.path('weeklySetGoal')) {
  ;(existingExerciseModel as mongoose.Model<ExerciseModelDoc>).schema.add({
    weeklySetGoal: {
      type: Number,
      min: 1,
      default: null,
    },
  })
}

export const ExerciseModel =
  (existingExerciseModel as mongoose.Model<ExerciseModelDoc> | undefined) ||
  mongoose.model<ExerciseModelDoc>('Exercise', exerciseModelSchema)
