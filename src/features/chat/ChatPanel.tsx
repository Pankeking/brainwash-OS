import { MessageSquare, Mic, MicOff, Send, X } from 'lucide-react'

import type { ChatMessage, ChatThread } from './chat.types'

interface ChatPanelProps {
  activeThreadId: string | null
  assistantPending: boolean
  directLogPending: boolean
  input: string
  isChatExpanded: boolean
  isChatMounted: boolean
  isListening: boolean
  isMicPressing: boolean
  messages: ChatMessage[]
  onClose: () => void
  onCreateThread: () => void
  onInputChange: (value: string) => void
  onMicPointerCancel: (pointerId: number) => void
  onMicPointerDown: (pointerId: number, setPointerCapture: () => void) => void
  onMicPointerUp: (pointerId: number) => void
  onSelectThread: (threadId: string) => void
  onSend: () => void
  onSuggestion: (messageId: string, suggestionId: string) => void
  onToggle: () => void
  onUndo: (messageId: string) => void
  recordingSeconds: number
  threads: ChatThread[]
  undoPending: boolean
}

export function ChatPanel({
  activeThreadId,
  assistantPending,
  directLogPending,
  input,
  isChatExpanded,
  isChatMounted,
  isListening,
  isMicPressing,
  messages,
  onClose,
  onCreateThread,
  onInputChange,
  onMicPointerCancel,
  onMicPointerDown,
  onMicPointerUp,
  onSelectThread,
  onSend,
  onSuggestion,
  onToggle,
  onUndo,
  recordingSeconds,
  threads,
  undoPending,
}: ChatPanelProps) {
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
                onClick={onCreateThread}
                className="px-2 py-1 rounded-md bg-[#2A333E] border border-slate-700 text-[9px] font-black uppercase tracking-widest text-slate-300"
              >
                New chat
              </button>
              <div className="flex items-center gap-1 overflow-x-auto">
                {threads.map((thread, index) => (
                  <button
                    key={thread.id}
                    onClick={() => onSelectThread(thread.id)}
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
              onClick={onClose}
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
                    onClick={() => onUndo(message.id)}
                    disabled={undoPending || !!message.undo.used}
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
                      onClick={() => onSuggestion(message.id, suggestion.id)}
                      disabled={!!message.suggestionsUsed || directLogPending}
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
                  <div className="text-[10px] font-mono font-black text-red-300">
                    {recordingSeconds}s
                  </div>
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
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && onSend()}
                placeholder="Type a command..."
                className="flex-1 bg-[#2A333E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
              <button
                onPointerDown={(event) => {
                  event.preventDefault()
                  onMicPointerDown(event.pointerId, () =>
                    event.currentTarget.setPointerCapture(event.pointerId),
                  )
                }}
                onPointerUp={(event) => {
                  event.preventDefault()
                  onMicPointerUp(event.pointerId)
                }}
                onPointerCancel={(event) => {
                  event.preventDefault()
                  onMicPointerCancel(event.pointerId)
                }}
                className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-all select-none touch-none ${
                  isListening
                    ? 'bg-red-600 border-red-500 text-white scale-110'
                    : isMicPressing
                      ? 'bg-orange-600 border-orange-500 text-white scale-110'
                      : 'bg-[#2A333E] border-slate-700 text-slate-200 hover:bg-[#364252] hover:scale-105'
                }`}
                style={{ WebkitTouchCallout: 'none' }}
                onContextMenu={(event) => event.preventDefault()}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button
                onClick={onSend}
                disabled={assistantPending}
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
          onClick={onToggle}
          className="w-14 h-14 bg-orange-600 rounded-2xl shadow-2xl text-white active:scale-95 transition-all hover:scale-105 hover:shadow-[0_10px_30px_rgba(249,115,22,0.35)] flex items-center justify-center"
        >
          <MessageSquare size={22} fill="currentColor" />
        </button>
      </div>
    </div>
  )
}
