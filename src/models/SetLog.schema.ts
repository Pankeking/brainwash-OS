import mongoose from 'mongoose'
import { SetType } from '../enums/enums'

export const SetLogSchema = new mongoose.Schema(
  {
    type: { type: String, enum: Object.values(SetType), required: true },
    loggedAt: { type: Date },
    reps: {
      type: Number,
      min: 1,
      validate: {
        validator: function (value: unknown): boolean {
          if (this.type !== SetType.REPS) {
            return value === undefined || value === null
          }
          return typeof value === 'number' && value >= 1
        },
        message: 'reps only for type "reps"',
      },
    },
    duration: {
      type: Number,
      min: 1,
      validate: {
        validator: function (value: unknown): boolean {
          if (this.type !== SetType.TIMED) {
            return value === undefined || value === null
          }
          return typeof value === 'number' && value >= 1
        },
        message: 'duration only for type "timed"',
      },
    },
  },
  { _id: false },
)
