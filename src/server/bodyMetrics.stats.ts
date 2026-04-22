import { parseDayKey } from './dayKey.js'

type BodyMetricPoint = {
  dayKey: string
  value: number
  loggedAt: string
}

type BodyMetricBucketStats = {
  label: string
  low: number
  avg: number
  high: number
}

type BodyMetricExtrema = {
  value: number
  loggedAt: string
}

export type BodyMetricProgressStats = {
  weekly: BodyMetricBucketStats[]
  monthly: BodyMetricBucketStats[]
  overallHigh: BodyMetricExtrema | null
  overallLow: BodyMetricExtrema | null
  firstRecorded: BodyMetricExtrema | null
  lastRecorded: BodyMetricExtrema | null
}

function toAverage(values: number[]) {
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
}

function buildBucketStats(labelPrefix: string, bucketValues: Map<number, number[]>) {
  return Array.from(bucketValues.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([bucketIndex, values]) => ({
      label: `${labelPrefix} ${bucketIndex + 1}`,
      low: Math.min(...values),
      avg: toAverage(values),
      high: Math.max(...values),
    }))
}

function addDaysToDayKey(dayKey: string, days: number) {
  const parsed = parseDayKey(dayKey)
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate(),
  ).padStart(2, '0')}`
}

function getWeekStartDayKey(dayKey: string) {
  const parsed = parseDayKey(dayKey)
  const day = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay()
  const mondayDiff = day === 0 ? -6 : 1 - day
  return addDaysToDayKey(dayKey, mondayDiff)
}

function getWeekBucketIndex(selectedDayKey: string, pointDayKey: string) {
  const selectedWeekStart = getWeekStartDayKey(selectedDayKey)
  const pointWeekStart = getWeekStartDayKey(pointDayKey)
  const selectedWeekDate = new Date(`${selectedWeekStart}T00:00:00.000Z`)
  const pointWeekDate = new Date(`${pointWeekStart}T00:00:00.000Z`)
  const diffMs = selectedWeekDate.getTime() - pointWeekDate.getTime()
  return Math.max(0, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)))
}

function getMonthBucketIndex(selectedDayKey: string, pointDayKey: string) {
  const selected = parseDayKey(selectedDayKey)
  const point = parseDayKey(pointDayKey)
  return Math.max(0, (selected.year - point.year) * 12 + (selected.month - point.month))
}

function toExtrema(point: BodyMetricPoint | null) {
  if (!point) {
    return null
  }
  return {
    value: point.value,
    loggedAt: point.loggedAt,
  }
}

export function buildBodyMetricProgressStats(
  selectedDayKey: string,
  points: BodyMetricPoint[],
): BodyMetricProgressStats {
  if (points.length === 0) {
    return {
      weekly: [],
      monthly: [],
      overallHigh: null,
      overallLow: null,
      firstRecorded: null,
      lastRecorded: null,
    }
  }

  const sortedPoints = points
    .slice()
    .sort((left, right) => new Date(left.loggedAt).getTime() - new Date(right.loggedAt).getTime())
  const weeklyValues = new Map<number, number[]>()
  const monthlyValues = new Map<number, number[]>()

  for (const point of points) {
    const weekIndex = getWeekBucketIndex(selectedDayKey, point.dayKey)
    const monthIndex = getMonthBucketIndex(selectedDayKey, point.dayKey)
    weeklyValues.set(weekIndex, [...(weeklyValues.get(weekIndex) || []), point.value])
    monthlyValues.set(monthIndex, [...(monthlyValues.get(monthIndex) || []), point.value])
  }

  const overallHigh = points.reduce(
    (current, point) => (!current || point.value > current.value ? point : current),
    null as BodyMetricPoint | null,
  )
  const overallLow = points.reduce(
    (current, point) => (!current || point.value < current.value ? point : current),
    null as BodyMetricPoint | null,
  )

  return {
    weekly: buildBucketStats('Week', weeklyValues),
    monthly: buildBucketStats('Month', monthlyValues),
    overallHigh: toExtrema(overallHigh),
    overallLow: toExtrema(overallLow),
    firstRecorded: toExtrema(sortedPoints[0] || null),
    lastRecorded: toExtrema(sortedPoints[sortedPoints.length - 1] || null),
  }
}
