import mongoose from 'mongoose'
import { ExerciseSchema } from './Exercise.schema'
import { Weekday } from '../enums/enums'

const weekViewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    weekday: { type: String, enum: Object.values(Weekday), required: true },
    exercises: [ExerciseSchema],
  },
  {
    timestamps: true,
  },
)

weekViewSchema.index({ userId: 1, weekday: 1 }, { unique: true })

export const WeekViewModel = mongoose.models.WeekView || mongoose.model('WeekView', weekViewSchema)
