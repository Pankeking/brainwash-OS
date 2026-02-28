import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { appLogError, appLogInfo, appLogWarn } from './logger'

const clientTelemetryInputSchema = z.object({
  code: z.string().min(1).max(120),
  level: z.enum(['info', 'warn', 'error']).default('info'),
  message: z.string().min(1).max(500),
  context: z.record(z.string(), z.unknown()).optional(),
})

export const logClientTelemetryFn = createServerFn({ method: 'POST' })
  .inputValidator(clientTelemetryInputSchema)
  .handler(async ({ data }) => {
    const payload = {
      source: 'client',
      ...(data.context || {}),
    }

    if (data.level === 'error') {
      appLogError(data.code, data.message, payload)
      return { success: true }
    }
    if (data.level === 'warn') {
      appLogWarn(data.code, data.message, payload)
      return { success: true }
    }

    appLogInfo(data.code, data.message, payload)
    return { success: true }
  })
