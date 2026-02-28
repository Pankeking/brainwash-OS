import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import {
  Plus,
  Minus,
  Check,
  Dumbbell,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { SetType } from '~/enums/enums'

interface Category {
  id: string
  name: string
  color: string
}

interface Props {
  id: string
  name: string
  categoryIds: string[]
  allCategories: Category[]
  onAdd: (payload: { type: SetType; value: number }) => void
  onRemove: () => void
  onRename: (newName: string) => void
  onToggleCategory: (categoryId: string) => void
  onUpdateWeeklyGoal: (weeklySetGoal: number | null) => void
  onToggleExpand: (id: string) => void
  isExpanded: boolean
  count: number
  weeklySetGoal: number | null
  weekSetsDone: number
  stats: {
    week: { best: number | null; avg: number | null; worst: number | null }
    month: { best: number | null; avg: number | null; worst: number | null }
  }
}

export default function ExerciseActionCard({
  id,
  name,
  categoryIds,
  allCategories,
  onAdd,
  onRemove,
  onRename,
  onToggleCategory,
  onUpdateWeeklyGoal,
  onToggleExpand,
  isExpanded,
  count,
  weeklySetGoal,
  weekSetsDone,
  stats,
}: Props) {
  const repsStorageKey = useMemo(() => `workout-last-value:${id}:${SetType.REPS}`, [id])
  const timedStorageKey = useMemo(() => `workout-last-value:${id}:${SetType.TIMED}`, [id])
  const getInitialValue = (storageKey: string, fallback: number) => {
    if (typeof window === 'undefined') {
      return fallback
    }
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return fallback
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      return fallback
    }
    return Math.max(1, Math.round(parsed))
  }

  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [setType, setSetType] = useState<SetType>(SetType.REPS)
  const [repsValue, setRepsValue] = useState(10)
  const [timedValue, setTimedValue] = useState(30)
  const [goalDraft, setGoalDraft] = useState(weeklySetGoal ?? 10)
  const [editName, setEditName] = useState(name)
  const [storageReady, setStorageReady] = useState(false)
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const tempValue = setType === SetType.REPS ? repsValue : timedValue

  const stopHold = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current)
      holdIntervalRef.current = null
    }
  }

  const updateCurrentValue = (delta: number) => {
    if (setType === SetType.REPS) {
      setRepsValue((current) => Math.max(1, current + delta))
      return
    }
    setTimedValue((current) => Math.max(1, current + delta))
  }

  const startHold = (delta: number) => {
    updateCurrentValue(delta)
    stopHold()
    holdTimeoutRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => {
        updateCurrentValue(delta)
      }, 90)
    }, 300)
  }

  const getHoldHandlers = (delta: number) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      startHold(delta)
    },
    onPointerUp: stopHold,
    onPointerLeave: stopHold,
    onPointerCancel: stopHold,
  })

  useEffect(() => {
    setRepsValue(getInitialValue(repsStorageKey, 10))
    setTimedValue(getInitialValue(timedStorageKey, 30))
    setStorageReady(true)
  }, [repsStorageKey, timedStorageKey])

  useEffect(() => {
    if (!storageReady || typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(repsStorageKey, String(repsValue))
  }, [repsStorageKey, repsValue, storageReady])

  useEffect(() => {
    if (!storageReady || typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(timedStorageKey, String(timedValue))
  }, [timedStorageKey, timedValue, storageReady])

  useEffect(() => () => stopHold(), [])

  useEffect(() => {
    setGoalDraft(weeklySetGoal ?? 10)
  }, [weeklySetGoal])

  const goalProgressPct =
    weeklySetGoal && weeklySetGoal > 0
      ? Math.min(100, Math.round((weekSetsDone / weeklySetGoal) * 100))
      : 0

  return (
    <div
      onClick={() => !isExpanded && !isEditing && onToggleExpand(id)}
      className={`bg-[#2A333E] rounded-2xl border-t border-white/5 transition-all duration-300 overflow-hidden ${
        isExpanded
          ? 'p-3 shadow-[0_8px_0_0_#14181d] ring-1 ring-orange-500/30'
          : 'p-3 shadow-[0_4px_0_0_#14181d] hover:bg-[#323d4a]'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div
            className={`transition-all rounded-xl flex items-center justify-center shadow-inner ${
              isExpanded
                ? 'w-10 h-10 bg-[#1A1F26] text-orange-500'
                : 'w-8 h-8 bg-[#1A1F26] text-slate-400'
            }`}
          >
            <Dumbbell size={isExpanded ? 18 : 14} />
          </div>

          <div className="flex flex-col flex-1 leading-tight">
            {isEditing ? (
              <input
                autoFocus
                className="bg-[#1A1F26] border border-orange-500 rounded px-2 py-1 text-[16px] md:text-xs font-bold text-slate-100 focus:outline-none w-full"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.key === 'Enter' && (onRename(editName), setIsEditing(false))}
              />
            ) : (
              <>
                <span
                  className={`font-black tracking-tight transition-all ${isExpanded ? 'text-base text-slate-100' : 'text-sm text-slate-300'}`}
                >
                  {name}
                </span>
                <div className="flex gap-1 mt-0.5 flex-wrap">
                  {!isExpanded && count > 0 && (
                    <span className="text-[8px] font-black text-orange-500 uppercase tracking-widest mr-1">
                      {count} Sets
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2">
          {isEditing ? (
            <button
              onClick={(e) => (e.stopPropagation(), onRename(editName), setIsEditing(false))}
              className="w-8 h-8 flex items-center justify-center text-green-400 bg-green-400/10 rounded-lg border border-green-400/20"
            >
              <Check size={16} />
            </button>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsEditing(true)
                }}
                className="w-8 h-8 flex items-center justify-center text-slate-100 bg-white/10 rounded-lg border border-white/10"
              >
                <Edit2 size={12} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleExpand(id)
                  setIsConfirmingDelete(false)
                }}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${isExpanded ? 'bg-orange-500 text-white border-orange-400' : 'bg-white/10 text-slate-100 border-white/10'}`}
              >
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </>
          )}
        </div>
      </div>

      <div
        className={`transition-all duration-300 ${isExpanded ? 'max-h-[680px] opacity-100 mt-2 pt-2 border-t border-slate-700/30' : 'max-h-0 opacity-0'}`}
      >
        {!isConfirmingDelete ? (
          <>
            <div className="overflow-x-auto snap-x snap-mandatory">
              <div className="flex w-full">
                <div className="min-w-full snap-start pr-1">
                  <div className="mb-4">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                      Goal
                    </span>
                    <div className="bg-[#1A1F26] rounded-xl border border-slate-700 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[9px] uppercase tracking-widest font-black text-slate-400">
                          Sets per week
                        </div>
                        <div className="text-[9px] uppercase tracking-widest font-black text-orange-400">
                          {weekSetsDone}
                          {weeklySetGoal ? ` / ${weeklySetGoal}` : ''}
                        </div>
                      </div>
                      {weeklySetGoal ? (
                        <div className="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-orange-500 transition-all"
                            style={{ width: `${goalProgressPct}%` }}
                          />
                        </div>
                      ) : (
                        <div className="mt-2 text-[9px] text-slate-500 font-bold">
                          No weekly goal set
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setGoalDraft((value) => Math.max(1, value - 1))
                          }}
                          className="w-7 h-7 flex items-center justify-center bg-[#2A333E] rounded-lg text-slate-300"
                        >
                          <Minus size={12} />
                        </button>
                        <div className="w-12 text-center font-mono font-black text-white text-sm">
                          {goalDraft}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setGoalDraft((value) => value + 1)
                          }}
                          className="w-7 h-7 flex items-center justify-center bg-[#2A333E] rounded-lg text-slate-300"
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onUpdateWeeklyGoal(goalDraft)
                          }}
                          className="ml-auto px-2.5 h-7 bg-orange-600 rounded-lg text-[9px] font-black uppercase tracking-widest"
                        >
                          Save
                        </button>
                        {weeklySetGoal !== null && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onUpdateWeeklyGoal(null)
                            }}
                            className="px-2.5 h-7 bg-slate-700 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-300"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      Set Type
                    </span>
                    <div className="flex rounded-lg overflow-hidden border border-slate-700">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSetType(SetType.REPS)
                        }}
                        className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest ${
                          setType === SetType.REPS
                            ? 'bg-orange-500 text-white'
                            : 'bg-[#1A1F26] text-slate-400'
                        }`}
                      >
                        Reps
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSetType(SetType.TIMED)
                        }}
                        className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest ${
                          setType === SetType.TIMED
                            ? 'bg-orange-500 text-white'
                            : 'bg-[#1A1F26] text-slate-400'
                        }`}
                      >
                        Time
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      {setType === SetType.REPS ? 'Reps' : 'Seconds'}
                    </span>
                    <div className="flex items-center gap-1 bg-[#1A1F26] rounded-xl p-0.5 border border-slate-700">
                      <button
                        {...getHoldHandlers(-5)}
                        className="w-9 h-7 flex items-center justify-center bg-[#2A333E] rounded-lg text-slate-300 text-[10px] font-black"
                      >
                        -5
                      </button>
                      <button
                        {...getHoldHandlers(-1)}
                        className="w-7 h-7 flex items-center justify-center bg-[#2A333E] rounded-lg text-slate-300"
                      >
                        <Minus size={12} />
                      </button>
                      <div className="w-12 text-center font-mono font-black text-white text-sm">
                        {tempValue}
                      </div>
                      <button
                        {...getHoldHandlers(1)}
                        className="w-7 h-7 flex items-center justify-center bg-[#2A333E] rounded-lg text-slate-300"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        {...getHoldHandlers(5)}
                        className="w-9 h-7 flex items-center justify-center bg-[#2A333E] rounded-lg text-slate-300 text-[10px] font-black"
                      >
                        +5
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 mt-2">
                    <button
                      onClick={(e) => (
                        e.stopPropagation(),
                        onAdd({ type: setType, value: tempValue })
                      )}
                      className="w-full bg-orange-600 py-2.5 rounded-xl shadow-[0_3px_0_0_#9a3412] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2"
                    >
                      <Check size={14} className="text-white" strokeWidth={3} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">
                        Log Set
                      </span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setIsConfirmingDelete(true)
                      }}
                      className="w-full py-2 flex items-center justify-center gap-2 text-[9px] font-black text-red-500 hover:bg-red-500/10 rounded-lg border border-red-500/30 uppercase tracking-widest transition-all"
                    >
                      <Trash2 size={12} />
                      Remove from Bank
                    </button>
                  </div>
                </div>

                <div className="min-w-full snap-start pl-1">
                  <div className="rounded-xl border border-slate-700 bg-[#1A1F26] p-3">
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                      Categories
                    </div>
                    {allCategories.length === 0 ? (
                      <p className="text-[9px] text-slate-600 italic mb-4">
                        Create categories above to tag this exercise
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {allCategories.map((cat) => {
                          const isSelected = categoryIds.includes(cat.id)
                          return (
                            <button
                              key={cat.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                onToggleCategory(cat.id)
                              }}
                              className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all border ${
                                isSelected
                                  ? 'bg-slate-100 text-[#1A1F26] border-white'
                                  : 'bg-[#2A333E] text-slate-500 border-slate-700'
                              }`}
                            >
                              {cat.name}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                      Stats
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="text-[9px] text-slate-500 uppercase font-black">Range</div>
                      <div className="text-[9px] text-slate-500 uppercase font-black text-center">
                        Best
                      </div>
                      <div className="text-[9px] text-slate-500 uppercase font-black text-center">
                        Avg/Worst
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-[10px] font-black text-slate-300">Week</div>
                      <div className="text-[11px] font-black text-center text-green-400">
                        {stats.week.best ?? '-'}
                      </div>
                      <div className="text-[11px] font-black text-center text-slate-300">
                        {stats.week.avg ?? '-'} / {stats.week.worst ?? '-'}
                      </div>
                      <div className="text-[10px] font-black text-slate-300">Month</div>
                      <div className="text-[11px] font-black text-center text-green-400">
                        {stats.month.best ?? '-'}
                      </div>
                      <div className="text-[11px] font-black text-center text-slate-300">
                        {stats.month.avg ?? '-'} / {stats.month.worst ?? '-'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="py-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex flex-col items-center text-center gap-3">
              <div className="flex items-center gap-2 text-red-500 font-black text-[10px] uppercase tracking-widest">
                <AlertTriangle size={14} />
                Delete {name}?
              </div>
              <div className="grid grid-cols-2 gap-2 w-full">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsConfirmingDelete(false)
                  }}
                  className="py-2 bg-slate-700 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove()
                  }}
                  className="py-2 bg-red-600 rounded-lg text-[9px] font-black uppercase tracking-widest text-white"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
