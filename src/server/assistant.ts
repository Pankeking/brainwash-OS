import mongoose from 'mongoose'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { useAppSession } from '~/utils/session'
import { ExerciseModel } from '~/models/Exercise.model'
import { WorkoutLogModel } from '~/models/WorkoutLog.model'
import { SetType, Weekday } from '~/enums/enums'
import connectDB from './db'
import { ASSISTANT_MASTER_PROMPT, ASSISTANT_SKILLS } from './assistant.prompts'
import { getOptionalEnvValue } from './env'
import { appLogError, appLogInfo, appLogWarn } from './logger'

const APP_TIMEZONE = 'Europe/Berlin'
const SELECTED_DAY_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/

const assistantChatInputSchema = z.object({
  message: z.string().min(1).max(1000),
  context: z
    .object({
      selectedDay: z.string().optional(),
      activeTab: z.enum(['time', 'categories', 'exercises', 'history']).optional(),
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
      activeTab: z.enum(['time', 'categories', 'exercises', 'history']).optional(),
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

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  return { year, month, day }
}

function getTimePartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value)
  const second = Number(parts.find((part) => part.type === 'second')?.value)
  return { hour, minute, second }
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getDatePartsInTimeZone(date, timeZone)
  const timeParts = getTimePartsInTimeZone(date, timeZone)
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    timeParts.hour,
    timeParts.minute,
    timeParts.second,
    date.getUTCMilliseconds(),
  )
  return asUtc - date.getTime()
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string,
) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone)
  let timestamp = utcGuess - firstOffset
  const secondOffset = getTimeZoneOffsetMs(new Date(timestamp), timeZone)
  if (secondOffset !== firstOffset) {
    timestamp = utcGuess - secondOffset
  }
  return new Date(timestamp)
}

function formatDayKey(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function dayKeyFromDateInTimeZone(date: Date, timeZone: string) {
  const parts = getDatePartsInTimeZone(date, timeZone)
  return formatDayKey(parts.year, parts.month, parts.day)
}

function parseDayKey(value: string) {
  if (!SELECTED_DAY_KEY_REGEX.test(value)) {
    throw new Error('Invalid selected day')
  }
  const [yearRaw, monthRaw, dayRaw] = value.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  const control = new Date(Date.UTC(year, month - 1, day))
  if (
    control.getUTCFullYear() !== year ||
    control.getUTCMonth() + 1 !== month ||
    control.getUTCDate() !== day
  ) {
    throw new Error('Invalid selected day')
  }
  return { year, month, day, key: formatDayKey(year, month, day) }
}

function getUtcRangeForDayKey(dayKey: string) {
  const parsed = parseDayKey(dayKey)
  const start = zonedDateTimeToUtc(parsed.year, parsed.month, parsed.day, 0, 0, 0, 0, APP_TIMEZONE)
  const end = zonedDateTimeToUtc(
    parsed.year,
    parsed.month,
    parsed.day,
    23,
    59,
    59,
    999,
    APP_TIMEZONE,
  )
  return { start, end }
}

function getWeekdayFromDayKey(dayKey: string): Weekday {
  const parsed = parseDayKey(dayKey)
  const dayIndex = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay()
  const weekdays = Object.values(Weekday)
  const enumIndex = (dayIndex + 6) % 7
  return weekdays[enumIndex]
}

function createLogTimestampForDayKey(dayKey: string) {
  const selected = parseDayKey(dayKey)
  const now = new Date()
  const timeParts = getTimePartsInTimeZone(now, APP_TIMEZONE)
  return zonedDateTimeToUtc(
    selected.year,
    selected.month,
    selected.day,
    timeParts.hour,
    timeParts.minute,
    timeParts.second,
    now.getMilliseconds(),
    APP_TIMEZONE,
  )
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

  return {
    action: 'unknown',
    reply: 'Try: log set of <exercise> with <reps> reps',
  }
}

function normalizeName(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
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
        payload.setType === 'timed'
          ? `${value} sec of ${primary}`
          : `${value} reps of ${primary}`,
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
  activeTab?: 'time' | 'categories' | 'exercises' | 'history'
  model: string | null
}) {
  const contextSelectedDay = dayKeyFromDateInTimeZone(new Date(), APP_TIMEZONE)
  if (payload.activeTab && payload.activeTab !== 'exercises') {
    return {
      reply: 'You are not in exercises tab. Switch to exercises and try again.',
      didLogSet: false,
      selectedDay: contextSelectedDay,
      undo: null,
      suggestions: [] as AssistantSuggestion[],
    }
  }
  const targetDayKey = dayKeyFromDateInTimeZone(new Date(), APP_TIMEZONE)
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
      selectedDay: targetDayKey,
      undo: null,
      suggestions,
    }
  }
  const weekday = getWeekdayFromDayKey(targetDayKey)
  const range = getUtcRangeForDayKey(targetDayKey)
  const exerciseObjectId = new mongoose.Types.ObjectId(String(matchedExercise._id))
  let workoutLog = await WorkoutLogModel.findOne({
    userId: payload.userId,
    weekday,
    date: {
      $gte: range.start,
      $lte: range.end,
    },
  })
  if (!workoutLog) {
    workoutLog = await WorkoutLogModel.create({
      userId: payload.userId,
      date: createLogTimestampForDayKey(targetDayKey),
      weekday,
      exercises: [],
    })
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
    loggedAt: createLogTimestampForDayKey(targetDayKey),
  })
  const lastSet = exerciseEntry.sets[exerciseEntry.sets.length - 1] as {
    loggedAt?: Date
    type?: SetType
    reps?: number
    duration?: number
  }
  const loggedAtMs = new Date(lastSet.loggedAt || new Date()).getTime()
  const setTypeToken = payload.setType === 'timed' ? 'timed' : 'reps'
  const valueToken = payload.setType === 'timed' ? Number(lastSet.duration || value) : Number(lastSet.reps || value)
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
    selectedDay: targetDayKey,
    undo: {
      selectedDay: targetDayKey,
      logId: `${String(exerciseObjectId)}|${String(loggedAtMs)}|${setTypeToken}|${String(valueToken)}`,
    },
    suggestions: [] as AssistantSuggestion[],
  }
}

async function callProviderForIntent(payload: {
  message: string
  selectedDay: string
  activeTab?: string
  exerciseNames: string[]
}) {
  const provider = (getOptionalEnvValue('AI_PROVIDER') || 'google').toLowerCase()
  const skillsBlock = JSON.stringify(ASSISTANT_SKILLS)
  const contextBlock = JSON.stringify({
    selectedDay: payload.selectedDay,
    activeTab: payload.activeTab || null,
    exercises: payload.exerciseNames,
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

      const contextSelectedDay = dayKeyFromDateInTimeZone(new Date(), APP_TIMEZONE)
      const exercises = await ExerciseModel.find({ userId }).lean()
      const exerciseNames = exercises.map((exercise) => exercise.name)
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

      const providerResolution = await callProviderForIntent({
        message: data.message,
        selectedDay: contextSelectedDay,
        activeTab: data.context?.activeTab,
        exerciseNames,
      })
      if (providerResolution.failedAllModels) {
        appLogError('BW_MCP_ALL_MODELS_FAILED', 'Assistant model fallback chain failed', {
          source: 'mcp',
        })
        return {
          reply:
            'Failed to reach available Gemini models right now. Please verify GOOGLE_API_KEY and try again.',
          didLogSet: false,
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

      if (inferredIntent.action !== 'log_set') {
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
          reply:
            suggestions.length > 0
              ? 'Did you mean one of these?'
              : inferredIntent.reply,
          didLogSet: false,
          selectedDay: contextSelectedDay,
          undo: null,
          suggestions,
        }
      }
      return logAssistantSet({
        userId,
        exercises: exercises.map((exercise) => ({
          _id: exercise._id as mongoose.Types.ObjectId | string,
          name: exercise.name,
        })),
        exerciseName: inferredIntent.exerciseName,
        setType: inferredIntent.setType,
        value: inferredIntent.value,
        activeTab: data.context?.activeTab,
        model: providerResolution.usedModel,
      })
    } catch (error) {
      appLogError('BW_MCP_EXECUTION_FAILED', 'Assistant execution failed', {
        source: 'mcp',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return {
        reply: 'Failed to process assistant request.',
        didLogSet: false,
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
        selectedDay: dayKeyFromDateInTimeZone(new Date(), APP_TIMEZONE),
        undo: null,
        suggestions: [],
      }
    }
  })
