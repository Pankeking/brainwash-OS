import { useEffect, useMemo, useRef, useState } from 'react'
import { Hourglass, RotateCcw, Square, Timer } from 'lucide-react'

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

interface WorkoutTimersProps {
  autoStartStopwatchToken?: number
}

export default function WorkoutTimers({ autoStartStopwatchToken = 0 }: WorkoutTimersProps) {
  const [mode, setMode] = useState<TimerMode>('stopwatch')
  const [countdownDurationSec, setCountdownDurationSec] = useState(300)
  const [countdownRemainingMs, setCountdownRemainingMs] = useState(300_000)
  const [countdownRunning, setCountdownRunning] = useState(false)
  const countdownStartedAtRef = useRef(0)
  const countdownStartRemainingRef = useRef(0)

  const [stopwatchMs, setStopwatchMs] = useState(0)
  const [stopwatchRunning, setStopwatchRunning] = useState(false)
  const stopwatchStartedAtRef = useRef(0)
  const stopwatchStartElapsedRef = useRef(0)
  const lastHandledAutoStartTokenRef = useRef(0)

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

  useEffect(() => {
    if (
      autoStartStopwatchToken <= 0 ||
      autoStartStopwatchToken === lastHandledAutoStartTokenRef.current
    ) {
      return
    }
    lastHandledAutoStartTokenRef.current = autoStartStopwatchToken
    setMode('stopwatch')
    setStopwatchRunning((current) => {
      if (current) {
        return current
      }
      stopwatchStartedAtRef.current = Date.now()
      stopwatchStartElapsedRef.current = stopwatchMs
      return true
    })
  }, [autoStartStopwatchToken, stopwatchMs])

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
      <div className="mb-4 flex items-center justify-between gap-3 px-1">
        <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          <Timer size={12} className="text-orange-500" /> Time
        </h2>
        <div className="flex overflow-hidden rounded-2xl border border-white/8 bg-[#111821]/85 p-1 shadow-[0_16px_40px_rgba(3,8,20,0.24)]">
          <button
            onClick={() => setMode('countdown')}
            className={`rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] transition-all ${
              mode === 'countdown'
                ? 'bg-orange-500 text-white shadow-[0_8px_18px_rgba(249,115,22,0.22)]'
                : 'text-slate-400'
            }`}
          >
            Countdown
          </button>
          <button
            onClick={() => setMode('stopwatch')}
            className={`rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] transition-all ${
              mode === 'stopwatch'
                ? 'bg-orange-500 text-white shadow-[0_8px_18px_rgba(249,115,22,0.22)]'
                : 'text-slate-400'
            }`}
          >
            Stopwatch
          </button>
        </div>
      </div>

      {mode === 'countdown' ? (
        <div className="rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(38,49,63,0.98),rgba(24,31,40,0.96))] p-4 shadow-[0_20px_44px_rgba(2,8,23,0.24)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-400">
              <Hourglass size={13} />
              <span className="text-[9px] font-black uppercase tracking-[0.18em]">Countdown</span>
            </div>
            <div className="rounded-full border border-white/8 bg-[#161d26]/90 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-300">
              {countdownRunning ? 'Running' : 'Ready'}
            </div>
          </div>

          <div className="mb-5 rounded-[1.4rem] border border-white/6 bg-[#161d26]/90 px-4 py-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-500">
              Remaining
            </div>
            <div className="mt-2 font-mono text-4xl font-black text-orange-400 sm:text-5xl">
              {countdownDisplay}
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-white/6 bg-[#161d26]/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="mb-3 flex items-center gap-2 text-slate-400">
              <Hourglass size={13} />
              <span className="text-[9px] font-black uppercase tracking-[0.18em]">
                Duration setup
              </span>
            </div>
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
              <button
                onClick={() => applyCountdownDuration(countdownDurationSec - 30)}
                disabled={countdownRunning}
                className="flex h-11 items-center justify-center rounded-2xl border border-white/8 bg-white/6 px-4 text-[10px] font-black text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-40"
              >
                -30s
              </button>
              <input
                type="number"
                min={1}
                value={countdownDurationSec}
                onChange={(e) => applyCountdownDuration(Number(e.target.value || 1))}
                disabled={countdownRunning}
                className="h-11 min-w-0 rounded-2xl border border-white/8 bg-[#202834]/85 px-3 text-center text-sm font-black text-slate-200 disabled:opacity-40"
              />
              <button
                onClick={() => applyCountdownDuration(countdownDurationSec + 30)}
                disabled={countdownRunning}
                className="flex h-11 items-center justify-center rounded-2xl border border-white/8 bg-white/6 px-4 text-[10px] font-black text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-40"
              >
                +30s
              </button>
            </div>
            <div className="mt-3 text-center text-[8px] font-black uppercase tracking-[0.18em] text-slate-500">
              Duration in seconds
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              onClick={toggleCountdown}
              className="h-12 rounded-2xl bg-orange-500 text-[9px] font-black uppercase tracking-[0.2em] text-white shadow-[0_14px_28px_rgba(249,115,22,0.24)] transition-transform active:translate-y-[1px]"
            >
              {countdownRunning ? 'Pause' : 'Start'}
            </button>
            <button
              onClick={() => {
                setCountdownRunning(false)
                setCountdownRemainingMs(countdownDurationSec * 1000)
              }}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/8 bg-[#161d26]/90 text-[9px] font-black uppercase tracking-[0.2em] text-slate-300"
            >
              <RotateCcw size={12} />
              Reset
            </button>
            <button
              onClick={() => {
                setCountdownRunning(false)
                setCountdownRemainingMs(0)
              }}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/8 bg-[#161d26]/90 text-[9px] font-black uppercase tracking-[0.2em] text-slate-300"
            >
              <Square size={12} />
              End
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(38,49,63,0.98),rgba(24,31,40,0.96))] p-4 shadow-[0_20px_44px_rgba(2,8,23,0.24)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-400">
              <Timer size={13} />
              <span className="text-[9px] font-black uppercase tracking-[0.18em]">Stopwatch</span>
            </div>
            <div className="rounded-full border border-white/8 bg-[#161d26]/90 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-300">
              {stopwatchRunning ? 'Running' : stopwatchMs > 0 ? 'Paused' : 'Ready'}
            </div>
          </div>

          <div className="mb-5 rounded-[1.4rem] border border-white/6 bg-[#161d26]/90 px-4 py-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-500">
              Elapsed
            </div>
            <div className="mt-2 font-mono text-4xl font-black text-orange-400 sm:text-5xl">
              {stopwatchDisplay}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              onClick={toggleStopwatch}
              className="h-12 rounded-2xl bg-orange-500 text-[9px] font-black uppercase tracking-[0.2em] text-white shadow-[0_14px_28px_rgba(249,115,22,0.24)] transition-transform active:translate-y-[1px]"
            >
              {stopwatchRunning ? 'Pause' : 'Start'}
            </button>
            <button
              onClick={() => setStopwatchRunning(false)}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/8 bg-[#161d26]/90 text-[9px] font-black uppercase tracking-[0.2em] text-slate-300"
            >
              <Square size={12} />
              Stop
            </button>
            <button
              onClick={() => {
                setStopwatchRunning(false)
                setStopwatchMs(0)
              }}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/8 bg-[#161d26]/90 text-[9px] font-black uppercase tracking-[0.2em] text-slate-300"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
