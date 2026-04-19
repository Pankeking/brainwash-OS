import type mongoose from 'mongoose'

import { BodyMetricDefinitionModel } from '~/models/BodyMetricDefinition.model'
import { BodyMeasurementLogModel } from '~/models/BodyMeasurementLog.model'

import { createLogTimestampForDayKey, getUtcRangeForDayKey } from './dayKey'
import { APP_TIMEZONE, parseSelectedDayKey } from './workout.utils'

export type BodyMetricDefinition = {
  key: string
  label: string
  kind: 'weight' | 'size'
  unit: 'kg' | 'cm'
  isCustom: boolean
}

export const BODY_METRIC_DEFINITIONS: BodyMetricDefinition[] = [
  { key: 'weight', label: 'Weight', kind: 'weight', unit: 'kg', isCustom: false },
  { key: 'waist', label: 'Waist', kind: 'size', unit: 'cm', isCustom: false },
  { key: 'bicep', label: 'Bicep', kind: 'size', unit: 'cm', isCustom: false },
  { key: 'chest', label: 'Chest', kind: 'size', unit: 'cm', isCustom: false },
  { key: 'hips', label: 'Hips', kind: 'size', unit: 'cm', isCustom: false },
  { key: 'thigh', label: 'Thigh', kind: 'size', unit: 'cm', isCustom: false },
  { key: 'calf', label: 'Calf', kind: 'size', unit: 'cm', isCustom: false },
  { key: 'neck', label: 'Neck', kind: 'size', unit: 'cm', isCustom: false },
]

export function getBodyMetricDefinition(metricKey: string) {
  return BODY_METRIC_DEFINITIONS.find((metric) => metric.key === metricKey) || null
}

export function toBodyMetricKey(label: string) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export async function getBodyMetricDefinitionsForUser(userId: mongoose.Types.ObjectId) {
  const customDefinitions = await BodyMetricDefinitionModel.find({ userId })
    .sort({ createdAt: 1 })
    .lean()
  return [
    ...BODY_METRIC_DEFINITIONS,
    ...customDefinitions.map((definition) => ({
      key: definition.key,
      label: definition.label,
      kind: definition.kind,
      unit: definition.unit,
      isCustom: Boolean(definition.isCustom),
    })),
  ]
}

export async function getBodyMetricDefinitionForUser(
  userId: mongoose.Types.ObjectId,
  metricKeyOrLabel: string,
) {
  const normalized = metricKeyOrLabel.trim().toLowerCase()
  const builtIn = BODY_METRIC_DEFINITIONS.find(
    (definition) =>
      definition.key.toLowerCase() === normalized || definition.label.toLowerCase() === normalized,
  )
  if (builtIn) {
    return builtIn
  }

  const escapedLabel = metricKeyOrLabel.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const custom = await BodyMetricDefinitionModel.findOne({
    userId,
    $or: [{ key: normalized }, { label: new RegExp(`^${escapedLabel}$`, 'i') }],
  }).lean()
  if (!custom) {
    return null
  }

  return {
    key: custom.key,
    label: custom.label,
    kind: custom.kind,
    unit: custom.unit,
    isCustom: custom.isCustom,
  }
}

export async function findOrCreateBodyMeasurementLogForDay(
  userId: mongoose.Types.ObjectId,
  selectedDay: string,
) {
  const dayKey = parseSelectedDayKey(selectedDay)
  const existing = await BodyMeasurementLogModel.findOne({
    userId,
    dayKey,
  })
  if (existing) {
    return existing
  }

  const created = await BodyMeasurementLogModel.findOneAndUpdate(
    {
      userId,
      dayKey,
    },
    {
      $setOnInsert: {
        userId,
        dayKey,
        date: createLogTimestampForDayKey(dayKey, APP_TIMEZONE),
        measurements: [],
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
    },
  )

  if (!created) {
    throw new Error('Failed to create body measurement log')
  }

  return created
}

export async function findBodyMeasurementLogsForRange(
  userId: mongoose.Types.ObjectId,
  fromDayKey: string,
  toDayKey: string,
) {
  const start = getUtcRangeForDayKey(fromDayKey, APP_TIMEZONE).start
  const end = getUtcRangeForDayKey(toDayKey, APP_TIMEZONE).end

  return await BodyMeasurementLogModel.find({
    userId,
    date: { $gte: start, $lte: end },
  })
    .sort({ date: -1 })
    .lean()
}
