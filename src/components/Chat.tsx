import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Mic, MicOff, Send, X } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { assistantChatFn, assistantLogDirectFn } from '~/server/assistant'
import { logClientTelemetryFn } from '~/server/telemetry'
import { transcribeVoiceFn } from '~/server/voice'
import { removeWorkoutSetFn } from '~/server/workout'

type ChatContext = {
  selectedDay?: string
  activeTab?: 'time' | 'categories' | 'exercises' | 'history'
}

interface ChatProps {
  context?: ChatContext
  onWorkoutDataChanged?: (selectedDay: string) => void
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: number
  undo?: {
    selectedDay: string
    logId: string
    used?: boolean
  } | null
  suggestions?: Array<{
    id: string
    label: string
    exerciseName: string
    setType: 'reps' | 'timed'
    value: number
  }>
  suggestionsUsed?: boolean
}

type ChatThread = {
  id: string
  createdAt: number
  updatedAt: number
  title: string
  messages: ChatMessage[]
}

function float32ToInt16(input: Float32Array) {
  const output = new Int16Array(input.length)
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index] || 0))
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }
  return output
}

function int16ToLittleEndianBytes(input: Int16Array) {
  const bytes = new Uint8Array(input.length * 2)
  const view = new DataView(bytes.buffer)
  for (let index = 0; index < input.length; index += 1) {
    view.setInt16(index * 2, input[index] || 0, true)
  }
  return bytes
}

function toBase64FromBytes(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function convertAudioBufferToPcm16k(audioBuffer: AudioBuffer) {
  const source = audioBuffer.getChannelData(0)
  const targetRate = 16_000
  const ratio = audioBuffer.sampleRate / targetRate
  const outputLength = Math.max(1, Math.floor(source.length / ratio))
  const resampled = new Float32Array(outputLength)
  let offsetResult = 0
  let offsetSource = 0
  while (offsetResult < outputLength) {
    const nextOffset = Math.min(source.length, Math.floor((offsetResult + 1) * ratio))
    let accumulator = 0
    let count = 0
    while (offsetSource < nextOffset) {
      accumulator += source[offsetSource] || 0
      offsetSource += 1
      count += 1
    }
    resampled[offsetResult] = count > 0 ? accumulator / count : 0
    offsetResult += 1
  }
  const pcmInt16 = float32ToInt16(resampled)
  return int16ToLittleEndianBytes(pcmInt16)
}

async function convertBlobToPcmBase64(blob: Blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const decodingContext = new AudioContext()
  try {
    const audioBuffer = await decodingContext.decodeAudioData(arrayBuffer.slice(0))
    const pcmBytes = convertAudioBufferToPcm16k(audioBuffer)
    return toBase64FromBytes(pcmBytes)
  } finally {
    await decodingContext.close()
  }
}

export default function Chat({ context, onWorkoutDataChanged }: ChatProps) {
  const CHAT_HISTORY_STORAGE_KEY = 'brainwash-chat-history-v1'
  const [isChatMounted, setIsChatMounted] = useState(false)
  const [isChatExpanded, setIsChatExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [isMicPressing, setIsMicPressing] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<BlobPart[]>([])
  const openCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recordingStartedAtRef = useRef<number | null>(null)
  const holdStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasRecordingStartedRef = useRef(false)

  const toTitle = (items: ChatMessage[]) => {
    const firstUser = items.find((item) => item.role === 'user')
    if (!firstUser) {
      return 'New chat'
    }
    return firstUser.text.slice(0, 36)
  }

  const appendMessage = (message: ChatMessage) => {
    setMessages((currentMessages) => {
      const nextMessages = [...currentMessages, message]
      if (activeThreadId) {
        const now = Date.now()
        setThreads((currentThreads) => {
          const nextThreads = currentThreads
            .map((thread) =>
              thread.id === activeThreadId
                ? {
                    ...thread,
                    messages: nextMessages,
                    updatedAt: now,
                    title: toTitle(nextMessages),
                  }
                : thread,
            )
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 3)
          try {
            localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(nextThreads))
          } catch {
            return nextThreads
          }
          return nextThreads
        })
      }
      return nextMessages
    })
  }

  const patchMessages = (updater: (items: ChatMessage[]) => ChatMessage[]) => {
    setMessages((currentMessages) => {
      const nextMessages = updater(currentMessages)
      if (activeThreadId) {
        const now = Date.now()
        setThreads((currentThreads) => {
          const nextThreads = currentThreads
            .map((thread) =>
              thread.id === activeThreadId
                ? {
                    ...thread,
                    messages: nextMessages,
                    updatedAt: now,
                    title: toTitle(nextMessages),
                  }
                : thread,
            )
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 3)
          try {
            localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(nextThreads))
          } catch {
            return nextThreads
          }
          return nextThreads
        })
      }
      return nextMessages
    })
  }

  const assistantMutation = useMutation({
    mutationFn: (payload: { message: string; context?: ChatContext }) =>
      assistantChatFn({ data: payload }),
    onSuccess: (data) => {
      appendMessage({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: data.reply,
        createdAt: Date.now(),
        undo: data.undo || null,
        suggestions: data.suggestions || [],
        suggestionsUsed: false,
      })
      if (data.didLogSet && data.selectedDay && onWorkoutDataChanged) {
        onWorkoutDataChanged(data.selectedDay)
      }
    },
  })

  const telemetryMutation = useMutation({
    mutationFn: (payload: {
      code: string
      level?: 'info' | 'warn' | 'error'
      message: string
      context?: Record<string, unknown>
    }) => logClientTelemetryFn({ data: payload }),
  })

  const transcribeMutation = useMutation({
    mutationFn: (payload: {
      audioBase64: string
      mimeType: string
      liveAudioBase64?: string
      liveMimeType?: string
    }) =>
      transcribeVoiceFn({ data: payload }),
    onSuccess: (data) => {
      const transcript = data.transcript.trim()
      if (!transcript) {
        appendMessage({
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: 'No voice transcript captured. Try again.',
          createdAt: Date.now(),
        })
        pushClientLog('BW_VOICE_TRANSCRIPT_EMPTY', 'warn', 'Voice transcript empty')
        return
      }
      setInput(transcript)
      sendMessage(transcript)
      pushClientLog('BW_VOICE_TRANSCRIBE_SUCCESS', 'info', 'Voice transcription succeeded', {
        transcriptLength: transcript.length,
        route: data.route || null,
        model: data.model || null,
      })
    },
    onError: (error) => {
      appendMessage({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: 'Voice transcription failed. Try again.',
        createdAt: Date.now(),
      })
      pushClientLog('BW_VOICE_TRANSCRIBE_FAIL', 'error', 'Voice transcription failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  const sendMessage = (rawMessage: string) => {
    const message = rawMessage.trim()
    if (!message || assistantMutation.isPending) {
      return
    }
    const lastAssistantWithSuggestions = [...messages]
      .reverse()
      .find(
        (item) =>
          item.role === 'assistant' &&
          (item.suggestions?.length || 0) > 0 &&
          !item.suggestionsUsed,
      )
    const isAffirmative = /^(yes|yeah|yep|si|sure|correct|exactly|ok|okay)$/i.test(message)
    if (lastAssistantWithSuggestions && isAffirmative) {
      const suggestion = lastAssistantWithSuggestions.suggestions?.[0]
      if (suggestion) {
        appendMessage({
          id: `user-${Date.now()}`,
          role: 'user',
          text: message,
          createdAt: Date.now(),
        })
        patchMessages((currentMessages) =>
          currentMessages.map((item) =>
            item.id === lastAssistantWithSuggestions.id
              ? { ...item, suggestionsUsed: true }
              : item,
          ),
        )
        directLogMutation.mutate({
          exerciseName: suggestion.exerciseName,
          setType: suggestion.setType,
          value: suggestion.value,
        })
        setInput('')
        return
      }
    }
    appendMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      text: message,
      createdAt: Date.now(),
    })
    setInput('')
    assistantMutation.mutate({
      message,
      context,
    })
  }

  const undoSetMutation = useMutation({
    mutationFn: (payload: { selectedDay: string; logId: string }) =>
      removeWorkoutSetFn({
        data: {
          selectedDay: payload.selectedDay,
          logId: payload.logId,
        },
      }),
    onSuccess: (_, variables) => {
      appendMessage({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: 'Deleted logged set.',
        createdAt: Date.now(),
      })
      patchMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.undo?.logId === variables.logId
            ? {
                ...message,
                undo: {
                  ...message.undo,
                  used: true,
                },
              }
            : message,
        ),
      )
      if (onWorkoutDataChanged) {
        onWorkoutDataChanged(variables.selectedDay)
      }
    },
  })

  const directLogMutation = useMutation({
    mutationFn: (payload: {
      exerciseName: string
      setType: 'reps' | 'timed'
      value: number
    }) =>
      assistantLogDirectFn({
        data: {
          ...payload,
          context,
        },
      }),
    onSuccess: (data) => {
      appendMessage({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: data.reply,
        createdAt: Date.now(),
        undo: data.undo || null,
        suggestions: data.suggestions || [],
        suggestionsUsed: false,
      })
      if (data.didLogSet && data.selectedDay && onWorkoutDataChanged) {
        onWorkoutDataChanged(data.selectedDay)
      }
    },
  })

  const handleSend = () => {
    sendMessage(input)
  }

  const pushClientLog = (
    code: string,
    level: 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, unknown>,
  ) => {
    telemetryMutation.mutate({
      code,
      level,
      message,
      context: {
        activeTab: context?.activeTab || context?.tab || context?.active || undefined,
        ...context,
      },
    })
  }

  const clearOpenCloseTimeout = () => {
    if (openCloseTimeoutRef.current) {
      clearTimeout(openCloseTimeoutRef.current)
      openCloseTimeoutRef.current = null
    }
  }

  const clearRecordingTimers = () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current)
      recordingTimeoutRef.current = null
    }
    recordingStartedAtRef.current = null
    setRecordingSeconds(0)
  }

  const clearHoldStartTimeout = () => {
    if (holdStartTimeoutRef.current) {
      clearTimeout(holdStartTimeoutRef.current)
      holdStartTimeoutRef.current = null
    }
  }

  const createThread = () => {
    const now = Date.now()
    const thread: ChatThread = {
      id: `thread-${now}`,
      createdAt: now,
      updatedAt: now,
      title: 'New chat',
      messages: [],
    }
    setActiveThreadId(thread.id)
    setMessages([])
    setInput('')
    setThreads((currentThreads) => {
      const nextThreads = [thread, ...currentThreads].slice(0, 3)
      try {
        localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(nextThreads))
      } catch {
        return nextThreads
      }
      return nextThreads
    })
  }

  const selectThread = (threadId: string) => {
    const thread = threads.find((item) => item.id === threadId)
    if (!thread) {
      return
    }
    setActiveThreadId(thread.id)
    setMessages(thread.messages || [])
    setInput('')
  }

  const openChat = () => {
    clearOpenCloseTimeout()
    setIsChatMounted(true)
    if (!activeThreadId) {
      if (threads[0]) {
        selectThread(threads[0].id)
      } else {
        createThread()
      }
    }
    requestAnimationFrame(() => {
      setIsChatExpanded(true)
    })
  }

  const closeChat = () => {
    clearOpenCloseTimeout()
    setIsChatExpanded(false)
    setIsMicPressing(false)
    stopListening()
    openCloseTimeoutRef.current = setTimeout(() => {
      setIsChatMounted(false)
    }, 220)
  }

  const toggleChat = () => {
    if (isChatMounted && isChatExpanded) {
      closeChat()
      return
    }
    openChat()
  }

  const stopListening = () => {
    pointerIdRef.current = null
    setIsMicPressing(false)
    clearHoldStartTimeout()
    if (!hasRecordingStartedRef.current) {
      setIsListening(false)
      return
    }
    hasRecordingStartedRef.current = false
    if (!mediaRecorderRef.current) {
      setIsListening(false)
      clearRecordingTimers()
      return
    }
    try {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      pushClientLog('BW_VOICE_STOP', 'info', 'Voice recognition stop requested', {
        reason: 'hold_release',
      })
    } catch (error) {
      pushClientLog('BW_VOICE_STOP_FAIL', 'warn', 'Voice recognition stop failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
    setIsListening(false)
    clearRecordingTimers()
  }

  const startListening = async () => {
    if (isListening || mediaRecorderRef.current) {
      return
    }

    if (!window.isSecureContext) {
      appendMessage({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: 'Voice requires HTTPS secure context.',
        createdAt: Date.now(),
      })
      pushClientLog('BW_VOICE_INSECURE_CONTEXT', 'error', 'Voice blocked due to insecure context')
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      appendMessage({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: 'Microphone API is not available in this browser.',
        createdAt: Date.now(),
      })
      pushClientLog('BW_VOICE_MEDIA_DEVICES_UNAVAILABLE', 'error', 'getUserMedia unavailable')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const mimeTypeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      const mimeType =
        mimeTypeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ||
        undefined
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      audioChunksRef.current = []
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      recorder.onerror = (event: Event) => {
        pushClientLog('BW_VOICE_RECORDING_ERROR', 'error', 'MediaRecorder error', {
          eventType: event.type,
        })
      }
      recorder.onstop = () => {
        const chunks = audioChunksRef.current
        const activeMimeType = recorder.mimeType || mimeType || 'audio/webm'
        audioChunksRef.current = []
        mediaRecorderRef.current = null
        setIsListening(false)
        clearRecordingTimers()
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop())
          mediaStreamRef.current = null
        }
        if (chunks.length === 0) {
          pushClientLog('BW_VOICE_NO_AUDIO_CHUNKS', 'warn', 'No audio chunks captured')
          return
        }
        const blob = new Blob(chunks, { type: activeMimeType })
        const reader = new FileReader()
        reader.onloadend = async () => {
          const result = typeof reader.result === 'string' ? reader.result : ''
          const base64 = result.includes(',') ? result.split(',')[1] : ''
          if (!base64) {
            pushClientLog('BW_VOICE_BASE64_FAIL', 'error', 'Failed to encode audio to base64')
            return
          }
          let liveAudioBase64: string | undefined
          let liveMimeType: string | undefined
          try {
            liveAudioBase64 = await convertBlobToPcmBase64(blob)
            liveMimeType = 'audio/pcm;rate=16000'
            pushClientLog('BW_VOICE_PCM_READY', 'info', 'PCM audio prepared for live route', {
              pcmLength: liveAudioBase64.length,
            })
          } catch (error) {
            pushClientLog('BW_VOICE_PCM_CONVERT_FAIL', 'warn', 'Failed to prepare PCM live audio', {
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          }
          transcribeMutation.mutate({
            audioBase64: base64,
            mimeType: activeMimeType,
            liveAudioBase64,
            liveMimeType,
          })
        }
        reader.readAsDataURL(blob)
      }

      recorder.start()
      hasRecordingStartedRef.current = true
      setIsListening(true)
      recordingStartedAtRef.current = Date.now()
      recordingIntervalRef.current = setInterval(() => {
        const startedAt = recordingStartedAtRef.current
        if (!startedAt) {
          return
        }
        setRecordingSeconds(Math.floor((Date.now() - startedAt) / 1000))
      }, 200)
      recordingTimeoutRef.current = setTimeout(() => {
        pushClientLog('BW_VOICE_AUTO_STOP', 'info', 'Voice auto stop at max duration', {
          maxSeconds: 15,
        })
        stopListening()
      }, 15_000)
      pushClientLog('BW_VOICE_MIC_PERMISSION_OK', 'info', 'Microphone permission granted')
      pushClientLog('BW_VOICE_RECORDING_START', 'info', 'MediaRecorder started', {
        mimeType: recorder.mimeType || mimeType || 'audio/webm',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      appendMessage({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: 'Microphone permission denied or unavailable. Check browser/site permissions.',
        createdAt: Date.now(),
      })
      pushClientLog(
        'BW_VOICE_MIC_PERMISSION_FAIL',
        'error',
        'Microphone permission request failed',
        {
          error: message,
        },
      )
      return
    }
  }

  useEffect(
    () => {
      try {
        const raw = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY)
        if (!raw) {
          return
        }
        const parsed = JSON.parse(raw) as ChatThread[]
        if (!Array.isArray(parsed)) {
          return
        }
        const safeThreads = parsed
          .filter((thread) => thread && typeof thread.id === 'string')
          .slice(0, 3)
        setThreads(safeThreads)
      } catch {
        return
      }
    },
    [],
  )

  useEffect(
    () => () => {
      clearOpenCloseTimeout()
      clearHoldStartTimeout()
      stopListening()
    },
    [],
  )

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {isChatMounted && (
        <div
          className={`absolute bottom-[92px] right-6 pointer-events-auto w-[min(90vw,430px)] h-[min(78vh,640px)] bg-[#1A1F26]/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col origin-bottom-right ${
            isChatExpanded
              ? 'animate-[chatGrow_220ms_cubic-bezier(0.2,0.9,0.2,1)]'
              : 'animate-[chatShrink_220ms_cubic-bezier(0.4,0,0.2,1)]'
          }`}
        >
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Coach
              </div>
              <button
                onClick={createThread}
                className="px-2 py-1 rounded-md bg-[#2A333E] border border-slate-700 text-[9px] font-black uppercase tracking-widest text-slate-300"
              >
                New chat
              </button>
              <div className="flex items-center gap-1 overflow-x-auto">
                {threads.map((thread, index) => (
                  <button
                    key={thread.id}
                    onClick={() => selectThread(thread.id)}
                    className={`px-2 py-1 rounded-md border text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${
                      activeThreadId === thread.id
                        ? 'bg-orange-600/20 border-orange-500/40 text-orange-200'
                        : 'bg-[#2A333E] border-slate-700 text-slate-300'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={closeChat}
              className="w-8 h-8 rounded-lg bg-[#2A333E] border border-slate-700 flex items-center justify-center text-slate-300 transition-all hover:scale-105 hover:bg-[#364252] active:scale-95"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {messages.length === 0 && (
              <div className="text-[10px] text-slate-500">
                Try: log set of push ups with 15 reps
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`px-3 py-2 rounded-xl text-[12px] ${
                  message.role === 'user'
                    ? 'bg-orange-600 text-white ml-8 shadow-[0_6px_20px_rgba(249,115,22,0.25)]'
                    : 'bg-[#2A333E] text-slate-200 mr-8 border border-slate-700/40'
                }`}
              >
                {message.text}
                {message.role === 'assistant' && message.undo && (
                  <button
                    onClick={() => {
                      const undo = message.undo
                      if (!undo || undo.used) {
                        return
                      }
                      patchMessages((currentMessages) =>
                        currentMessages.map((item) =>
                          item.id === message.id
                            ? {
                                ...item,
                                undo: {
                                  ...undo,
                                  used: true,
                                },
                              }
                            : item,
                        ),
                      )
                      undoSetMutation.mutate({
                        selectedDay: undo.selectedDay,
                        logId: undo.logId,
                      })
                    }}
                    disabled={undoSetMutation.isPending || !!message.undo.used}
                    className="mt-2 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border border-red-500/40 text-red-300 bg-red-500/10 disabled:opacity-50"
                  >
                    {message.undo.used ? 'Deleted' : 'Delete log'}
                  </button>
                )}
                {message.role === 'assistant' &&
                  (message.suggestions?.length || 0) > 0 &&
                  message.suggestions?.map((suggestion) => (
                    <button
                      key={`${message.id}-${suggestion.id}`}
                      onClick={() => {
                        patchMessages((currentMessages) =>
                          currentMessages.map((item) =>
                            item.id === message.id ? { ...item, suggestionsUsed: true } : item,
                          ),
                        )
                        directLogMutation.mutate({
                          exerciseName: suggestion.exerciseName,
                          setType: suggestion.setType,
                          value: suggestion.value,
                        })
                      }}
                      disabled={!!message.suggestionsUsed || directLogMutation.isPending}
                      className="mt-2 mr-1 inline-flex px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border border-orange-500/40 text-orange-200 bg-orange-500/10 disabled:opacity-50"
                    >
                      {suggestion.label}
                    </button>
                  ))}
              </div>
            ))}
          </div>
          <div className="p-3.5 border-t border-slate-700">
            <div className="h-7 mb-2">
              {isListening && (
                <div className="h-7 bg-[#2A333E] border border-red-500/40 rounded-lg px-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-400 text-[10px] font-black uppercase tracking-widest">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Recording
                  </div>
                  <div className="text-[10px] font-mono font-black text-red-300">{recordingSeconds}s</div>
                </div>
              )}
              {!isListening && isMicPressing && (
                <div className="h-7 bg-[#2A333E] border border-orange-500/40 rounded-lg px-3 flex items-center">
                  <div className="text-orange-300 text-[10px] font-black uppercase tracking-widest">
                    Hold to record
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a command..."
                className="flex-1 bg-[#2A333E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
              <button
              onPointerDown={(e) => {
                e.preventDefault()
                e.currentTarget.setPointerCapture(e.pointerId)
                pointerIdRef.current = e.pointerId
                setIsMicPressing(true)
                clearHoldStartTimeout()
                holdStartTimeoutRef.current = setTimeout(() => {
                  void startListening()
                }, 500)
              }}
              onPointerUp={(e) => {
                e.preventDefault()
                if (pointerIdRef.current === e.pointerId) {
                  pointerIdRef.current = null
                }
                setIsMicPressing(false)
                stopListening()
              }}
              onPointerCancel={(e) => {
                e.preventDefault()
                if (pointerIdRef.current === e.pointerId) {
                  pointerIdRef.current = null
                }
                setIsMicPressing(false)
                stopListening()
              }}
              className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-all select-none touch-none ${
                isListening
                  ? 'bg-red-600 border-red-500 text-white scale-110'
                  : isMicPressing
                    ? 'bg-orange-600 border-orange-500 text-white scale-110'
                    : 'bg-[#2A333E] border-slate-700 text-slate-200 hover:bg-[#364252] hover:scale-105'
              }`}
              style={{ WebkitTouchCallout: 'none' }}
              onContextMenu={(e) => e.preventDefault()}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button
                onClick={handleSend}
                disabled={assistantMutation.isPending}
                className="w-11 h-11 rounded-xl bg-orange-600 text-white flex items-center justify-center disabled:opacity-50 transition-all hover:scale-105 active:scale-95 shadow-[0_8px_20px_rgba(249,115,22,0.3)]"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
      <div
        style={{
          left: isChatExpanded ? '24px' : 'calc(100vw - 24px - 56px)',
        }}
        className="absolute bottom-6 z-[60] pointer-events-auto transition-[left] duration-300 opacity-100"
      >
        <button
          onClick={toggleChat}
          className="w-14 h-14 bg-orange-600 rounded-2xl shadow-2xl text-white active:scale-95 transition-all hover:scale-105 hover:shadow-[0_10px_30px_rgba(249,115,22,0.35)] flex items-center justify-center"
        >
          <MessageSquare size={22} fill="currentColor" />
        </button>
      </div>
    </div>
  )
}
