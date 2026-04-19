import { createServerFn } from '@tanstack/react-start'

import connectDB from './db'
import { appLogInfo } from './logger'
import {
  BODY_METRIC_DEFINITIONS,
  findBodyMeasurementLogsForRange,
  findOrCreateBodyMeasurementLogForDay,
  getBodyMetricDefinition,
} from './bodyMetrics.utils'
import { getAuthenticatedUserObjectId } from './workout.auth'
import {
  bodyMetricInputSchema,
  removeBodyMetricInputSchema,
  workoutDayInputSchema,
} from './workout.schemas'
import { addDaysToDayKey, parseSelectedDayKey } from './workout.utils'

export const getBodyMetricsDayFn = createServerFn({ method: 'POST' })
  .inputValidator(workoutDayInputSchema)
  .handler(async ({ data }) => {
    await connectDB()
    const userId = await getAuthenticatedUserObjectId()
    const selectedDayKey = parseSelectedDayKey(data.selectedDay)
    const historyStartDayKey = addDaysToDayKey(selectedDayKey, -29)

    const logs = await findBodyMeasurementLogsForRange(userId, historyStartDayKey, selectedDayKey)
    const selectedDayLog = logs.find((log) => log.dayKey === selectedDayKey)
    const latestByMetric = new Map<
      string,
      { value: number; unit: 'kg' | 'cm'; loggedAt: string; label: string }
    >()

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

    return {
      definitions: BODY_METRIC_DEFINITIONS,
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
    }
  })

export const upsertBodyMetricFn = createServerFn({ method: 'POST' })
  .inputValidator(bodyMetricInputSchema)
  .handler(async ({ data }) => {
    await connectDB()
    const userId = await getAuthenticatedUserObjectId()
    const definition = getBodyMetricDefinition(data.metricKey)
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

export const removeBodyMetricFn = createServerFn({ method: 'POST' })
  .inputValidator(removeBodyMetricInputSchema)
  .handler(async ({ data }) => {
    await connectDB()
    const userId = await getAuthenticatedUserObjectId()
    const selectedDayKey = parseSelectedDayKey(data.selectedDay)
    const log = await findOrCreateBodyMeasurementLogForDay(userId, selectedDayKey)
    log.measurements = log.measurements.filter(
      (measurement: { _id?: unknown }) => String(measurement._id) !== data.entryId,
    )
    await log.save()
    return { success: true }
  })
