import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { appLogError, appLogInfo, appLogWarn } from './logger'
import { useAppSession } from '~/utils/session'
import { sanitizeTelemetryContext } from './telemetry.utils'

const clientTelemetryInputSchema = z.object({
  code: z.string().min(1).max(120),
  level: z.enum(['info', 'warn', 'error']).default('info'),
  message: z.string().min(1).max(500),
  context: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
})

export const logClientTelemetryFn = createServerFn({ method: 'POST' })
  .inputValidator(clientTelemetryInputSchema)
  .handler(async ({ data }) => {
    const session = await useAppSession()
    if (!session.data.userId) {
      throw new Error('Unauthorized')
    }

    const payload = {
      source: 'client',
      userId: session.data.userId,
      ...(sanitizeTelemetryContext(data.context) || {}),
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
