export type ChatContext = {
  selectedDay?: string
  activeTab?: 'time' | 'categories' | 'exercises' | 'history'
}

export interface ChatProps {
  context?: ChatContext
  onWorkoutDataChanged?: (selectedDay: string) => void
}

export type ChatSuggestion = {
  id: string
  label: string
  exerciseName: string
  setType: 'reps' | 'timed'
  value: number
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: number
  undo?: {
    selectedDay: string
    logId: string
    used?: boolean
  } | null
  suggestions?: ChatSuggestion[]
  suggestionsUsed?: boolean
}

export type ChatThread = {
  id: string
  createdAt: number
  updatedAt: number
  title: string
  messages: ChatMessage[]
}
