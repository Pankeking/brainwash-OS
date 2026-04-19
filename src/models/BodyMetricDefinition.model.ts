import mongoose from 'mongoose'

type BodyMetricDefinitionDoc = {
  userId: mongoose.Types.ObjectId
  key: string
  label: string
  kind: 'weight' | 'size'
  unit: 'kg' | 'cm'
  isCustom: boolean
}

const bodyMetricDefinitionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    key: { type: String, required: true },
    label: { type: String, required: true },
    kind: { type: String, enum: ['weight', 'size'], required: true },
    unit: { type: String, enum: ['kg', 'cm'], required: true },
    isCustom: { type: Boolean, required: true, default: true },
  },
  {
    timestamps: true,
  },
)

bodyMetricDefinitionSchema.index({ userId: 1, key: 1 }, { unique: true })
bodyMetricDefinitionSchema.index({ userId: 1, label: 1 }, { unique: true })

export const BodyMetricDefinitionModel =
  (mongoose.models.BodyMetricDefinition as mongoose.Model<BodyMetricDefinitionDoc> | undefined) ||
  mongoose.model<BodyMetricDefinitionDoc>('BodyMetricDefinition', bodyMetricDefinitionSchema)
