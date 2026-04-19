import { History, Trash2 } from 'lucide-react'

import { SetType } from '~/enums/enums'

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
    <div>
      <div className="flex items-center gap-2 mb-4 text-slate-600">
        <History size={12} />
        <h3 className="text-[10px] font-black uppercase tracking-widest">History</h3>
      </div>
      {logs.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-xl p-4 text-center text-[10px] text-slate-500 uppercase font-black tracking-widest">
          No logs for selected day
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="bg-[#232a33]/40 p-3 rounded-xl flex justify-between items-center border border-slate-700/20"
            >
              {confirmDeleteSetId === log.id ? (
                <div className="flex-1 flex items-center justify-between px-2">
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                    Delete?
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onConfirmDeleteSetId(null)}
                      className="text-[9px] font-black text-slate-500 uppercase"
                    >
                      No
                    </button>
                    <button
                      onClick={() => onRemoveSet(log.id)}
                      className="text-[9px] font-black text-red-500 uppercase underline"
                    >
                      Yes
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-300 text-sm">{log.exerciseName}</span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-[#1A1F26] px-3 py-1 rounded-lg border border-slate-800 text-orange-400 font-mono text-xs font-black">
                      {log.value}{' '}
                      <span className="text-[8px] text-slate-600 ml-0.5">
                        {log.type === SetType.REPS ? 'REPS' : 'SEC'}
                      </span>
                    </div>
                    <button
                      onClick={() => onConfirmDeleteSetId(log.id)}
                      className="p-1.5 text-slate-700 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
