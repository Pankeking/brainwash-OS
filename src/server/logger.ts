import { inspect } from 'node:util'
import { isProductionEnvironment } from './env'

type LogLevel = 'info' | 'warn' | 'error'

type LogPayload = {
  level: LogLevel
  code: string
  message: string
  context?: Record<string, unknown>
  timestamp: string
}

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
}

function colorize(value: string, color: string) {
  return `${color}${value}${ANSI.reset}`
}

function parseJsonLike(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }
  const trimmed = value.trim()
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) {
    return value
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function normalizeContext(context?: Record<string, unknown>) {
  if (!context) {
    return undefined
  }
  const entries = Object.entries(context).map(([key, value]) => [key, parseJsonLike(value)])
  return Object.fromEntries(entries)
}

function getLoggerFormat() {
  const fallbackMode = isProductionEnvironment() ? 'json' : 'pretty'
  const mode = (process.env.APP_LOG_FORMAT || fallbackMode).toLowerCase()
  return mode === 'json' ? 'json' : 'pretty'
}

function formatPrettyLine(payload: LogPayload) {
  const levelColors: Record<LogLevel, string> = {
    info: ANSI.blue,
    warn: ANSI.yellow,
    error: ANSI.red,
  }
  const normalizedContext = normalizeContext(payload.context)
  const contextPreview =
    normalizedContext && Object.keys(normalizedContext).length > 0
      ? `\n${colorize('context', ANSI.dim)} ${inspect(normalizedContext, {
          colors: true,
          depth: 8,
          compact: false,
          breakLength: 120,
        })}`
      : ''
  return `${colorize(payload.timestamp, ANSI.dim)} ${colorize(payload.level.toUpperCase(), levelColors[payload.level])} ${colorize(payload.code, ANSI.cyan)} ${payload.message}${contextPreview}`
}

function emit(payload: LogPayload) {
  const line =
    getLoggerFormat() === 'json'
      ? JSON.stringify(payload)
      : formatPrettyLine({
          ...payload,
          context: normalizeContext(payload.context),
        })
  if (payload.level === 'error') {
    console.error(line)
    return
  }
  if (payload.level === 'warn') {
    console.warn(line)
    return
  }
  console.log(line)
}

export function appLogInfo(code: string, message: string, context?: Record<string, unknown>) {
  emit({
    level: 'info',
    code,
    message,
    context,
    timestamp: new Date().toISOString(),
  })
}

export function appLogWarn(code: string, message: string, context?: Record<string, unknown>) {
  emit({
    level: 'warn',
    code,
    message,
    context,
    timestamp: new Date().toISOString(),
  })
}

export function appLogError(code: string, message: string, context?: Record<string, unknown>) {
  emit({
    level: 'error',
    code,
    message,
    context,
    timestamp: new Date().toISOString(),
  })
}
