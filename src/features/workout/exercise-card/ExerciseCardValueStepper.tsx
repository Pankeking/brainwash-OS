import type { ButtonHTMLAttributes } from 'react'

interface ExerciseCardValueStepperProps {
  decrementLargeButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>
  centerWidthClassName?: string
  decrementLargeLabel: string
  decrementSmallButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>
  decrementSmallLabel: string
  displayValue: string
  onDecrementLarge: () => void
  onDecrementSmall: () => void
  onIncrementLarge: () => void
  onIncrementSmall: () => void
  incrementLargeLabel: string
  incrementLargeButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>
  incrementSmallLabel: string
  incrementSmallButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>
}

export function ExerciseCardValueStepper({
  centerWidthClassName = 'w-16',
  decrementLargeButtonProps,
  decrementLargeLabel,
  decrementSmallButtonProps,
  decrementSmallLabel,
  displayValue,
  incrementLargeLabel,
  incrementLargeButtonProps,
  incrementSmallLabel,
  incrementSmallButtonProps,
  onDecrementLarge,
  onDecrementSmall,
  onIncrementLarge,
  onIncrementSmall,
}: ExerciseCardValueStepperProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-[1.3rem] border border-white/8 bg-[#202834]/88 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="grid grid-cols-2 gap-2">
        <button
          {...decrementLargeButtonProps}
          onClick={onDecrementLarge}
          className="flex h-11 items-center justify-center rounded-2xl border border-white/8 bg-white/6 px-3 text-[10px] font-black text-slate-300 transition-colors hover:bg-white/10"
        >
          {decrementLargeLabel}
        </button>
        <button
          {...decrementSmallButtonProps}
          onClick={onDecrementSmall}
          className="flex h-11 items-center justify-center rounded-2xl border border-white/8 bg-white/6 px-3 text-[10px] font-black text-slate-300 transition-colors hover:bg-white/10"
        >
          {decrementSmallLabel}
        </button>
      </div>
      <div
        className={`${centerWidthClassName} rounded-2xl border border-white/8 bg-[#161d26] px-3 py-3 text-center font-mono text-base font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]`}
      >
        {displayValue}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          {...incrementSmallButtonProps}
          onClick={onIncrementSmall}
          className="flex h-11 items-center justify-center rounded-2xl border border-white/8 bg-white/6 px-3 text-[10px] font-black text-slate-300 transition-colors hover:bg-white/10"
        >
          {incrementSmallLabel}
        </button>
        <button
          {...incrementLargeButtonProps}
          onClick={onIncrementLarge}
          className="flex h-11 items-center justify-center rounded-2xl border border-white/8 bg-white/6 px-3 text-[10px] font-black text-slate-300 transition-colors hover:bg-white/10"
        >
          {incrementLargeLabel}
        </button>
      </div>
    </div>
  )
}
