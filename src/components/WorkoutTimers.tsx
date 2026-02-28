import { useEffect, useMemo, useRef, useState } from 'react'
import { Hourglass, Timer } from 'lucide-react'

type TimerMode = 'countdown' | 'stopwatch'

function formatMs(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function WorkoutTimers() {
  const [mode, setMode] = useState<TimerMode>('countdown')
  const [countdownDurationSec, setCountdownDurationSec] = useState(300)
  const [countdownRemainingMs, setCountdownRemainingMs] = useState(300_000)
  const [countdownRunning, setCountdownRunning] = useState(false)
  const countdownStartedAtRef = useRef(0)
  const countdownStartRemainingRef = useRef(0)

  const [stopwatchMs, setStopwatchMs] = useState(0)
  const [stopwatchRunning, setStopwatchRunning] = useState(false)
  const stopwatchStartedAtRef = useRef(0)
  const stopwatchStartElapsedRef = useRef(0)

  const countdownDisplay = useMemo(() => formatMs(countdownRemainingMs), [countdownRemainingMs])
  const stopwatchDisplay = useMemo(() => formatMs(stopwatchMs), [stopwatchMs])

  useEffect(() => {
    if (!countdownRunning) {
      return
    }
    const interval = setInterval(() => {
      const elapsed = Date.now() - countdownStartedAtRef.current
      const nextMs = Math.max(0, countdownStartRemainingRef.current - elapsed)
      setCountdownRemainingMs(nextMs)
      if (nextMs <= 0) {
        setCountdownRunning(false)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [countdownRunning])

  useEffect(() => {
    if (!stopwatchRunning) {
      return
    }
    const interval = setInterval(() => {
      const elapsed = Date.now() - stopwatchStartedAtRef.current
      setStopwatchMs(stopwatchStartElapsedRef.current + elapsed)
    }, 100)

    return () => clearInterval(interval)
  }, [stopwatchRunning])

  const applyCountdownDuration = (nextDurationSec: number) => {
    const safeDurationSec = Math.max(1, nextDurationSec)
    setCountdownDurationSec(safeDurationSec)
    if (!countdownRunning) {
      setCountdownRemainingMs(safeDurationSec * 1000)
    }
  }

  const toggleCountdown = () => {
    setCountdownRunning((current) => {
      if (current) {
        return false
      }
      countdownStartedAtRef.current = Date.now()
      countdownStartRemainingRef.current = countdownRemainingMs
      return true
    })
  }

  const toggleStopwatch = () => {
    setStopwatchRunning((current) => {
      if (current) {
        return false
      }
      stopwatchStartedAtRef.current = Date.now()
      stopwatchStartElapsedRef.current = stopwatchMs
      return true
    })
  }

  return (
    <section className="mt-8">
      <div className="flex justify-between items-center mb-4 px-1">
        <h2 className="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase flex items-center gap-2">
          <Timer size={12} className="text-orange-500" /> Time
        </h2>
        <div className="flex rounded-lg overflow-hidden border border-slate-700">
          <button
            onClick={() => setMode('countdown')}
            className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest ${
              mode === 'countdown' ? 'bg-orange-500 text-white' : 'bg-[#1A1F26] text-slate-400'
            }`}
          >
            Countdown
          </button>
          <button
            onClick={() => setMode('stopwatch')}
            className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest ${
              mode === 'stopwatch' ? 'bg-orange-500 text-white' : 'bg-[#1A1F26] text-slate-400'
            }`}
          >
            Stopwatch
          </button>
        </div>
      </div>

      {mode === 'countdown' ? (
        <div className="bg-[#2A333E] rounded-2xl border border-slate-700 p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-3">
            <Hourglass size={13} />
            <span className="text-[9px] font-black uppercase tracking-widest">Countdown</span>
          </div>

          <div className="text-center font-mono text-4xl font-black text-orange-400 mb-4">
            {countdownDisplay}
          </div>

          <div className="flex items-center justify-between gap-2 mb-3">
            <button
              onClick={() => applyCountdownDuration(countdownDurationSec - 30)}
              disabled={countdownRunning}
              className="px-3 py-2 bg-[#1A1F26] border border-slate-700 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-300 disabled:opacity-40"
            >
              -30s
            </button>
            <input
              type="number"
              min={1}
              value={countdownDurationSec}
              onChange={(e) => applyCountdownDuration(Number(e.target.value || 1))}
              disabled={countdownRunning}
              className="w-24 bg-[#1A1F26] border border-slate-700 rounded-lg text-center py-2 text-sm font-black text-slate-200 disabled:opacity-40"
            />
            <button
              onClick={() => applyCountdownDuration(countdownDurationSec + 30)}
              disabled={countdownRunning}
              className="px-3 py-2 bg-[#1A1F26] border border-slate-700 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-300 disabled:opacity-40"
            >
              +30s
            </button>
          </div>
          <div className="text-center text-[8px] font-black uppercase tracking-widest text-slate-500 mb-4">
            Duration in seconds
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={toggleCountdown}
              className="py-2.5 bg-orange-600 rounded-xl shadow-[0_3px_0_0_#9a3412] active:translate-y-1 active:shadow-none text-[9px] font-black uppercase tracking-widest"
            >
              {countdownRunning ? 'Pause' : 'Start'}
            </button>
            <button
              onClick={() => {
                setCountdownRunning(false)
                setCountdownRemainingMs(countdownDurationSec * 1000)
              }}
              className="py-2.5 bg-[#1A1F26] border border-slate-700 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-300"
            >
              Reset
            </button>
            <button
              onClick={() => {
                setCountdownRunning(false)
                setCountdownRemainingMs(0)
              }}
              className="py-2.5 bg-[#1A1F26] border border-slate-700 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-300"
            >
              End
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[#2A333E] rounded-2xl border border-slate-700 p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-3">
            <Timer size={13} />
            <span className="text-[9px] font-black uppercase tracking-widest">Stopwatch</span>
          </div>

          <div className="text-center font-mono text-4xl font-black text-orange-400 mb-4">
            {stopwatchDisplay}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={toggleStopwatch}
              className="py-2.5 bg-orange-600 rounded-xl shadow-[0_3px_0_0_#9a3412] active:translate-y-1 active:shadow-none text-[9px] font-black uppercase tracking-widest"
            >
              {stopwatchRunning ? 'Pause' : 'Start'}
            </button>
            <button
              onClick={() => setStopwatchRunning(false)}
              className="py-2.5 bg-[#1A1F26] border border-slate-700 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-300"
            >
              Stop
            </button>
            <button
              onClick={() => {
                setStopwatchRunning(false)
                setStopwatchMs(0)
              }}
              className="py-2.5 bg-[#1A1F26] border border-slate-700 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-300"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
