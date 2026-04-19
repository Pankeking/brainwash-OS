import mongoose from 'mongoose'

const bodyMeasurementEntrySchema = new mongoose.Schema(
  {
    metricKey: { type: String, required: true },
    label: { type: String, required: true },
    kind: { type: String, enum: ['weight', 'size'], required: true },
    unit: { type: String, enum: ['kg', 'cm'], required: true },
    value: { type: Number, required: true, min: 0 },
    loggedAt: { type: Date, required: true },
  },
  {
    timestamps: false,
  },
)

const bodyMeasurementLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    dayKey: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    measurements: {
      type: [bodyMeasurementEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
)

bodyMeasurementLogSchema.index({ userId: 1, dayKey: 1 }, { unique: true })

export const BodyMeasurementLogModel =
  mongoose.models.BodyMeasurementLog ||
  mongoose.model('BodyMeasurementLog', bodyMeasurementLogSchema)
