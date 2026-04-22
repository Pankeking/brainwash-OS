import type { SetType } from '~/enums/enums'

export interface WorkoutCategory {
  id: string
  name: string
  color: string
}

export interface WorkoutExerciseStatsBucket {
  best: number | null
  avg: number | null
  worst: number | null
}

export interface WorkoutExercise {
  id: string
  name: string
  categoryIds: string[]
  preferredSetType: SetType
  weeklySetGoal: number | null
  weeklyVolumeGoal: number | null
  setTargetValue: number | null
  weekSetsDone: number
  weekVolumeDone: number
  stats: {
    week: WorkoutExerciseStatsBucket
    month: WorkoutExerciseStatsBucket
  }
}

export interface WorkoutLog {
  id: string
  exerciseId: string
  exerciseName: string
  type: SetType
  value: number
  date: string
  timestamp: string
}

export interface WorkoutDayData {
  categories: WorkoutCategory[]
  exercises: WorkoutExercise[]
  logs: WorkoutLog[]
}

export interface WeeklyCategoryStatsRow {
  categoryId: string
  color: string
  name: string
  counts: number[]
}

export interface WeeklyCategoryStatsData {
  weeks: string[]
  rows: WeeklyCategoryStatsRow[]
}

export interface BodyMetricDefinition {
  key: string
  label: string
  kind: 'weight' | 'size'
  unit: 'kg' | 'cm'
  isCustom: boolean
}

export interface BodyMetricEntry {
  id: string
  metricKey: string
  label: string
  kind: 'weight' | 'size'
  unit: 'kg' | 'cm'
  value: number
  loggedAt: string
}

export interface BodyMetricLatestValue {
  metricKey: string
  label: string
  unit: 'kg' | 'cm'
  value: number
  loggedAt: string
}

export interface BodyMetricStatsValue {
  value: number
  loggedAt: string
}

export interface BodyMetricStatsBucket {
  label: string
  low: number
  avg: number
  high: number
}

export interface BodyMetricStats {
  metricKey: string
  label: string
  kind: 'weight' | 'size'
  unit: 'kg' | 'cm'
  weekly: BodyMetricStatsBucket[]
  monthly: BodyMetricStatsBucket[]
  overallHigh: BodyMetricStatsValue | null
  overallLow: BodyMetricStatsValue | null
  firstRecorded: BodyMetricStatsValue | null
  lastRecorded: BodyMetricStatsValue | null
}

export interface BodyMetricsDayData {
  definitions: BodyMetricDefinition[]
  entries: BodyMetricEntry[]
  latest: BodyMetricLatestValue[]
  stats: BodyMetricStats[]
}

export type WorkoutTab = 'time' | 'categories' | 'exercises' | 'body' | 'history'
