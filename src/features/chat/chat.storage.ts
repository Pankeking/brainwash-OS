import type { ChatMessage, ChatThread } from './chat.types'

export const CHAT_HISTORY_STORAGE_KEY = 'brainwash-chat-history-v1'

export function buildChatTitle(messages: ChatMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === 'user')
  if (!firstUserMessage) {
    return 'New chat'
  }
  return firstUserMessage.text.slice(0, 36)
}

export function persistChatThreads(threads: ChatThread[]) {
  try {
    localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(threads))
  } catch {
    return
  }
}

export function readStoredChatThreads() {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as ChatThread[]
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((thread) => thread && typeof thread.id === 'string').slice(0, 3)
  } catch {
    return []
  }
}
