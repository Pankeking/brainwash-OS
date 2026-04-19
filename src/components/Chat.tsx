import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'

import { assistantChatFn, assistantLogDirectFn } from '~/server/assistant'
import { logClientTelemetryFn } from '~/server/telemetry'
import { transcribeVoiceFn } from '~/server/voice'
import { removeWorkoutSetFn } from '~/server/workout'

import { ChatPanel } from '~/features/chat/ChatPanel'
import { convertBlobToPcmBase64 } from '~/features/chat/chat.audio'
import {
  buildChatTitle,
  persistChatThreads,
  readStoredChatThreads,
} from '~/features/chat/chat.storage'
import type { ChatMessage, ChatProps, ChatThread } from '~/features/chat/chat.types'

export default function Chat({ context, onWorkoutDataChanged }: ChatProps) {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isChatExpanded, setIsChatExpanded] = useState(false)
  const [isChatMounted, setIsChatMounted] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMicPressing, setIsMicPressing] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [threads, setThreads] = useState<ChatThread[]>([])

  const audioChunksRef = useRef<BlobPart[]>([])
  const hasRecordingStartedRef = useRef(false)
  const holdStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const openCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingStartedAtRef = useRef<number | null>(null)
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const appendMessage = (message: ChatMessage) => {
    setMessages((currentMessages) => {
      const nextMessages = [...currentMessages, message]
      if (!activeThreadId) {
        return nextMessages
      }

      const now = Date.now()
      setThreads((currentThreads) => {
        const nextThreads = currentThreads
          .map((thread) =>
            thread.id === activeThreadId
              ? {
                  ...thread,
                  messages: nextMessages,
                  updatedAt: now,
                  title: buildChatTitle(nextMessages),
                }
              : thread,
          )
          .sort((left, right) => right.updatedAt - left.updatedAt)
          .slice(0, 3)

        persistChatThreads(nextThreads)
        return nextThreads
      })

      return nextMessages
    })
  }

  const patchMessages = (updater: (messages: ChatMessage[]) => ChatMessage[]) => {
    setMessages((currentMessages) => {
      const nextMessages = updater(currentMessages)
      if (!activeThreadId) {
        return nextMessages
      }

      const now = Date.now()
      setThreads((currentThreads) => {
        const nextThreads = currentThreads
          .map((thread) =>
            thread.id === activeThreadId
              ? {
                  ...thread,
                  messages: nextMessages,
                  updatedAt: now,
                  title: buildChatTitle(nextMessages),
                }
              : thread,
          )
          .sort((left, right) => right.updatedAt - left.updatedAt)
          .slice(0, 3)

        persistChatThreads(nextThreads)
        return nextThreads
      })

      return nextMessages
    })
  }

  const telemetryMutation = useMutation({
    mutationFn: (payload: {
      code: string
      level?: 'info' | 'warn' | 'error'
      message: string
      context?: Record<string, unknown>
    }) => logClientTelemetryFn({ data: payload }),
  })

  const pushClientLog = (
    code: string,
    level: 'info' | 'warn' | 'error',
    message: string,
    telemetryContext?: Record<string, unknown>,
  ) => {
    telemetryMutation.mutate({
      code,
      level,
      message,
      context: {
        activeTab: telemetryContext?.activeTab || telemetryContext?.tab || telemetryContext?.active,
        ...telemetryContext,
      },
    })
  }

  const assistantMutation = useMutation({
    mutationFn: (payload: { message: string; context?: ChatProps['context'] }) =>
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

  const undoSetMutation = useMutation({
    mutationFn: (payload: { selectedDay: string; logId: string }) =>
      removeWorkoutSetFn({
        data: {
          selectedDay: payload.selectedDay,
          logId: payload.logId,
        },
      }),
    onSuccess: (_data, variables) => {
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
    mutationFn: (payload: { exerciseName: string; setType: 'reps' | 'timed'; value: number }) =>
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

  const transcribeMutation = useMutation({
    mutationFn: (payload: {
      audioBase64: string
      mimeType: string
      liveAudioBase64?: string
      liveMimeType?: string
    }) => transcribeVoiceFn({ data: payload }),
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
          item.role === 'assistant' && (item.suggestions?.length || 0) > 0 && !item.suggestionsUsed,
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
            item.id === lastAssistantWithSuggestions.id ? { ...item, suggestionsUsed: true } : item,
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

  const clearOpenCloseTimeout = () => {
    if (openCloseTimeoutRef.current) {
      clearTimeout(openCloseTimeoutRef.current)
      openCloseTimeoutRef.current = null
    }
  }

  const clearHoldStartTimeout = () => {
    if (holdStartTimeoutRef.current) {
      clearTimeout(holdStartTimeoutRef.current)
      holdStartTimeoutRef.current = null
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
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      )
    }
  }

  const createThread = () => {
    const now = Date.now()
    const nextThread: ChatThread = {
      id: `thread-${now}`,
      createdAt: now,
      updatedAt: now,
      title: 'New chat',
      messages: [],
    }

    setActiveThreadId(nextThread.id)
    setMessages([])
    setInput('')
    setThreads((currentThreads) => {
      const nextThreads = [nextThread, ...currentThreads].slice(0, 3)
      persistChatThreads(nextThreads)
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

  const handleSuggestion = (messageId: string, suggestionId: string) => {
    const parentMessage = messages.find((message) => message.id === messageId)
    const suggestion = parentMessage?.suggestions?.find((item) => item.id === suggestionId)
    if (!parentMessage || !suggestion) {
      return
    }

    patchMessages((currentMessages) =>
      currentMessages.map((item) =>
        item.id === messageId ? { ...item, suggestionsUsed: true } : item,
      ),
    )
    directLogMutation.mutate({
      exerciseName: suggestion.exerciseName,
      setType: suggestion.setType,
      value: suggestion.value,
    })
  }

  const handleUndo = (messageId: string) => {
    const targetMessage = messages.find((message) => message.id === messageId)
    const undo = targetMessage?.undo
    if (!targetMessage || !undo || undo.used) {
      return
    }

    patchMessages((currentMessages) =>
      currentMessages.map((item) =>
        item.id === messageId
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
  }

  const handleMicPointerDown = (pointerId: number, setPointerCapture: () => void) => {
    setPointerCapture()
    pointerIdRef.current = pointerId
    setIsMicPressing(true)
    clearHoldStartTimeout()
    holdStartTimeoutRef.current = setTimeout(() => {
      void startListening()
    }, 500)
  }

  const handleMicPointerUp = (pointerId: number) => {
    if (pointerIdRef.current === pointerId) {
      pointerIdRef.current = null
    }
    setIsMicPressing(false)
    stopListening()
  }

  useEffect(() => {
    setThreads(readStoredChatThreads())
  }, [])

  useEffect(
    () => () => {
      clearOpenCloseTimeout()
      clearHoldStartTimeout()
      stopListening()
    },
    [],
  )

  return (
    <ChatPanel
      activeThreadId={activeThreadId}
      assistantPending={assistantMutation.isPending}
      directLogPending={directLogMutation.isPending}
      input={input}
      isChatExpanded={isChatExpanded}
      isChatMounted={isChatMounted}
      isListening={isListening}
      isMicPressing={isMicPressing}
      messages={messages}
      onClose={closeChat}
      onCreateThread={createThread}
      onInputChange={setInput}
      onMicPointerCancel={handleMicPointerUp}
      onMicPointerDown={handleMicPointerDown}
      onMicPointerUp={handleMicPointerUp}
      onSelectThread={selectThread}
      onSend={() => sendMessage(input)}
      onSuggestion={handleSuggestion}
      onToggle={toggleChat}
      onUndo={handleUndo}
      recordingSeconds={recordingSeconds}
      threads={threads}
      undoPending={undoSetMutation.isPending}
    />
  )
}
