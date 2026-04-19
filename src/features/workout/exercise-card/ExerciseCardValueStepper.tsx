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
    <div className="flex items-center gap-1 rounded-xl border border-slate-700 bg-[#1A1F26] p-0.5">
      <button
        {...decrementLargeButtonProps}
        onClick={onDecrementLarge}
        className="w-11 h-7 flex items-center justify-center rounded-lg bg-[#2A333E] text-[10px] font-black text-slate-300"
      >
        {decrementLargeLabel}
      </button>
      <button
        {...decrementSmallButtonProps}
        onClick={onDecrementSmall}
        className="w-11 h-7 flex items-center justify-center rounded-lg bg-[#2A333E] text-[10px] font-black text-slate-300"
      >
        {decrementSmallLabel}
      </button>
      <div
        className={`${centerWidthClassName} text-center font-mono text-sm font-black text-white`}
      >
        {displayValue}
      </div>
      <button
        {...incrementSmallButtonProps}
        onClick={onIncrementSmall}
        className="w-11 h-7 flex items-center justify-center rounded-lg bg-[#2A333E] text-[10px] font-black text-slate-300"
      >
        {incrementSmallLabel}
      </button>
      <button
        {...incrementLargeButtonProps}
        onClick={onIncrementLarge}
        className="w-11 h-7 flex items-center justify-center rounded-lg bg-[#2A333E] text-[10px] font-black text-slate-300"
      >
        {incrementLargeLabel}
      </button>
    </div>
  )
}
