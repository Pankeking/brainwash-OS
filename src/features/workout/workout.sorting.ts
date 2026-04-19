import type { WorkoutCategory, WorkoutExercise, WorkoutLog } from './workout.types'

export function sortCategoriesByColor(categories: WorkoutCategory[]) {
  return categories
    .slice()
    .sort(
      (left, right) => left.color.localeCompare(right.color) || left.name.localeCompare(right.name),
    )
}

export function groupCategoriesByColor(categories: WorkoutCategory[]) {
  const ordered = sortCategoriesByColor(categories)
  const groups = new Map<string, WorkoutCategory[]>()

  for (const category of ordered) {
    const current = groups.get(category.color) || []
    current.push(category)
    groups.set(category.color, current)
  }

  return Array.from(groups.entries()).map(([color, items]) => ({
    color,
    items,
  }))
}

export function sortExercisesForDisplay(
  exercises: WorkoutExercise[],
  categories: WorkoutCategory[],
  latestLogTimestampByExercise: Map<string, number>,
) {
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const primaryColor = (exercise: WorkoutExercise) =>
    exercise.categoryIds
      .map((categoryId) => categoryById.get(categoryId)?.color || 'zzzz')
      .sort((left, right) => left.localeCompare(right))[0] || 'zzzz'
  const hasGoal = (exercise: WorkoutExercise) =>
    exercise.weeklySetGoal !== null && exercise.weeklySetGoal > 0
  const isGoalCompleted = (exercise: WorkoutExercise) =>
    hasGoal(exercise) && exercise.weekSetsDone >= (exercise.weeklySetGoal || 0)
  const isBottomPriority = (exercise: WorkoutExercise) =>
    !hasGoal(exercise) || isGoalCompleted(exercise)

  return exercises.slice().sort((left, right) => {
    const leftBottomPriority = isBottomPriority(left)
    const rightBottomPriority = isBottomPriority(right)
    if (leftBottomPriority !== rightBottomPriority) {
      return leftBottomPriority ? 1 : -1
    }

    const leftColor = primaryColor(left)
    const rightColor = primaryColor(right)
    if (leftColor !== rightColor) {
      return leftColor.localeCompare(rightColor)
    }

    const leftLastLog = latestLogTimestampByExercise.get(left.id) || 0
    const rightLastLog = latestLogTimestampByExercise.get(right.id) || 0
    if (leftLastLog !== rightLastLog) {
      return rightLastLog - leftLastLog
    }

    return left.name.localeCompare(right.name)
  })
}

export function buildLogCountByExercise(logs: WorkoutLog[]) {
  const counts = new Map<string, number>()
  for (const log of logs) {
    counts.set(log.exerciseId, (counts.get(log.exerciseId) || 0) + 1)
  }
  return counts
}

export function buildLatestLogTimestampByExercise(logs: WorkoutLog[]) {
  const timestamps = new Map<string, number>()
  for (const log of logs) {
    const timestamp = new Date(log.timestamp).getTime()
    const previousTimestamp = timestamps.get(log.exerciseId) || 0
    if (timestamp > previousTimestamp) {
      timestamps.set(log.exerciseId, timestamp)
    }
  }
  return timestamps
}

export function sortCategoryIdsByColor(categoryIds: string[], categories: WorkoutCategory[]) {
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  return categoryIds.slice().sort((left, right) => {
    const leftCategory = categoryById.get(left)
    const rightCategory = categoryById.get(right)
    const leftColor = leftCategory?.color || 'zzzz'
    const rightColor = rightCategory?.color || 'zzzz'
    if (leftColor !== rightColor) {
      return leftColor.localeCompare(rightColor)
    }
    return (leftCategory?.name || left).localeCompare(rightCategory?.name || right)
  })
}
