import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { useAppSession } from '~/utils/session'
import { getOptionalEnvValue } from './env'
import { appLogError, appLogInfo, appLogWarn } from './logger'

const MAX_AUDIO_BASE64_LENGTH = 2_000_000

const transcribeVoiceInputSchema = z.object({
  audioBase64: z.string().min(1).max(MAX_AUDIO_BASE64_LENGTH),
  mimeType: z.string().min(1).max(120).default('audio/webm'),
  liveAudioBase64: z.string().min(1).max(MAX_AUDIO_BASE64_LENGTH).optional(),
  liveMimeType: z.string().min(1).max(120).optional(),
})

function extractTranscriptCandidate(rawText: string) {
  const withoutFence = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  const trimmed = withoutFence
  if (!trimmed) {
    return ''
  }
  try {
    const parsed = JSON.parse(trimmed) as { transcript?: unknown }
    if (typeof parsed.transcript === 'string') {
      return parsed.transcript.trim()
    }
  } catch {
    const jsonMatch = trimmed.match(/\{[\s\S]*"transcript"\s*:\s*"([\s\S]*?)"[\s\S]*\}/i)
    if (jsonMatch?.[1]) {
      return jsonMatch[1].trim()
    }
    return trimmed
  }
  return trimmed
}

function isGuardrailViolation(value: string) {
  const blockedPatterns = [
    /transcribe this audio/i,
    /return only the transcript/i,
    /cannot transcribe audio/i,
    /unable to process audio/i,
    /audio files/i,
  ]
  return blockedPatterns.some((pattern) => pattern.test(value))
}

const LIVE_ONLY_AUDIO_MODELS = new Set([
  'gemini-2.5-flash-native-audio-latest',
  'gemini-2.5-flash-preview-native-audio-dialog',
  'gemini-live-2.5-flash-preview-native-audio-09-2025',
  'gemini-2.5-flash-native-audio-preview-12-2025',
])

function shouldUseGoogleLiveVoice() {
  const rawValue = (getOptionalEnvValue('GOOGLE_VOICE_USE_LIVE_API') || 'false').toLowerCase()
  return rawValue !== '0' && rawValue !== 'false' && rawValue !== 'off'
}

function getGoogleLiveVoiceModel() {
  return 'gemini-2.5-flash-native-audio-latest'
}

function getPcmSampleRateFromMimeType(mimeType: string) {
  const match = mimeType.toLowerCase().match(/rate\s*=\s*(\d{4,6})/)
  const parsedRate = Number.parseInt(match?.[1] || '', 10)
  if (!Number.isFinite(parsedRate) || parsedRate < 8000) {
    return 16_000
  }
  return parsedRate
}

function estimateAudioDurationMs(audioBase64: string, mimeType: string) {
  const normalizedMime = mimeType.toLowerCase()
  if (!normalizedMime.startsWith('audio/pcm')) {
    return 0
  }
  const sampleRate = getPcmSampleRateFromMimeType(normalizedMime)
  const paddingLength = audioBase64.endsWith('==') ? 2 : audioBase64.endsWith('=') ? 1 : 0
  const byteLength = Math.floor((audioBase64.length * 3) / 4) - paddingLength
  if (byteLength <= 0) {
    return 0
  }
  const durationMs = Math.floor((byteLength / (sampleRate * 2)) * 1000)
  return durationMs > 0 ? durationMs : 0
}

function getGoogleLiveTimeoutMs(audioBase64: string, mimeType: string) {
  const durationMs = estimateAudioDurationMs(audioBase64, mimeType)
  if (durationMs <= 0) {
    return 12_000
  }
  const timeoutMs = Math.ceil(durationMs * 1.5) + 6_000
  if (timeoutMs < 8_000) {
    return 8_000
  }
  if (timeoutMs > 45_000) {
    return 45_000
  }
  return timeoutMs
}

function splitBase64IntoChunks(audioBase64: string, chunkSize = 24_000) {
  const normalizedChunkSize = Math.max(4, chunkSize - (chunkSize % 4))
  const chunks: string[] = []
  let start = 0
  while (start < audioBase64.length) {
    const end = Math.min(audioBase64.length, start + normalizedChunkSize)
    chunks.push(audioBase64.slice(start, end))
    start = end
  }
  return chunks
}

function getOrderedGoogleLiveModels() {
  return [
    getGoogleLiveVoiceModel(),
    'gemini-2.5-flash-native-audio-preview-12-2025',
    'gemini-2.5-flash-native-audio-preview-09-2025',
  ]
}

function getOrderedGoogleTranscriptionModels() {
  const envOverride = getOptionalEnvValue('GOOGLE_VOICE_TRANSCRIBE_MODELS')
  const configuredModels = envOverride
    ? envOverride
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : []

  const defaultModels = ['gemini-3-flash-preview', 'gemini-2.5-flash-lite', 'gemini-2.5-flash']
  const candidates = configuredModels.length > 0 ? configuredModels : defaultModels
  const filtered = candidates.filter((model) => !LIVE_ONLY_AUDIO_MODELS.has(model))
  if (filtered.length > 0) {
    return filtered
  }
  return defaultModels
}

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : null
}

function readRecordPath(record: UnknownRecord | null, path: string[]) {
  let current: unknown = record
  for (const segment of path) {
    const currentRecord = asRecord(current)
    if (!currentRecord) {
      return undefined
    }
    current = currentRecord[segment]
  }
  return current
}

function getLiveTranscriptCandidates(payload: unknown) {
  const value = asRecord(payload)
  const candidates: string[] = []
  const modelParts =
    readRecordPath(value, ['serverContent', 'modelTurn', 'parts']) ||
    readRecordPath(value, ['server_content', 'model_turn', 'parts'])
  if (Array.isArray(modelParts)) {
    modelParts.forEach((part) => {
      const text = readRecordPath(asRecord(part), ['text'])
      if (typeof text === 'string') {
        candidates.push(text)
      }
      const inlineDataText = readRecordPath(asRecord(part), ['inlineData', 'text'])
      if (typeof inlineDataText === 'string') {
        candidates.push(inlineDataText)
      }
      const inlineDataSnakeText = readRecordPath(asRecord(part), ['inline_data', 'text'])
      if (typeof inlineDataSnakeText === 'string') {
        candidates.push(inlineDataSnakeText)
      }
    })
  }
  const directCandidates = [
    readRecordPath(value, ['serverContent', 'inputTranscription', 'text']),
    readRecordPath(value, ['serverContent', 'outputTranscription', 'text']),
    readRecordPath(value, ['server_content', 'input_transcription', 'text']),
    readRecordPath(value, ['server_content', 'output_transcription', 'text']),
    readRecordPath(value, ['text']),
  ]
  directCandidates.forEach((entry) => {
    if (typeof entry === 'string' && entry.trim()) {
      candidates.push(entry)
    }
  })
  return candidates
}

async function transcribeWithGoogleLive(
  audioBase64: string,
  mimeType: string,
  apiKey: string,
  model: string,
) {
  if (typeof WebSocket === 'undefined') {
    throw new Error('WebSocket is not available in this server runtime')
  }
  const websocketUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`
  const startedAt = Date.now()

  appLogInfo('BW_VOICE_LIVE_MODEL_ATTEMPT', 'Attempting voice transcription with Live API', {
    provider: 'google',
    model,
    mimeType,
  })

  return await new Promise<string>((resolve, reject) => {
    const websocket = new WebSocket(websocketUrl)
    let transcript = ''
    let isSettled = false
    let messageCount = 0
    let isSetupComplete = false

    const finalizeSuccess = (value: string) => {
      if (isSettled) {
        return
      }
      isSettled = true
      appLogInfo('BW_VOICE_LIVE_SOCKET_SUCCESS', 'Live websocket completed with transcript', {
        provider: 'google',
        model,
        messageCount,
        latencyMs: Date.now() - startedAt,
        transcriptLength: value.length,
      })
      try {
        websocket.close()
      } catch {
        return
      }
      resolve(value)
    }

    const finalizeFailure = (error: Error) => {
      if (isSettled) {
        return
      }
      isSettled = true
      appLogWarn('BW_VOICE_LIVE_SOCKET_FAIL', 'Live websocket failed', {
        provider: 'google',
        model,
        messageCount,
        latencyMs: Date.now() - startedAt,
        error: error.message,
      })
      try {
        websocket.close()
      } catch {
        return
      }
      reject(error)
    }

    const timeoutMs = getGoogleLiveTimeoutMs(audioBase64, mimeType)
    const timeout = setTimeout(() => {
      if (transcript.trim()) {
        finalizeSuccess(transcript.trim())
        return
      }
      finalizeFailure(new Error('Live API transcription timed out'))
    }, timeoutMs)

    websocket.addEventListener('open', () => {
      appLogInfo('BW_VOICE_LIVE_SOCKET_OPEN', 'Live websocket opened', {
        provider: 'google',
        model,
      })
      websocket.send(
        JSON.stringify({
          setup: {
            model: `models/${model}`,
            generationConfig: {
              responseModalities: ['TEXT'],
              temperature: 0,
            },
            inputAudioTranscription: {},
          },
        }),
      )
    })

    websocket.addEventListener('message', (event) => {
      messageCount += 1
      const rawData = typeof event.data === 'string' ? event.data : ''
      if (!rawData) {
        return
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(rawData) as unknown
      } catch {
        return
      }
      const parsedRecord = asRecord(parsed)
      if (!parsedRecord) {
        return
      }

      const setupComplete =
        readRecordPath(parsedRecord, ['setupComplete']) ||
        readRecordPath(parsedRecord, ['setup_complete'])
      if (setupComplete && !isSetupComplete) {
        isSetupComplete = true
        appLogInfo('BW_VOICE_LIVE_SETUP_COMPLETE', 'Live websocket setup completed', {
          provider: 'google',
          model,
        })
        const mediaChunks = splitBase64IntoChunks(audioBase64)
        mediaChunks.forEach((chunk) => {
          websocket.send(
            JSON.stringify({
              realtimeInput: {
                mediaChunks: [
                  {
                    mimeType,
                    data: chunk,
                  },
                ],
              },
            }),
          )
        })
        appLogInfo('BW_VOICE_LIVE_AUDIO_SENT', 'Sent live audio payload', {
          provider: 'google',
          model,
          mimeType,
          chunkCount: mediaChunks.length,
          timeoutMs,
          estimatedDurationMs: estimateAudioDurationMs(audioBase64, mimeType),
        })
        websocket.send(
          JSON.stringify({
            realtimeInput: {
              audioStreamEnd: true,
            },
          }),
        )
        return
      }

      const parsedError = readRecordPath(parsedRecord, ['error'])
      const parsedErrorRecord = asRecord(parsedError)
      const parsedErrorMessage = readRecordPath(parsedErrorRecord, ['message'])
      const parsedErrorStatus = readRecordPath(parsedErrorRecord, ['status'])
      if (parsedErrorMessage || parsedErrorStatus) {
        clearTimeout(timeout)
        finalizeFailure(
          new Error(
            typeof parsedErrorMessage === 'string' ? parsedErrorMessage : 'Live API returned error',
          ),
        )
        return
      }

      const candidates = getLiveTranscriptCandidates(parsedRecord)
      candidates.forEach((rawCandidate) => {
        const candidate = extractTranscriptCandidate(rawCandidate)
        if (!candidate) {
          return
        }
        if (isGuardrailViolation(candidate)) {
          return
        }
        if (candidate.length > 260) {
          return
        }
        if (candidate.length > transcript.length) {
          transcript = candidate
        }
      })

      const turnComplete =
        readRecordPath(parsedRecord, ['serverContent', 'turnComplete']) === true ||
        readRecordPath(parsedRecord, ['server_content', 'turn_complete']) === true ||
        readRecordPath(parsedRecord, ['turnComplete']) === true ||
        readRecordPath(parsedRecord, ['turn_complete']) === true
      const inputFinished =
        readRecordPath(parsedRecord, ['serverContent', 'inputTranscription', 'finished']) ===
          true ||
        readRecordPath(parsedRecord, ['server_content', 'input_transcription', 'finished']) === true
      if ((inputFinished || turnComplete) && transcript.trim()) {
        clearTimeout(timeout)
        finalizeSuccess(transcript.trim())
      }
    })

    websocket.addEventListener('error', () => {
      clearTimeout(timeout)
      finalizeFailure(new Error('Live API websocket error'))
    })

    websocket.addEventListener('close', (event) => {
      clearTimeout(timeout)
      if (isSettled) {
        return
      }
      appLogWarn('BW_VOICE_LIVE_SOCKET_CLOSED', 'Live websocket closed', {
        provider: 'google',
        model,
        messageCount,
        code: event.code,
        reason: event.reason || '',
        wasClean: event.wasClean,
        setupComplete: isSetupComplete,
        latencyMs: Date.now() - startedAt,
      })
      if (transcript.trim()) {
        finalizeSuccess(transcript.trim())
        return
      }
      finalizeFailure(new Error('Live API connection closed before transcript'))
    })
  })
}

async function transcribeWithGoogleGenerateContent(
  audioBase64: string,
  mimeType: string,
  apiKey: string,
  signal: AbortSignal,
) {
  const orderedModels = getOrderedGoogleTranscriptionModels()
  for (const model of orderedModels) {
    try {
      appLogInfo('BW_VOICE_MODEL_ATTEMPT', 'Attempting voice transcription model', {
        provider: 'google',
        model,
        mimeType,
      })
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: 'Return strict JSON only: {"transcript":"<exact spoken words>"}',
                  },
                  {
                    inlineData: {
                      mimeType,
                      data: audioBase64,
                    },
                  },
                ],
              },
            ],
          }),
        },
      )

      if (!response.ok) {
        appLogWarn('BW_VOICE_MODEL_REJECTED', 'Voice model request failed', {
          provider: 'google',
          model,
          status: response.status,
        })
        if (response.status === 404 && LIVE_ONLY_AUDIO_MODELS.has(model)) {
          appLogWarn(
            'BW_VOICE_MODEL_ENDPOINT_MISMATCH',
            'Voice model is not available on generateContent endpoint',
            {
              provider: 'google',
              model,
              endpoint: 'generateContent',
            },
          )
        }
        continue
      }

      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const rawTranscript =
        data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || '')
          .join(' ')
          .trim() || ''
      const transcript = extractTranscriptCandidate(rawTranscript)

      if (transcript) {
        if (isGuardrailViolation(transcript)) {
          appLogWarn('BW_VOICE_GUARDRAIL_BLOCKED', 'Blocked unsafe transcription output', {
            provider: 'google',
            model,
            transcript,
          })
          continue
        }
        if (transcript.length > 260) {
          appLogWarn('BW_VOICE_TRANSCRIPT_TOO_LONG', 'Transcript too long for command mode', {
            provider: 'google',
            model,
            transcriptLength: transcript.length,
          })
          continue
        }
        appLogInfo('BW_VOICE_MODEL_SUCCESS', 'Voice transcription model succeeded', {
          provider: 'google',
          model,
          transcriptLength: transcript.length,
        })
        return {
          transcript,
          provider: 'google' as const,
          model,
          route: 'generateContent' as const,
        }
      }
    } catch (error) {
      appLogWarn('BW_VOICE_MODEL_ERROR', 'Voice model call errored', {
        provider: 'google',
        model,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      continue
    }
  }
  throw new Error('All transcription models failed')
}

async function transcribeWithGoogle(payload: {
  audioBase64: string
  mimeType: string
  liveAudioBase64?: string
  liveMimeType?: string
}) {
  const apiKey = getOptionalEnvValue('GOOGLE_API_KEY')
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is not configured')
  }
  const transcriptionAudioBase64 = payload.liveAudioBase64 || payload.audioBase64
  const transcriptionMimeType = payload.liveMimeType || payload.mimeType
  if (shouldUseGoogleLiveVoice()) {
    const liveAudioBase64 = payload.liveAudioBase64 || payload.audioBase64
    const liveMimeType = payload.liveMimeType || payload.mimeType
    const orderedLiveModels = getOrderedGoogleLiveModels()
    for (const liveModel of orderedLiveModels) {
      try {
        const transcript = await transcribeWithGoogleLive(
          liveAudioBase64,
          liveMimeType,
          apiKey,
          liveModel,
        )
        if (transcript.trim()) {
          appLogInfo('BW_VOICE_LIVE_MODEL_SUCCESS', 'Live API transcription succeeded', {
            provider: 'google',
            model: liveModel,
            transcriptLength: transcript.length,
          })
          return {
            transcript,
            provider: 'google' as const,
            model: liveModel,
            route: 'live' as const,
          }
        }
      } catch (error) {
        appLogWarn(
          'BW_VOICE_LIVE_MODEL_ERROR',
          'Live API transcription failed, trying fallback chain',
          {
            provider: 'google',
            model: liveModel,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        )
      }
    }
  }
  return transcribeWithGoogleGenerateContent(
    transcriptionAudioBase64,
    transcriptionMimeType,
    apiKey,
    AbortSignal.timeout(20_000),
  )
}

async function requireAuthenticatedVoiceUser() {
  const session = await useAppSession()
  if (!session.data.userId) {
    throw new Error('Unauthorized')
  }
}

export const transcribeVoiceFn = createServerFn({ method: 'POST' })
  .inputValidator(transcribeVoiceInputSchema)
  .handler(async ({ data }) => {
    const startedAt = Date.now()
    try {
      await requireAuthenticatedVoiceUser()
      const provider = (getOptionalEnvValue('AI_PROVIDER') || 'google').toLowerCase()
      if (provider !== 'google') {
        throw new Error(
          `Voice transcription is currently configured for google provider, got: ${provider}`,
        )
      }

      appLogInfo('BW_VOICE_TRANSCRIBE_START', 'Voice transcription request received', {
        provider,
        mimeType: data.mimeType,
        liveMimeType: data.liveMimeType || null,
        hasLiveAudio: Boolean(data.liveAudioBase64),
      })
      const result = await transcribeWithGoogle({
        audioBase64: data.audioBase64,
        mimeType: data.mimeType,
        liveAudioBase64: data.liveAudioBase64,
        liveMimeType: data.liveMimeType,
      })
      appLogInfo('BW_VOICE_TRANSCRIBE_RESULT', 'Voice transcription completed', {
        provider: result.provider,
        model: result.model,
        route: result.route,
        transcriptLength: result.transcript.length,
        elapsedMs: Date.now() - startedAt,
      })
      return { transcript: result.transcript, route: result.route, model: result.model }
    } catch (error) {
      appLogError('BW_VOICE_TRANSCRIBE_FAILED', 'Voice transcription failed', {
        provider: (getOptionalEnvValue('AI_PROVIDER') || 'google').toLowerCase(),
        mimeType: data.mimeType,
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  })
