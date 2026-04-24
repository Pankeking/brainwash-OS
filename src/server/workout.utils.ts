import type mongoose from 'mongoose'

import { SetType, Weekday } from '../enums/enums.js'

import {
  createLogTimestampForDayKey,
  dayKeyFromDateInTimeZone,
  formatDayKey,
  getUtcRangeForDayKey as getUtcRangeForDayKeyInTimeZone,
  parseDayKey,
} from './dayKey.js'

export const APP_TIMEZONE = 'Europe/Berlin'

async function getWorkoutLogModel() {
  const { WorkoutLogModel } = await import('../models/WorkoutLog.model.js')
  return WorkoutLogModel
}

export function parseSelectedDayKey(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseDayKey(value).key
  }

  const legacyDate = new Date(value)
  if (Number.isNaN(legacyDate.getTime())) {
    throw new Error('Invalid selected day')
  }

  return dayKeyFromDateInTimeZone(legacyDate, APP_TIMEZONE)
}

export function getLegacyWorkoutLogDateFilter(dayKey: string) {
  const range = getUtcRangeForDayKeyInTimeZone(dayKey, APP_TIMEZONE)
  return {
    date: {
      $gte: range.start,
      $lte: range.end,
    },
  }
}

export async function findWorkoutLogsForDay(
  userId: mongoose.Types.ObjectId,
  dayKey: string,
  options?: { lean?: boolean },
) {
  const WorkoutLogModel = await getWorkoutLogModel()
  const query = WorkoutLogModel.find({
    userId,
    $or: [{ dayKey }, getLegacyWorkoutLogDateFilter(dayKey)],
  })
  if (options?.lean) {
    return await query.lean()
  }
  return await query
}

export function addDaysToDayKey(dayKey: string, days: number) {
  const parsed = parseDayKey(dayKey)
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days))
  return formatDayKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

function getWeekdayFromDayKey(dayKey: string): Weekday {
  const parsed = parseDayKey(dayKey)
  const dayIndex = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay()
  const weekdays = Object.values(Weekday)
  const enumIndex = (dayIndex + 6) % 7
  return weekdays[enumIndex]
}

export function getWeekStartDayKey(dayKey: string) {
  const parsed = parseDayKey(dayKey)
  const day = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay()
  const mondayDiff = day === 0 ? -6 : 1 - day
  return addDaysToDayKey(dayKey, mondayDiff)
}

export async function findOrCreateWorkoutLogForDay(
  userId: mongoose.Types.ObjectId,
  dayKey: string,
) {
  const WorkoutLogModel = await getWorkoutLogModel()
  const existingByDayKey = await WorkoutLogModel.findOne({
    userId,
    dayKey,
  })
  if (existingByDayKey) {
    return existingByDayKey
  }

  const weekday = getWeekdayFromDayKey(dayKey)
  const legacyWorkoutLog = await WorkoutLogModel.findOne({
    userId,
    weekday,
    ...getLegacyWorkoutLogDateFilter(dayKey),
  })
  if (legacyWorkoutLog) {
    legacyWorkoutLog.dayKey = dayKey
    return await legacyWorkoutLog.save()
  }

  const createdWorkoutLog = await WorkoutLogModel.findOneAndUpdate(
    {
      userId,
      dayKey,
    },
    {
      $setOnInsert: {
        userId,
        dayKey,
        date: createLogTimestampForDayKey(dayKey, APP_TIMEZONE),
        weekday,
        exercises: [],
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
    },
  )

  if (!createdWorkoutLog) {
    throw new Error('Failed to create workout log')
  }

  return createdWorkoutLog
}

export function getRollingRangeFromDayKey(dayKey: string, totalDays: number) {
  const endDayKey = parseDayKey(dayKey).key
  const startDayKey = addDaysToDayKey(endDayKey, -(totalDays - 1))
  return {
    start: getUtcRangeForDayKeyInTimeZone(startDayKey, APP_TIMEZONE).start,
    end: getUtcRangeForDayKeyInTimeZone(endDayKey, APP_TIMEZONE).end,
  }
}

export function formatDayKeyForLabel(dayKey: string) {
  return new Date(`${dayKey}T12:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: APP_TIMEZONE,
  })
}

export type FlatSetRecord = {
  value: number
}

export function getStatsFromSets(sets: FlatSetRecord[]) {
  if (sets.length === 0) {
    return {
      best: null,
      avg: null,
      worst: null,
    }
  }

  const values = sets.map((set) => set.value)
  const best = Math.max(...values)
  const worst = Math.min(...values)
  const sum = values.reduce((acc, value) => acc + value, 0)
  const avg = Number((sum / values.length).toFixed(2))

  return { best, avg, worst }
}

export function setToNumericValue(set: { type: SetType; reps?: number; duration?: number }) {
  if (set.type === SetType.REPS) {
    return typeof set.reps === 'number' ? set.reps : null
  }
  return typeof set.duration === 'number' ? set.duration : null
}
