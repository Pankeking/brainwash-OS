import assert from 'node:assert/strict'
import test from 'node:test'

import { sanitizeTelemetryContext } from '../src/server/telemetry.utils.js'

test('sanitizeTelemetryContext keeps only flat safe telemetry fields', () => {
  assert.deepEqual(
    sanitizeTelemetryContext({
      activeTab: 'exercises',
      transcriptLength: 42,
      success: true,
      nullable: null,
      nested: { bad: true },
    }),
    {
      activeTab: 'exercises',
      transcriptLength: 42,
      success: true,
      nullable: null,
    },
  )
})

test('sanitizeTelemetryContext drops sensitive-looking keys', () => {
  assert.deepEqual(
    sanitizeTelemetryContext({
      token: 'secret',
      email: 'user@example.com',
      safeCode: 'BW_OK',
    }),
    {
      safeCode: 'BW_OK',
    },
  )
})
