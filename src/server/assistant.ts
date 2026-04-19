import mongoose from 'mongoose'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { useAppSession } from '~/utils/session'
import { BodyMetricDefinitionModel } from '~/models/BodyMetricDefinition.model'
import { ExerciseModel } from '~/models/Exercise.model'
import { WorkoutLogModel } from '~/models/WorkoutLog.model'
import { SetType, Weekday } from '~/enums/enums'
import connectDB from './db'
import { ASSISTANT_MASTER_PROMPT, ASSISTANT_SKILLS } from './assistant.prompts'
import {
  findOrCreateBodyMeasurementLogForDay,
  getBodyMetricDefinitionForUser,
  getBodyMetricDefinitionsForUser,
  toBodyMetricKey,
} from './bodyMetrics.utils'
import { getOptionalEnvValue } from './env'
import { appLogError, appLogInfo, appLogWarn } from './logger'
import {
  createLogTimestampForDayKey,
  dayKeyFromDateInTimeZone,
  getUtcRangeForDayKey,
  parseDayKey,
  resolveSelectedDayKey,
} from './dayKey'

const APP_TIMEZONE = 'Europe/Berlin'

const assistantChatInputSchema = z.object({
  message: z.string().min(1).max(1000),
  context: z
    .object({
      selectedDay: z.string().optional(),
      activeTab: z.enum(['time', 'categories', 'exercises', 'body', 'history']).optional(),
    })
    .optional(),
})

const assistantLogDirectInputSchema = z.object({
  exerciseName: z.string().min(1).max(120),
  setType: z.enum(['reps', 'timed']),
  value: z.number().int().min(1).max(10000),
  context: z
    .object({
      selectedDay: z.string().optional(),
      activeTab: z.enum(['time', 'categories', 'exercises', 'body', 'history']).optional(),
    })
    .optional(),
})

type AssistantIntent =
  | {
      action: 'log_set'
      exerciseName: string
      setType: 'reps' | 'timed'
      value: number
    }
  | {
      action: 'log_body_metric'
      metricName: string
      value: number
    }
  | {
      action: 'create_body_metric'
      label: string
      kind: 'weight' | 'size'
    }
  | {
      action: 'unknown'
      reply: string
    }

type AssistantSuggestion = {
  id: string
  label: string
  exerciseName: string
  setType: 'reps' | 'timed'
  value: number
}

function getWeekdayFromDayKey(dayKey: string): Weekday {
  const parsed = parseDayKey(dayKey)
  const dayIndex = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay()
  const weekdays = Object.values(Weekday)
  const enumIndex = (dayIndex + 6) % 7
  return weekdays[enumIndex]
}

async function getAuthenticatedUserObjectId() {
  const session = await useAppSession()
  const userId = session.data.userId
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Unauthorized')
  }
  return new mongoose.Types.ObjectId(userId)
}

function extractJson(text: string) {
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null
  }
  const raw = text.slice(firstBrace, lastBrace + 1)
  try {
    return JSON.parse(raw) as AssistantIntent
  } catch {
    return null
  }
}

function parseIntentFallback(message: string): AssistantIntent {
  const normalized = message.trim()
  const repsMatch = normalized.match(
    /(?:log|add|put|new)\b.*?(\d+)\s*reps?\b.*?(?:to|on|for)?\s*([a-zA-Z0-9 _-]+)$/i,
  )
  if (repsMatch) {
    return {
      action: 'log_set',
      setType: 'reps',
      value: Number(repsMatch[1]),
      exerciseName: repsMatch[2].trim(),
    }
  }

  const timedMatch = normalized.match(
    /(?:add|log|put|new)\b.*?(\d+)\s*(?:min|minute|minutes)\b(?:\s*(?:and|:)\s*(\d+))?.*?(?:to|on|for)?\s*([a-zA-Z0-9 _-]+)$/i,
  )
  if (timedMatch) {
    const minutes = Number(timedMatch[1] || 0)
    const seconds = Number(timedMatch[2] || 0)
    return {
      action: 'log_set',
      setType: 'timed',
      value: minutes * 60 + seconds,
      exerciseName: timedMatch[3].trim(),
    }
  }

  const bodyMetricMatch = normalized.match(
    /(?:log|track|record|add)\s+(?:my\s+)?([a-zA-Z][a-zA-Z0-9 _-]{1,40}?)\s+(?:at|as|to\s+)?(\d+(?:[.,]\d+)?)(?:\s*(kg|cm))?$/i,
  )
  if (bodyMetricMatch) {
    return {
      action: 'log_body_metric',
      metricName: bodyMetricMatch[1].trim(),
      value: Number(bodyMetricMatch[2].replace(',', '.')),
    }
  }

  return {
    action: 'unknown',
    reply: 'Try: log set of <exercise> with <reps> reps',
  }
}

function normalizeName(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getTokenSet(value: string) {
  return new Set(normalizeName(value).split(' ').filter(Boolean))
}

function getExerciseScore(input: string, exerciseName: string) {
  const queryNorm = normalizeName(input)
  const exerciseNorm = normalizeName(exerciseName)
  if (!queryNorm || !exerciseNorm) {
    return 0
  }
  if (queryNorm === exerciseNorm) {
    return 100
  }
  if (exerciseNorm.includes(queryNorm)) {
    return 85
  }
  if (queryNorm.includes(exerciseNorm)) {
    return 75
  }
  const queryTokens = getTokenSet(queryNorm)
  const exerciseTokens = getTokenSet(exerciseNorm)
  if (queryTokens.size === 0 || exerciseTokens.size === 0) {
    return 0
  }
  let overlap = 0
  queryTokens.forEach((token) => {
    if (exerciseTokens.has(token)) {
      overlap += 1
    }
  })
  return Math.round((overlap / Math.max(queryTokens.size, exerciseTokens.size)) * 70)
}

function deriveSuggestionSeed(message: string) {
  const repsMatch = message.match(/(\d+)\s*reps?\s*(?:of|for)?\s*([a-zA-Z0-9 _-]+)$/i)
  if (repsMatch) {
    return {
      setType: 'reps' as const,
      value: Math.max(1, Number(repsMatch[1] || 1)),
      exerciseName: repsMatch[2].trim(),
    }
  }
  const timedMatch = message.match(
    /(\d+)\s*(?:sec|secs|second|seconds|min|minute|minutes)\s*(?:of|for)?\s*([a-zA-Z0-9 _-]+)$/i,
  )
  if (timedMatch) {
    return {
      setType: 'timed' as const,
      value: Math.max(1, Number(timedMatch[1] || 1)),
      exerciseName: timedMatch[2].trim(),
    }
  }
  return null
}

function buildSuggestions(payload: {
  exerciseNames: string[]
  exerciseName: string
  setType: 'reps' | 'timed'
  value: number
}): AssistantSuggestion[] {
  const scored = payload.exerciseNames
    .map((name) => ({
      name,
      score: getExerciseScore(payload.exerciseName, name),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .filter((item) => item.score > 0)
  if (!scored.length) {
    return []
  }
  const primary = scored[0]?.name
  const secondary = scored[1]?.name
  const value = Math.max(1, Math.floor(payload.value))
  const variationValue =
    payload.setType === 'timed' ? Math.max(1, value - 5) : Math.max(1, Math.floor(value / 3))
  const suggestions: AssistantSuggestion[] = []
  if (primary) {
    suggestions.push({
      id: 'suggestion-1',
      label:
        payload.setType === 'timed' ? `${value} sec of ${primary}` : `${value} reps of ${primary}`,
      exerciseName: primary,
      setType: payload.setType,
      value,
    })
  }
  if (secondary) {
    suggestions.push({
      id: 'suggestion-2',
      label:
        payload.setType === 'timed'
          ? `${value} sec of ${secondary}`
          : `${value} reps of ${secondary}`,
      exerciseName: secondary,
      setType: payload.setType,
      value,
    })
  }
  if (primary) {
    suggestions.push({
      id: 'suggestion-3',
      label:
        payload.setType === 'timed'
          ? `${variationValue} sec of ${primary}`
          : `${variationValue} reps of ${primary}`,
      exerciseName: primary,
      setType: payload.setType,
      value: variationValue,
    })
  }
  return suggestions.slice(0, 3)
}

async function logAssistantSet(payload: {
  userId: mongoose.Types.ObjectId
  exercises: Array<{ _id: mongoose.Types.ObjectId | string; name: string }>
  exerciseName: string
  setType: 'reps' | 'timed'
  value: number
  selectedDay?: string
  activeTab?: 'time' | 'categories' | 'exercises' | 'body' | 'history'
  model: string | null
}) {
  const contextSelectedDay = resolveSelectedDayKey(payload.selectedDay, APP_TIMEZONE)
  if (payload.activeTab && payload.activeTab !== 'exercises') {
    return {
      reply: 'You are not in exercises tab. Switch to exercises and try again.',
      didLogSet: false,
      changeKind: null as 'set' | 'body' | 'body-definition' | null,
      selectedDay: contextSelectedDay,
      undo: null,
      suggestions: [] as AssistantSuggestion[],
    }
  }
  const targetDayKey = contextSelectedDay
  const value = Math.max(1, Math.floor(payload.value))
  const normalizedTarget = normalizeName(payload.exerciseName).replace(/\s+/g, '')
  const matchedExercise = payload.exercises.find(
    (exercise) => normalizeName(exercise.name).replace(/\s+/g, '') === normalizedTarget,
  )
  if (!matchedExercise) {
    const suggestions = buildSuggestions({
      exerciseNames: payload.exercises.map((exercise) => exercise.name),
      exerciseName: payload.exerciseName,
      setType: payload.setType,
      value,
    })
    return {
      reply:
        suggestions.length > 0
          ? `Exercise "${payload.exerciseName}" not found. Did you mean one of these?`
          : `Exercise "${payload.exerciseName}" not found.`,
      didLogSet: false,
      changeKind: null as 'set' | 'body' | 'body-definition' | null,
      selectedDay: targetDayKey,
      undo: null,
      suggestions,
    }
  }
  const weekday = getWeekdayFromDayKey(targetDayKey)
  const exerciseObjectId = new mongoose.Types.ObjectId(String(matchedExercise._id))
  let workoutLog = await WorkoutLogModel.findOne({
    userId: payload.userId,
    dayKey: targetDayKey,
  })
  if (!workoutLog) {
    const range = getUtcRangeForDayKey(targetDayKey, APP_TIMEZONE)
    const legacyWorkoutLog = await WorkoutLogModel.findOne({
      userId: payload.userId,
      weekday,
      date: {
        $gte: range.start,
        $lte: range.end,
      },
    })
    if (legacyWorkoutLog) {
      legacyWorkoutLog.dayKey = targetDayKey
      workoutLog = await legacyWorkoutLog.save()
    } else {
      workoutLog = await WorkoutLogModel.findOneAndUpdate(
        {
          userId: payload.userId,
          dayKey: targetDayKey,
        },
        {
          $setOnInsert: {
            userId: payload.userId,
            dayKey: targetDayKey,
            date: createLogTimestampForDayKey(targetDayKey, APP_TIMEZONE),
            weekday,
            exercises: [],
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
        },
      )
    }
  }
  let exerciseEntry = workoutLog.exercises.find(
    (entry: { exercise: { exerciseId: mongoose.Types.ObjectId | string } }) =>
      String(entry.exercise.exerciseId) === String(exerciseObjectId),
  )
  if (!exerciseEntry) {
    workoutLog.exercises.push({
      exercise: {
        exerciseId: exerciseObjectId,
      },
      sets: [],
    })
    exerciseEntry = workoutLog.exercises[workoutLog.exercises.length - 1]
  }
  exerciseEntry.sets.push({
    type: payload.setType === 'timed' ? SetType.TIMED : SetType.REPS,
    reps: payload.setType === 'reps' ? value : undefined,
    duration: payload.setType === 'timed' ? value : undefined,
    loggedAt: createLogTimestampForDayKey(targetDayKey, APP_TIMEZONE),
  })
  const lastSet = exerciseEntry.sets[exerciseEntry.sets.length - 1] as {
    loggedAt?: Date
    type?: SetType
    reps?: number
    duration?: number
  }
  const loggedAtMs = new Date(lastSet.loggedAt || new Date()).getTime()
  const setTypeToken = payload.setType === 'timed' ? 'timed' : 'reps'
  const valueToken =
    payload.setType === 'timed' ? Number(lastSet.duration || value) : Number(lastSet.reps || value)
  await workoutLog.save()
  appLogInfo('BW_SET_LOG_MCP', 'Set logged from assistant MCP', {
    source: 'mcp',
    model: payload.model,
    selectedDay: targetDayKey,
    exerciseId: String(matchedExercise._id),
    setType: payload.setType,
    value,
  })
  return {
    reply:
      payload.setType === 'timed'
        ? `Logged ${value} sec for ${matchedExercise.name} on ${targetDayKey}.`
        : `Logged ${value} reps for ${matchedExercise.name} on ${targetDayKey}.`,
    didLogSet: true,
    changeKind: 'set' as const,
    selectedDay: targetDayKey,
    undo: {
      selectedDay: targetDayKey,
      logId: `${String(exerciseObjectId)}|${String(loggedAtMs)}|${setTypeToken}|${String(valueToken)}`,
    },
    suggestions: [] as AssistantSuggestion[],
  }
}

async function logAssistantBodyMetric(payload: {
  userId: mongoose.Types.ObjectId
  metricName: string
  value: number
  selectedDay?: string
  model: string | null
}) {
  const targetDayKey = resolveSelectedDayKey(payload.selectedDay, APP_TIMEZONE)
  const definition = await getBodyMetricDefinitionForUser(payload.userId, payload.metricName)
  if (!definition) {
    return {
      reply: `Body metric "${payload.metricName}" is not tracked yet. Say "track ${payload.metricName} as size" or add it in the Body tab first.`,
      didLogSet: false,
      changeKind: null as 'set' | 'body' | 'body-definition' | null,
      selectedDay: targetDayKey,
      undo: null,
      suggestions: [] as AssistantSuggestion[],
    }
  }

  const log = await findOrCreateBodyMeasurementLogForDay(payload.userId, targetDayKey)
  const existing = log.measurements.find(
    (measurement: { metricKey: string }) => measurement.metricKey === definition.key,
  )
  const value = Number(payload.value.toFixed(2))
  if (existing) {
    existing.value = value
    existing.loggedAt = log.date
  } else {
    log.measurements.push({
      metricKey: definition.key,
      label: definition.label,
      kind: definition.kind,
      unit: definition.unit,
      value,
      loggedAt: log.date,
    })
  }
  await log.save()

  appLogInfo('BW_BODY_METRIC_LOG_MCP', 'Body metric logged from assistant MCP', {
    source: 'mcp',
    model: payload.model,
    selectedDay: targetDayKey,
    metricKey: definition.key,
    value,
    unit: definition.unit,
  })

  return {
    reply: `Logged ${value} ${definition.unit} for ${definition.label} on ${targetDayKey}.`,
    didLogSet: false,
    changeKind: 'body' as const,
    selectedDay: targetDayKey,
    undo: null,
    suggestions: [] as AssistantSuggestion[],
  }
}

async function createAssistantBodyMetricDefinition(payload: {
  userId: mongoose.Types.ObjectId
  label: string
  kind: 'weight' | 'size'
  selectedDay?: string
  model: string | null
}) {
  const targetDayKey = resolveSelectedDayKey(payload.selectedDay, APP_TIMEZONE)
  const label = payload.label.trim()
  const key = toBodyMetricKey(label)
  if (!label || !key) {
    return {
      reply: 'Could not create that body metric. Try a shorter name.',
      didLogSet: false,
      changeKind: null as 'set' | 'body' | 'body-definition' | null,
      selectedDay: targetDayKey,
      undo: null,
      suggestions: [] as AssistantSuggestion[],
    }
  }

  const existing = await getBodyMetricDefinitionForUser(payload.userId, label)
  if (existing) {
    return {
      reply: `${existing.label} is already being tracked.`,
      didLogSet: false,
      changeKind: 'body-definition' as const,
      selectedDay: targetDayKey,
      undo: null,
      suggestions: [] as AssistantSuggestion[],
    }
  }

  await BodyMetricDefinitionModel.findOneAndUpdate(
    {
      userId: payload.userId,
      key,
    },
    {
      $setOnInsert: {
        userId: payload.userId,
        key,
        label,
        kind: payload.kind,
        unit: payload.kind === 'weight' ? 'kg' : 'cm',
        isCustom: true,
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
    },
  )

  appLogInfo('BW_BODY_METRIC_CREATE_MCP', 'Body metric definition created from assistant MCP', {
    source: 'mcp',
    model: payload.model,
    label,
    kind: payload.kind,
  })

  return {
    reply: `Now tracking ${label} in ${payload.kind === 'weight' ? 'kg' : 'cm'}.`,
    didLogSet: false,
    changeKind: 'body-definition' as const,
    selectedDay: targetDayKey,
    undo: null,
    suggestions: [] as AssistantSuggestion[],
  }
}

async function callProviderForIntent(payload: {
  message: string
  selectedDay: string
  activeTab?: string
  exerciseNames: string[]
  metricNames: string[]
}) {
  const provider = (getOptionalEnvValue('AI_PROVIDER') || 'google').toLowerCase()
  const skillsBlock = JSON.stringify(ASSISTANT_SKILLS)
  const contextBlock = JSON.stringify({
    selectedDay: payload.selectedDay,
    activeTab: payload.activeTab || null,
    exercises: payload.exerciseNames,
    bodyMetrics: payload.metricNames,
  })

  if (provider === 'google') {
    const apiKey = getOptionalEnvValue('GOOGLE_API_KEY')
    if (!apiKey) {
      return { intent: null, failedAllModels: true, usedModel: null as string | null }
    }

    const orderedModels = ['gemini-3-flash-preview', 'gemini-2.5-flash-lite', 'gemini-2.5-flash']

    for (const model of orderedModels) {
      try {
        appLogInfo('BW_MCP_MODEL_ATTEMPT', 'Attempting assistant model', {
          provider: 'google',
          model,
        })
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `${ASSISTANT_MASTER_PROMPT}\n\nSkills:\n${skillsBlock}\n\nContext:\n${contextBlock}\n\nUser:\n${payload.message}`,
                    },
                  ],
                },
              ],
            }),
          },
        )
        if (!response.ok) {
          appLogWarn('BW_MCP_MODEL_REJECTED', 'Assistant model request failed', {
            provider: 'google',
            model,
            status: response.status,
          })
          continue
        }
        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const intent = extractJson(text)
        if (intent) {
          appLogInfo('BW_MCP_MODEL_SUCCESS', 'Assistant model returned intent', {
            provider: 'google',
            model,
            action: intent.action,
          })
          return { intent, failedAllModels: false, usedModel: model }
        }
      } catch {
        appLogWarn('BW_MCP_MODEL_ERROR', 'Assistant model call errored', {
          provider: 'google',
          model,
        })
        continue
      }
    }

    return { intent: null, failedAllModels: true, usedModel: null as string | null }
  }

  const apiKey = getOptionalEnvValue('OPENAI_API_KEY')
  const orderedModels = ['gpt-4o-mini', 'gpt-4.1-mini']
  const baseUrl = (getOptionalEnvValue('OPENAI_BASE_URL') || 'https://api.openai.com/v1').replace(
    /\/$/,
    '',
  )
  if (!apiKey) {
    return { intent: null, failedAllModels: true, usedModel: null as string | null }
  }
  for (const model of orderedModels) {
    try {
      appLogInfo('BW_MCP_MODEL_ATTEMPT', 'Attempting assistant model', {
        provider: 'openai',
        model,
      })
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: 'system', content: ASSISTANT_MASTER_PROMPT },
            {
              role: 'user',
              content: `Skills:\n${skillsBlock}\n\nContext:\n${contextBlock}\n\nUser:\n${payload.message}`,
            },
          ],
          response_format: { type: 'json_object' },
        }),
      })
      if (!response.ok) {
        appLogWarn('BW_MCP_MODEL_REJECTED', 'Assistant model request failed', {
          provider: 'openai',
          model,
          status: response.status,
        })
        continue
      }
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const text = data.choices?.[0]?.message?.content || ''
      const intent = extractJson(text)
      if (intent) {
        appLogInfo('BW_MCP_MODEL_SUCCESS', 'Assistant model returned intent', {
          provider: 'openai',
          model,
          action: intent.action,
        })
        return { intent, failedAllModels: false, usedModel: model }
      }
      appLogWarn('BW_MCP_MODEL_REJECTED', 'Assistant model returned invalid intent payload', {
        provider: 'openai',
        model,
      })
    } catch (error) {
      appLogWarn('BW_MCP_MODEL_ERROR', 'Assistant model call errored', {
        provider: 'openai',
        model,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      continue
    }
  }
  return { intent: null, failedAllModels: true, usedModel: null as string | null }
}

export const assistantChatFn = createServerFn({ method: 'POST' })
  .inputValidator(assistantChatInputSchema)
  .handler(async ({ data }) => {
    try {
      await connectDB()
      const userId = await getAuthenticatedUserObjectId()

      const contextSelectedDay = resolveSelectedDayKey(data.context?.selectedDay, APP_TIMEZONE)
      const exercises = await ExerciseModel.find({ userId }).lean()
      const bodyMetricDefinitions = await getBodyMetricDefinitionsForUser(userId)
      const exerciseNames = exercises.map((exercise) => exercise.name)
      const metricNames = bodyMetricDefinitions.map((definition) => definition.label)
      appLogInfo('BW_MCP_MESSAGE_RECEIVED', 'Assistant message received', {
        source: 'mcp',
        activeTab: data.context?.activeTab || null,
        selectedDay: contextSelectedDay,
      })

      const quickIntent = parseIntentFallback(data.message)
      if (quickIntent.action === 'log_set') {
        const quickResult = await logAssistantSet({
          userId,
          exercises: exercises.map((exercise) => ({
            _id: exercise._id as mongoose.Types.ObjectId | string,
            name: exercise.name,
          })),
          exerciseName: quickIntent.exerciseName,
          setType: quickIntent.setType,
          value: quickIntent.value,
          selectedDay: contextSelectedDay,
          activeTab: data.context?.activeTab,
          model: 'fast-path',
        })
        if (quickResult.didLogSet) {
          appLogInfo('BW_MCP_FAST_PATH_HIT', 'Assistant fast path used', {
            source: 'mcp',
            action: quickIntent.action,
          })
          return quickResult
        }
      }
      if (quickIntent.action === 'log_body_metric') {
        const quickResult = await logAssistantBodyMetric({
          userId,
          metricName: quickIntent.metricName,
          value: quickIntent.value,
          selectedDay: contextSelectedDay,
          model: 'fast-path',
        })
        if (quickResult.changeKind === 'body') {
          appLogInfo('BW_MCP_FAST_PATH_HIT', 'Assistant fast path used', {
            source: 'mcp',
            action: quickIntent.action,
          })
          return quickResult
        }
      }

      const providerResolution = await callProviderForIntent({
        message: data.message,
        selectedDay: contextSelectedDay,
        activeTab: data.context?.activeTab,
        exerciseNames,
        metricNames,
      })
      if (providerResolution.failedAllModels) {
        appLogError('BW_MCP_ALL_MODELS_FAILED', 'Assistant model fallback chain failed', {
          source: 'mcp',
        })
        return {
          reply:
            'Failed to reach available Gemini models right now. Please verify GOOGLE_API_KEY and try again.',
          didLogSet: false,
          changeKind: null,
          selectedDay: contextSelectedDay,
          undo: null,
          suggestions: [],
        }
      }
      const inferredIntent = providerResolution.intent || parseIntentFallback(data.message)
      appLogInfo('BW_MCP_INTENT_RESOLVED', 'Assistant resolved intent', {
        source: 'mcp',
        action: inferredIntent.action,
        model: providerResolution.usedModel,
      })

      if (inferredIntent.action === 'log_set') {
        return logAssistantSet({
          userId,
          exercises: exercises.map((exercise) => ({
            _id: exercise._id as mongoose.Types.ObjectId | string,
            name: exercise.name,
          })),
          exerciseName: inferredIntent.exerciseName,
          setType: inferredIntent.setType,
          value: inferredIntent.value,
          selectedDay: contextSelectedDay,
          activeTab: data.context?.activeTab,
          model: providerResolution.usedModel,
        })
      }

      if (inferredIntent.action === 'log_body_metric') {
        return logAssistantBodyMetric({
          userId,
          metricName: inferredIntent.metricName,
          value: inferredIntent.value,
          selectedDay: contextSelectedDay,
          model: providerResolution.usedModel,
        })
      }

      if (inferredIntent.action === 'create_body_metric') {
        return createAssistantBodyMetricDefinition({
          userId,
          label: inferredIntent.label,
          kind: inferredIntent.kind,
          selectedDay: contextSelectedDay,
          model: providerResolution.usedModel,
        })
      }

      if (inferredIntent.action === 'unknown') {
        const seed = deriveSuggestionSeed(data.message)
        const suggestions = seed
          ? buildSuggestions({
              exerciseNames,
              exerciseName: seed.exerciseName,
              setType: seed.setType,
              value: seed.value,
            })
          : []
        return {
          reply: suggestions.length > 0 ? 'Did you mean one of these?' : inferredIntent.reply,
          didLogSet: false,
          selectedDay: contextSelectedDay,
          undo: null,
          suggestions,
          changeKind: null,
        }
      }
    } catch (error) {
      appLogError('BW_MCP_EXECUTION_FAILED', 'Assistant execution failed', {
        source: 'mcp',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return {
        reply: 'Failed to process assistant request.',
        didLogSet: false,
        changeKind: null,
        selectedDay: dayKeyFromDateInTimeZone(new Date(), APP_TIMEZONE),
        undo: null,
        suggestions: [],
      }
    }
  })

export const assistantLogDirectFn = createServerFn({ method: 'POST' })
  .inputValidator(assistantLogDirectInputSchema)
  .handler(async ({ data }) => {
    try {
      await connectDB()
      const userId = await getAuthenticatedUserObjectId()
      const exercises = await ExerciseModel.find({ userId }).lean()
      return await logAssistantSet({
        userId,
        exercises: exercises.map((exercise) => ({
          _id: exercise._id as mongoose.Types.ObjectId | string,
          name: exercise.name,
        })),
        exerciseName: data.exerciseName,
        setType: data.setType,
        value: data.value,
        selectedDay: resolveSelectedDayKey(data.context?.selectedDay, APP_TIMEZONE),
        activeTab: data.context?.activeTab,
        model: 'direct-action',
      })
    } catch (error) {
      appLogError('BW_MCP_EXECUTION_FAILED', 'Assistant direct action failed', {
        source: 'mcp',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return {
        reply: 'Failed to process assistant request.',
        didLogSet: false,
        changeKind: null,
        selectedDay: dayKeyFromDateInTimeZone(new Date(), APP_TIMEZONE),
        undo: null,
        suggestions: [],
      }
    }
  })
