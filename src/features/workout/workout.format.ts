import { WORKOUT_TIME_ZONE } from './workout.constants'

export function formatWorkoutDayLabel(dayKey: string) {
  return new Date(`${dayKey}T12:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: WORKOUT_TIME_ZONE,
  })
}
