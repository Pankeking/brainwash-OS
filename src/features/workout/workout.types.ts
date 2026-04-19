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
  weeklySetGoal: number | null
  weekSetsDone: number
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

export interface BodyMetricsDayData {
  definitions: BodyMetricDefinition[]
  entries: BodyMetricEntry[]
  latest: BodyMetricLatestValue[]
}

export type WorkoutTab = 'time' | 'categories' | 'exercises' | 'body' | 'history'
