import mongoose from 'mongoose'

export const ExerciseSchema = new mongoose.Schema(
  {
    exerciseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exercise',
      required: true,
      index: true,
    },
  },
  { _id: false },
)
