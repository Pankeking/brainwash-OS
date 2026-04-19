import type mongoose from 'mongoose'

import { BodyMeasurementLogModel } from '~/models/BodyMeasurementLog.model'

import { createLogTimestampForDayKey, getUtcRangeForDayKey } from './dayKey'
import { APP_TIMEZONE, parseSelectedDayKey } from './workout.utils'

export type BodyMetricDefinition = {
  key: string
  label: string
  kind: 'weight' | 'size'
  unit: 'kg' | 'cm'
}

export const BODY_METRIC_DEFINITIONS: BodyMetricDefinition[] = [
  { key: 'weight', label: 'Weight', kind: 'weight', unit: 'kg' },
  { key: 'waist', label: 'Waist', kind: 'size', unit: 'cm' },
  { key: 'bicep', label: 'Bicep', kind: 'size', unit: 'cm' },
  { key: 'chest', label: 'Chest', kind: 'size', unit: 'cm' },
  { key: 'hips', label: 'Hips', kind: 'size', unit: 'cm' },
  { key: 'thigh', label: 'Thigh', kind: 'size', unit: 'cm' },
  { key: 'calf', label: 'Calf', kind: 'size', unit: 'cm' },
  { key: 'neck', label: 'Neck', kind: 'size', unit: 'cm' },
]

export function getBodyMetricDefinition(metricKey: string) {
  return BODY_METRIC_DEFINITIONS.find((metric) => metric.key === metricKey) || null
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
