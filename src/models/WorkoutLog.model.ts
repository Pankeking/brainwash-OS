import mongoose from 'mongoose'
import { ExerciseSchema } from './Exercise.schema'
import { Weekday } from '../enums/enums'
import { SetLogSchema } from './SetLog.schema'

const workoutLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: { type: Date, required: true, index: true },
    weekday: { type: String, enum: Object.values(Weekday), required: true },
    exercises: [
      {
        exercise: ExerciseSchema,
        sets: [SetLogSchema],
      },
    ],
  },
  {
    timestamps: true,
  },
)

workoutLogSchema.index({ userId: 1, date: -1 })
workoutLogSchema.index({ userId: 1, weekday: 1 })
workoutLogSchema.index({ userId: 1, date: 1, weekday: 1 }, { unique: true })

export const WorkoutLogModel =
  mongoose.models.WorkoutLog || mongoose.model('WorkoutLog', workoutLogSchema)
