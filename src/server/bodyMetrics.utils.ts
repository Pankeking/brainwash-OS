import type mongoose from 'mongoose'

import { createLogTimestampForDayKey, getUtcRangeForDayKey } from './dayKey'
import { APP_TIMEZONE, parseSelectedDayKey } from './workout.utils'

export type BodyMetricDefinition = {
  key: string
  label: string
  kind: 'weight' | 'size'
  unit: 'kg' | 'cm'
  isCustom: boolean
}

type PersistedMeasurement = {
  metricKey: string
  label: string
  kind: 'weight' | 'size'
  unit: 'kg' | 'cm'
}

async function getBodyMetricDefinitionModel() {
  const { BodyMetricDefinitionModel } = await import('~/models/BodyMetricDefinition.model')
  return BodyMetricDefinitionModel
}

async function getBodyMeasurementLogModel() {
  const { BodyMeasurementLogModel } = await import('~/models/BodyMeasurementLog.model')
  return BodyMeasurementLogModel
}

function buildMetricDefinitionFromMeasurement(
  measurement: PersistedMeasurement,
): BodyMetricDefinition {
  return {
    key: measurement.metricKey,
    label: measurement.label,
    kind: measurement.kind,
    unit: measurement.unit,
    isCustom: true,
  }
}

async function getInferredBodyMetricDefinitionsFromLogs(userId: mongoose.Types.ObjectId) {
  const BodyMeasurementLogModel = await getBodyMeasurementLogModel()
  const logs = await BodyMeasurementLogModel.find(
    {
      userId,
      'measurements.0': { $exists: true },
    },
    {
      measurements: 1,
    },
  )
    .sort({ date: -1 })
    .lean()

  const inferredDefinitions = new Map<string, BodyMetricDefinition>()

  for (const log of logs) {
    for (const measurement of (log.measurements || []) as PersistedMeasurement[]) {
      if (!inferredDefinitions.has(measurement.metricKey)) {
        inferredDefinitions.set(
          measurement.metricKey,
          buildMetricDefinitionFromMeasurement(measurement),
        )
      }
    }
  }

  return Array.from(inferredDefinitions.values()).sort((left, right) =>
    left.label.localeCompare(right.label),
  )
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
  const BodyMetricDefinitionModel = await getBodyMetricDefinitionModel()
  const customDefinitions = await BodyMetricDefinitionModel.find({ userId })
    .sort({ createdAt: 1 })
    .lean()
  const customByKey = new Map(
    customDefinitions.map((definition) => [
      definition.key,
      {
        key: definition.key,
        label: definition.label,
        kind: definition.kind,
        unit: definition.unit,
        isCustom: Boolean(definition.isCustom),
      } satisfies BodyMetricDefinition,
    ]),
  )
  const inferredDefinitions = await getInferredBodyMetricDefinitionsFromLogs(userId)

  return [
    ...customByKey.values(),
    ...inferredDefinitions.filter((definition) => !customByKey.has(definition.key)),
  ]
}

export async function getBodyMetricDefinitionForUser(
  userId: mongoose.Types.ObjectId,
  metricKeyOrLabel: string,
) {
  const [BodyMetricDefinitionModel, BodyMeasurementLogModel] = await Promise.all([
    getBodyMetricDefinitionModel(),
    getBodyMeasurementLogModel(),
  ])
  const normalized = metricKeyOrLabel.trim().toLowerCase()
  const escapedLabel = metricKeyOrLabel.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const custom = await BodyMetricDefinitionModel.findOne({
    userId,
    $or: [{ key: normalized }, { label: new RegExp(`^${escapedLabel}$`, 'i') }],
  }).lean()
  if (custom) {
    return {
      key: custom.key,
      label: custom.label,
      kind: custom.kind,
      unit: custom.unit,
      isCustom: Boolean(custom.isCustom),
    }
  }

  const log = await BodyMeasurementLogModel.findOne(
    {
      userId,
      measurements: {
        $elemMatch: {
          $or: [{ metricKey: normalized }, { label: new RegExp(`^${escapedLabel}$`, 'i') }],
        },
      },
    },
    {
      measurements: 1,
    },
  )
    .sort({ date: -1 })
    .lean()

  const measurement = (log?.measurements || []).find(
    (entry: { metricKey: string; label: string }) =>
      entry.metricKey.toLowerCase() === normalized ||
      entry.label.toLowerCase() === metricKeyOrLabel.trim().toLowerCase(),
  ) as PersistedMeasurement | undefined

  return measurement ? buildMetricDefinitionFromMeasurement(measurement) : null
}

export async function findOrCreateBodyMeasurementLogForDay(
  userId: mongoose.Types.ObjectId,
  selectedDay: string,
) {
  const BodyMeasurementLogModel = await getBodyMeasurementLogModel()
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
  const BodyMeasurementLogModel = await getBodyMeasurementLogModel()
  const start = getUtcRangeForDayKey(fromDayKey, APP_TIMEZONE).start
  const end = getUtcRangeForDayKey(toDayKey, APP_TIMEZONE).end

  return await BodyMeasurementLogModel.find({
    userId,
    date: { $gte: start, $lte: end },
  })
    .sort({ date: -1 })
    .lean()
}
