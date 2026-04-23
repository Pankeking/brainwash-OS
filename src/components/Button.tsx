import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost'
  children: React.ReactNode
}

export default function Button({
  variant = 'primary',
  children,
  className,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center gap-2 rounded-2xl border px-6 py-3 text-sm font-extrabold tracking-[0.04em] transition-all duration-200 shadow-[0_14px_34px_rgba(2,8,23,0.18)] backdrop-blur-xl'

  const variants = {
    primary:
      'border-white/8 bg-linear-to-b from-[#283342] to-[#1b2430] text-white hover:from-[#324052] hover:to-[#222e3c]',
    accent:
      'border-orange-300/20 bg-linear-to-b from-orange-400 to-orange-500 text-white shadow-[0_14px_34px_rgba(249,115,22,0.22)] hover:from-orange-300 hover:to-orange-500',
    secondary:
      'border-emerald-300/15 bg-linear-to-b from-[#486458] to-[#32463d] text-white hover:from-[#557568] hover:to-[#3b544a]',
    ghost:
      'border-transparent bg-transparent text-slate-300 shadow-none hover:bg-white/5 hover:text-white',
  }

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}
