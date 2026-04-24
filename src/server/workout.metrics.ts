import { createServerFn } from '@tanstack/react-start'
import type { Types } from 'mongoose'

import { appLogInfo } from './logger'
import { buildBodyMetricProgressStats } from './bodyMetrics.stats'
import {
  bodyMetricInputSchema,
  createBodyMetricDefinitionInputSchema,
  removeBodyMetricInputSchema,
  removeBodyMetricDefinitionInputSchema,
  workoutDayInputSchema,
} from './workout.schemas'
import { addDaysToDayKey, parseSelectedDayKey } from './workout.utils'

async function getBodyMetricUserId() {
  const [{ default: connectDB }, { getAuthenticatedUserObjectId }] = await Promise.all([
    import('./db'),
    import('./workout.auth'),
  ])
  await connectDB()
  return getAuthenticatedUserObjectId()
}

async function getBodyMetricDefinitionModel() {
  const { BodyMetricDefinitionModel } = await import('~/models/BodyMetricDefinition.model')
  return BodyMetricDefinitionModel
}

async function getBodyMeasurementLogModel() {
  const { BodyMeasurementLogModel } = await import('~/models/BodyMeasurementLog.model')
  return BodyMeasurementLogModel
}

export async function getBodyMetricsDayData({
  selectedDay,
  userId,
}: {
  selectedDay: string
  userId: Types.ObjectId
}) {
  const { findBodyMeasurementLogsForRange, getBodyMetricDefinitionsForUser } =
    await import('./bodyMetrics.utils')
  const BodyMeasurementLogModel = await getBodyMeasurementLogModel()
  const selectedDayKey = parseSelectedDayKey(selectedDay)
  const historyStartDayKey = addDaysToDayKey(selectedDayKey, -29)
  const definitions = await getBodyMetricDefinitionsForUser(userId)
  const [logs, allLogs] = await Promise.all([
    findBodyMeasurementLogsForRange(userId, historyStartDayKey, selectedDayKey),
    BodyMeasurementLogModel.find(
      {
        userId,
        'measurements.0': { $exists: true },
      },
      {
        dayKey: 1,
        measurements: 1,
      },
    )
      .sort({ date: -1 })
      .lean(),
  ])
  const selectedDayLog = logs.find((log) => log.dayKey === selectedDayKey)
  const latestByMetric = new Map<
    string,
    { value: number; unit: 'kg' | 'cm'; loggedAt: string; label: string }
  >()
  const metricPoints = new Map<string, Array<{ dayKey: string; value: number; loggedAt: string }>>()

  for (const log of logs) {
    for (const measurement of (log.measurements || []) as Array<{
      metricKey: string
      label: string
      unit: 'kg' | 'cm'
      value: number
      loggedAt: Date
    }>) {
      if (!latestByMetric.has(measurement.metricKey)) {
        latestByMetric.set(measurement.metricKey, {
          value: measurement.value,
          unit: measurement.unit,
          loggedAt: new Date(measurement.loggedAt).toISOString(),
          label: measurement.label,
        })
      }
    }
  }
  for (const log of allLogs) {
    for (const measurement of (log.measurements || []) as Array<{
      metricKey: string
      value: number
      loggedAt: Date
    }>) {
      metricPoints.set(measurement.metricKey, [
        ...(metricPoints.get(measurement.metricKey) || []),
        {
          dayKey: log.dayKey,
          value: measurement.value,
          loggedAt: new Date(measurement.loggedAt).toISOString(),
        },
      ])
    }
  }

  return {
    definitions,
    entries:
      selectedDayLog?.measurements.map(
        (measurement: {
          _id?: unknown
          metricKey: string
          label: string
          kind: 'weight' | 'size'
          unit: 'kg' | 'cm'
          value: number
          loggedAt: Date
        }) => ({
          id: String(measurement._id),
          metricKey: measurement.metricKey,
          label: measurement.label,
          kind: measurement.kind,
          unit: measurement.unit,
          value: measurement.value,
          loggedAt: new Date(measurement.loggedAt).toISOString(),
        }),
      ) || [],
    latest: Array.from(latestByMetric.entries()).map(([metricKey, value]) => ({
      metricKey,
      ...value,
    })),
    stats: definitions.map((definition) => ({
      metricKey: definition.key,
      label: definition.label,
      kind: definition.kind,
      unit: definition.unit,
      ...buildBodyMetricProgressStats(selectedDayKey, metricPoints.get(definition.key) || []),
    })),
  }
}

export const getBodyMetricsDayFn = createServerFn({ method: 'POST' })
  .inputValidator(workoutDayInputSchema)
  .handler(async ({ data }) => {
    const userId = await getBodyMetricUserId()
    return getBodyMetricsDayData({ selectedDay: data.selectedDay, userId })
  })

export const upsertBodyMetricFn = createServerFn({ method: 'POST' })
  .inputValidator(bodyMetricInputSchema)
  .handler(async ({ data }) => {
    const { findOrCreateBodyMeasurementLogForDay, getBodyMetricDefinitionForUser } =
      await import('./bodyMetrics.utils')
    const userId = await getBodyMetricUserId()
    const definition = await getBodyMetricDefinitionForUser(userId, data.metricKey)
    if (!definition) {
      throw new Error('Unknown metric')
    }

    const selectedDayKey = parseSelectedDayKey(data.selectedDay)
    const log = await findOrCreateBodyMeasurementLogForDay(userId, selectedDayKey)
    const existing = log.measurements.find(
      (measurement: { metricKey: string }) => measurement.metricKey === definition.key,
    )
    if (existing) {
      existing.value = data.value
      existing.loggedAt = log.date
    } else {
      log.measurements.push({
        metricKey: definition.key,
        label: definition.label,
        kind: definition.kind,
        unit: definition.unit,
        value: data.value,
        loggedAt: log.date,
      })
    }

    await log.save()
    appLogInfo('BW_BODY_METRIC_UPSERT', 'Body metric logged from app UI', {
      selectedDayKey,
      metricKey: definition.key,
      value: data.value,
      unit: definition.unit,
    })

    return { success: true }
  })

export const createBodyMetricDefinitionFn = createServerFn({ method: 'POST' })
  .inputValidator(createBodyMetricDefinitionInputSchema)
  .handler(async ({ data }) => {
    const { getBodyMetricDefinitionForUser, toBodyMetricKey } = await import('./bodyMetrics.utils')
    const [BodyMetricDefinitionModel, userId] = await Promise.all([
      getBodyMetricDefinitionModel(),
      getBodyMetricUserId(),
    ])
    const label = data.label.trim()
    const key = toBodyMetricKey(label)
    const unit = data.kind === 'weight' ? 'kg' : 'cm'

    if (!key) {
      throw new Error('Invalid metric label')
    }
    const existing = await getBodyMetricDefinitionForUser(userId, label)
    if (existing) {
      return { success: true }
    }

    await BodyMetricDefinitionModel.findOneAndUpdate(
      {
        userId,
        key,
      },
      {
        $setOnInsert: {
          userId,
          key,
          label,
          kind: data.kind,
          unit,
          isCustom: true,
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      },
    )

    return { success: true }
  })

export const removeBodyMetricDefinitionFn = createServerFn({ method: 'POST' })
  .inputValidator(removeBodyMetricDefinitionInputSchema)
  .handler(async ({ data }) => {
    const [BodyMetricDefinitionModel, userId] = await Promise.all([
      getBodyMetricDefinitionModel(),
      getBodyMetricUserId(),
    ])

    await BodyMetricDefinitionModel.deleteOne({
      userId,
      key: data.metricKey,
      isCustom: true,
    })

    return { success: true }
  })

export const removeBodyMetricFn = createServerFn({ method: 'POST' })
  .inputValidator(removeBodyMetricInputSchema)
  .handler(async ({ data }) => {
    const { findOrCreateBodyMeasurementLogForDay } = await import('./bodyMetrics.utils')
    const userId = await getBodyMetricUserId()
    const selectedDayKey = parseSelectedDayKey(data.selectedDay)
    const log = await findOrCreateBodyMeasurementLogForDay(userId, selectedDayKey)
    log.measurements = log.measurements.filter(
      (measurement: { _id?: unknown }) => String(measurement._id) !== data.entryId,
    )
    await log.save()
    return { success: true }
  })
