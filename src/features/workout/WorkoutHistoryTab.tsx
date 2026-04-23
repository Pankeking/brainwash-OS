import { History, Trash2 } from 'lucide-react'

import { SetType } from '~/enums/enums'
import { formatTimedValue } from '~/features/workout/workout.formatting'

import type { WorkoutLog } from './workout.types'

interface WorkoutHistoryTabProps {
  confirmDeleteSetId: string | null
  logs: WorkoutLog[]
  onConfirmDeleteSetId: (value: string | null) => void
  onRemoveSet: (logId: string) => void
}

export function WorkoutHistoryTab({
  confirmDeleteSetId,
  logs,
  onConfirmDeleteSetId,
  onRemoveSet,
}: WorkoutHistoryTabProps) {
  return (
    <div className="rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(38,49,63,0.98),rgba(24,31,40,0.96))] p-4 shadow-[0_20px_44px_rgba(2,8,23,0.24)]">
      <div className="mb-4 flex items-center justify-between gap-3 text-slate-500">
        <div className="flex items-center gap-2">
          <History size={12} />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">History</h3>
        </div>
        <div className="rounded-full border border-white/8 bg-[#161d26]/90 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-300">
          {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
        </div>
      </div>
      {logs.length === 0 ? (
        <div className="rounded-[1.35rem] border border-dashed border-white/10 bg-[#161d26]/70 p-6 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          No logs for selected day
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-[1.35rem] border border-white/8 bg-[#161d26]/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            >
              {confirmDeleteSetId === log.id ? (
                <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
                    Delete?
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onConfirmDeleteSetId(null)}
                      className="flex h-10 items-center justify-center rounded-2xl border border-white/8 bg-white/6 px-4 text-[9px] font-black uppercase tracking-[0.18em] text-slate-300"
                    >
                      Keep
                    </button>
                    <button
                      onClick={() => onRemoveSet(log.id)}
                      className="flex h-10 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/8 px-4 text-[9px] font-black uppercase tracking-[0.18em] text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-100">
                      {log.exerciseName}
                    </span>
                    <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-2xl border border-orange-400/12 bg-orange-500/10 px-3 py-2 text-right">
                      <div className="font-mono text-sm font-black text-orange-300">
                        {log.type === SetType.REPS ? log.value : formatTimedValue(log.value)}
                      </div>
                      <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-500">
                        {log.type === SetType.REPS ? 'Reps' : 'Time'}
                      </div>
                    </div>
                    <button
                      onClick={() => onConfirmDeleteSetId(log.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/6 text-slate-500 transition-colors hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
