import type { ButtonHTMLAttributes } from 'react'

interface ExerciseCardValueStepperProps {
  centerWidthClassName?: string
  decrementButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>
  decrementLabel: string
  displayValue: string
  incrementButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>
  incrementLabel: string
}

export function ExerciseCardValueStepper({
  centerWidthClassName = 'w-16',
  decrementButtonProps,
  decrementLabel,
  displayValue,
  incrementLabel,
  incrementButtonProps,
}: ExerciseCardValueStepperProps) {
  return (
    <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_3.25rem] items-center gap-2 rounded-[1.15rem] border border-white/8 bg-[#202834]/88 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:grid-cols-[3.75rem_auto_3.75rem]">
      <button
        {...decrementButtonProps}
        onClick={(event) => event.stopPropagation()}
        className="flex h-10 items-center justify-center rounded-xl border border-white/8 bg-white/6 px-2 text-[10px] font-black text-slate-300 transition-colors hover:bg-white/10"
      >
        {decrementLabel}
      </button>
      <div
        className={`${centerWidthClassName} mx-auto rounded-xl border border-white/8 bg-[#161d26] px-3 py-2.5 text-center font-mono text-base font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]`}
      >
        {displayValue}
      </div>
      <button
        {...incrementButtonProps}
        onClick={(event) => event.stopPropagation()}
        className="flex h-10 items-center justify-center rounded-xl border border-white/8 bg-orange-500/12 px-2 text-[10px] font-black text-orange-200 transition-colors hover:bg-orange-500/18"
      >
        {incrementLabel}
      </button>
    </div>
  )
}
