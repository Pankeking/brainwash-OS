import type { ChatMessage, ChatThread } from './chat.types'

export function buildChatTitle(messages: ChatMessage[]) {
  const firstUserMessageIndex = messages.findIndex((message) => message.role === 'user')
  return firstUserMessageIndex === -1 ? 'New chat' : `Chat ${firstUserMessageIndex + 1}`
}

export function persistChatThreads(_threads: ChatThread[]) {
  return
}

export function readStoredChatThreads() {
  return [] as ChatThread[]
}
