import { z } from 'zod'

import { SetType } from '~/enums/enums'

export const workoutDayInputSchema = z.object({
  selectedDay: z.string(),
})

export const categoryInputSchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().min(1).max(20),
})

export const categoryIdInputSchema = z.object({
  categoryId: z.string(),
})

export const exerciseCreateInputSchema = z.object({
  selectedDay: z.string(),
  name: z.string().min(1).max(120),
})

export const renameExerciseInputSchema = z.object({
  exerciseId: z.string(),
  nextName: z.string().min(1).max(120),
})

export const updateExerciseWeeklyGoalInputSchema = z.object({
  exerciseId: z.string(),
  weeklySetGoal: z.number().int().min(1).max(999).nullable(),
})

export const toggleExerciseCategoryInputSchema = z.object({
  exerciseId: z.string(),
  categoryId: z.string(),
})

export const addSetInputSchema = z.object({
  selectedDay: z.string(),
  exerciseId: z.string(),
  type: z.nativeEnum(SetType),
  reps: z.number().int().min(1).optional(),
  duration: z.number().int().min(1).optional(),
})

export const removeSetInputSchema = z.object({
  selectedDay: z.string(),
  logId: z.string(),
})

export const removeExerciseInputSchema = z.object({
  selectedDay: z.string(),
  exerciseId: z.string(),
})

export const updateCategoryColorInputSchema = z.object({
  categoryId: z.string(),
  color: z.string().min(1).max(20),
})

export const weeklyCategoryStatsInputSchema = z.object({
  weeks: z.number().int().min(1).max(24),
})

export const bodyMetricInputSchema = z.object({
  selectedDay: z.string(),
  metricKey: z.string().min(1).max(64),
  value: z.number().positive().max(9999),
})

export const removeBodyMetricInputSchema = z.object({
  selectedDay: z.string(),
  entryId: z.string(),
})
