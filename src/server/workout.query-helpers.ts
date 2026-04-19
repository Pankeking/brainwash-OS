import type mongoose from 'mongoose'

import { SetType } from '../enums/enums.js'

import type { FlatSetRecord } from './workout.utils'
import { getStatsFromSets, setToNumericValue } from './workout.utils.js'

export function collectSetsByExercise(
  logs: Array<{
    exercises: Array<{
      exercise: { exerciseId: mongoose.Types.ObjectId }
      sets: Array<{ type: SetType; reps?: number; duration?: number }>
    }>
  }>,
) {
  const grouped = new Map<string, FlatSetRecord[]>()
  for (const log of logs) {
    for (const entry of log.exercises) {
      const id = String(entry.exercise.exerciseId)
      if (!grouped.has(id)) {
        grouped.set(id, [])
      }
      const current = grouped.get(id)
      if (!current) {
        continue
      }
      for (const set of entry.sets) {
        const value = setToNumericValue(set)
        if (value !== null) {
          current.push({ value })
        }
      }
    }
  }
  return grouped
}

export function collectWeeklyVolumeByExercise(
  logs: Array<{
    exercises: Array<{
      exercise: { exerciseId: mongoose.Types.ObjectId }
      sets: Array<{ type: SetType; reps?: number; duration?: number }>
    }>
  }>,
) {
  const totals = new Map<string, number>()
  for (const log of logs) {
    for (const entry of log.exercises) {
      const id = String(entry.exercise.exerciseId)
      let total = totals.get(id) || 0
      for (const set of entry.sets) {
        const value = setToNumericValue(set)
        if (value !== null) {
          total += value
        }
      }
      totals.set(id, total)
    }
  }
  return totals
}

export function mapWorkoutExercises(payload: {
  exerciseDocs: Array<{
    _id: mongoose.Types.ObjectId | string
    name: string
    categories?: Array<mongoose.Types.ObjectId | string>
    preferredSetType?: 'reps' | 'timed' | null
    weeklySetGoal?: number | null
    weeklyVolumeGoal?: number | null
  }>
  monthSetsByExercise: Map<string, FlatSetRecord[]>
  rollingWeekSetsByExercise: Map<string, FlatSetRecord[]>
  weekSetsByExercise: Map<string, FlatSetRecord[]>
  weekVolumeByExercise: Map<string, number>
}) {
  return payload.exerciseDocs.map((exercise) => {
    const id = String(exercise._id)
    const weekSetRecords = payload.weekSetsByExercise.get(id) || []
    const rollingWeekSetRecords = payload.rollingWeekSetsByExercise.get(id) || []
    const parsedWeeklyGoal =
      exercise.weeklySetGoal === null || exercise.weeklySetGoal === undefined
        ? null
        : Number(exercise.weeklySetGoal)

    return {
      id,
      name: exercise.name,
      categoryIds: (exercise.categories || []).map((categoryId) => String(categoryId)),
      preferredSetType: exercise.preferredSetType === 'timed' ? SetType.TIMED : SetType.REPS,
      weeklySetGoal: Number.isFinite(parsedWeeklyGoal) ? parsedWeeklyGoal : null,
      weeklyVolumeGoal:
        typeof exercise.weeklyVolumeGoal === 'number' ? Number(exercise.weeklyVolumeGoal) : null,
      weekSetsDone: weekSetRecords.length,
      weekVolumeDone: payload.weekVolumeByExercise.get(id) || 0,
      stats: {
        week: getStatsFromSets(rollingWeekSetRecords),
        month: getStatsFromSets(payload.monthSetsByExercise.get(id) || []),
      },
    }
  })
}
